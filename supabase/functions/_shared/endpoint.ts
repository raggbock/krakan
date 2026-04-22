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
 *   - Validates the handler's return value against `config.output`. In
 *     development (DENO_ENV !== 'production') a contract violation throws
 *     so the mismatch is loud during local work / CI; in production we log
 *     and return the value anyway to avoid breaking clients on a schema drift.
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
      const env = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno
        ?.env.get('DENO_ENV')
      const isProd = env === 'production'
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
