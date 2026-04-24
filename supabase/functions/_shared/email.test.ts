// Run: deno test supabase/functions/_shared/email.test.ts
import { assertEquals, assertRejects } from 'https://deno.land/std@0.177.0/testing/asserts.ts'
import { sendEmail, type SendEmailOpts } from './email.ts'

Deno.test('sendEmail posts JSON payload to Resend', async () => {
  const calls: RequestInit[] = []
  const fakeFetch = async (_url: string | URL, init?: RequestInit) => {
    calls.push(init!)
    return new Response(JSON.stringify({ id: 're_123' }), { status: 200 })
  }
  const opts: SendEmailOpts = {
    to: 'you@example.com',
    subject: 'Hello',
    html: '<p>Hi</p>',
    text: 'Hi',
    from: 'Fyndstigen <noreply@fyndstigen.se>',
    apiKey: 'rk_test',
    fetchImpl: fakeFetch,
  }
  const { id } = await sendEmail(opts)
  assertEquals(id, 're_123')
  assertEquals(calls.length, 1)
  const body = JSON.parse(calls[0].body as string)
  assertEquals(body.to, 'you@example.com')
  assertEquals(body.subject, 'Hello')
})

Deno.test('sendEmail throws on non-2xx', async () => {
  const fakeFetch = async () => new Response('fail', { status: 500 })
  await assertRejects(
    () =>
      sendEmail({
        to: 'x@y.se',
        subject: 's',
        html: 'h',
        text: 't',
        from: 'x',
        apiKey: 'k',
        fetchImpl: fakeFetch,
      }),
    Error,
    'Resend',
  )
})
