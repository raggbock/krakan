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
 *   - Validates the handler's return value against `config.output`. When
 *     SUPABASE_ENVIRONMENT === 'development' a contract violation throws so
 *     the mismatch is loud during local work / CI; otherwise (including when
 *     the variable is unset) we log and return the value to avoid breaking
 *     clients on schema drift. Defaults to production-safe (warn) mode.
 *
 * The return type of `defineEndpoint` is intentionally void — the call
 * registers a Deno HTTP server side-effectfully, matching `serve()` /
 * `createHandler()` ergonomics.
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
      // Use SUPABASE_ENVIRONMENT (set by the Supabase platform) to distinguish prod vs dev.
      // Default to 'production' so that an unset env (e.g. new deployment) is safe (warn, not throw).
      // In local dev / CI set SUPABASE_ENVIRONMENT=development to get loud failures instead.
      const supabaseEnv = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno
        ?.env.get('SUPABASE_ENVIRONMENT') ?? 'production'
      const isProd = supabaseEnv !== 'development'
      const msg = `[endpoint:${config.name}] output contract violation: ${JSON.stringify(parsedOutput.error.issues)}`
      if (isProd) {
        console.error(msg)
        return result
      }
      throw new Error(msg)
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
