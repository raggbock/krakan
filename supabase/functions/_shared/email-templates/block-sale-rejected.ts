export function blockSaleRejectedEmail(opts: {
  eventName: string
  reason?: string | null
}) {
  const { eventName, reason } = opts
  const escaped = reason
    ? reason.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    : null
  const reasonHtml = escaped
    ? `<p><strong>Anledning:</strong> ${escaped}</p>`
    : ''
  const reasonText = reason ? `\nAnledning: ${reason}\n` : ''
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Angående din ansökan till ${eventName}</h1>
      <p>Tack för ditt intresse för <strong>${eventName}</strong>.
      Tyvärr godtogs inte din ansökan.</p>
      ${reasonHtml}
      <p>Lycka till nästa gång!</p>
      <p style="color: #6b5a48; font-size: 13px; margin-top: 24px;">— Fyndstigen</p>
    </div>
  `
  const text = `Angående din ansökan till ${eventName}\n\nTack för ditt intresse för ${eventName}. Tyvärr godtogs inte din ansökan.${reasonText}\nLycka till nästa gång!\n\n— Fyndstigen`
  return { subject: `Angående din ansökan till ${eventName}`, html, text }
}
