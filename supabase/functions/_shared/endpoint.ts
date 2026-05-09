import { z } from 'zod'
import { createHandler, HttpError, type RequestContext } from './handler.ts'

/**
 * Typed edge-function endpoint backed by Zod contracts.
 *
 * Thin wrapper around `createHandler` that:
 *   - Validates request body against `config.input` before the handler runs.
 *     Invalid input short-circuits with an AppError-shaped payload
 *     ({ error: 'input.invalid', detail: { issues } }) and HTTP 400.
 *   - Runs the typed handler.
 *   - Validates the handler's return value against `config.output`.
 *
 * Output-contract mode is controlled by `OUTPUT_CONTRACT_MODE`:
 *   - `'strict'`        → throw on violation (use in CI + local dev)
 *   - unset or `'warn'` → console.error and return the value (production
 *                         default — never break clients on schema drift)
 *
 * Set `OUTPUT_CONTRACT_MODE=strict` in CI (.github/workflows/ci.yml) and
 * locally via `supabase/.env.local` to catch violations during development.
 *
 * The legacy `SUPABASE_ENVIRONMENT=development` flag is still honoured for
 * back-compat — remove once all setups have migrated to the new name.
 *
 * Alerting on warnings is tracked separately in #113.
 */
export type EndpointConfig<I, O> = {
  name: string
  input: z.ZodType<I>
  output: z.ZodType<O>
  handler: (ctx: RequestContext, input: I) => Promise<O>
}

export function defineEndpoint<I, O>(config: EndpointConfig<I, O>): void {
  createHandler(async (ctx) => {
    const parsedInput = config.input.safeParse(ctx.body)
    if (!parsedInput.success) {
      // AppError shape — kept as plain object since the Deno side does not
      // import @fyndstigen/shared. The code 'input.invalid' is the canonical
      // ErrorCode from packages/shared/src/errors.ts.
      throw new InputInvalidError(parsedInput.error.issues)
    }

    const result = await config.handler(ctx, parsedInput.data)

    const parsedOutput = config.output.safeParse(result)
    if (!parsedOutput.success) {
      const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env
      const mode = env?.get('OUTPUT_CONTRACT_MODE')
        ?? (env?.get('SUPABASE_ENVIRONMENT') === 'development' ? 'strict' : 'warn')
      const msg = `[endpoint:${config.name}] output contract violation: ${JSON.stringify(parsedOutput.error.issues)}`
      if (mode === 'strict') throw new Error(msg)
      console.error(msg)
      return result
    }

    return parsedOutput.data
  })
}

/**
 * Internal: thrown when input validation fails. Rendered by the base
 * handler as HTTP 400 with a structured AppError body
 * (`{ code: 'input.invalid', detail: { issues } }`) via
 * `HttpError.body`, so the client can read `error.code` directly
 * without double JSON-parsing.
 */
class InputInvalidError extends HttpError {
  constructor(issues: unknown) {
    super(400, 'Input validation failed', {
      code: 'input.invalid',
      detail: { issues },
    })
  }
}

/**
 * Admin-gated endpoint. Wraps `defineEndpoint` with an `is_admin` RPC
 * check that runs before the handler — non-admins get HTTP 403 and the
 * handler is never invoked. Centralises the admin-policy so it can be
 * changed in one place (e.g. add audit logging, swap the RPC name) and
 * removes the per-function copy-pasted boilerplate.
 */
export function defineAdminEndpoint<I, O>(config: EndpointConfig<I, O>): void {
  defineEndpoint({
    ...config,
    handler: async (ctx, input) => {
      const { data: isAdmin, error } = await ctx.admin.rpc('is_admin', { uid: ctx.user.id })
      if (error) throw new Error(error.message)
      if (!isAdmin) throw new HttpError(403, 'not_admin')
      return config.handler(ctx, input)
    },
  })
}
