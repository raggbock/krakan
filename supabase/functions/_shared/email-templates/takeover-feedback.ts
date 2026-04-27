export function takeoverFeedbackEmail(opts: {
  businessName: string
  city: string | null
  fromEmail: string
  message: string
}) {
  const { businessName, city, fromEmail, message } = opts
  const location = city ? ` (${city})` : ''
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #2C241D;">
      <h2 style="margin-top: 0;">Ändringsförslag från ${businessName}${location}</h2>
      <p><strong>Avsändare:</strong> ${fromEmail}</p>
      <p><strong>Loppis:</strong> ${businessName}${location}</p>
      <hr style="border: none; border-top: 1px solid #D5C9AF; margin: 16px 0;" />
      <p style="white-space: pre-wrap;">${escaped}</p>
    </div>
  `
  const text = `Ändringsförslag från ${businessName}${location}\n\nAvsändare: ${fromEmail}\n\n${message}`
  return { html, text }
}
