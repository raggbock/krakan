export type SendEmailOpts = {
  to: string
  subject: string
  html: string
  text: string
  from: string
  apiKey: string
  fetchImpl?: typeof fetch
}

export async function sendEmail(opts: SendEmailOpts): Promise<{ id: string }> {
  const f = opts.fetchImpl ?? fetch
  const res = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend ${res.status}: ${body}`)
  }
  const json = (await res.json()) as { id: string }
  return { id: json.id }
}

/**
 * Default from-header. Requires the `fyndstigen.se` sender domain to be
 * verified in Resend (see SETUP-CHECKLIST).
 */
export const DEFAULT_FROM = 'Fyndstigen <noreply@fyndstigen.se>'
