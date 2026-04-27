export function takeoverRemovedNotificationEmail(opts: {
  businessName: string
  city: string | null
  marketId: string
  reason: string | null
}) {
  const { businessName, city, marketId, reason } = opts
  const location = city ? ` (${city})` : ''
  const escapedReason = (reason ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const reasonBlock = reason
    ? `<p><strong>Anledning:</strong></p><p style="white-space: pre-wrap;">${escapedReason}</p>`
    : `<p style="color: #8F8775;">Ingen anledning angiven.</p>`
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #2C241D;">
      <h2 style="margin-top: 0;">Loppis borttagen via takeover-länk</h2>
      <p><strong>Loppis:</strong> ${businessName}${location}</p>
      <p><strong>flea_market_id:</strong> ${marketId}</p>
      <hr style="border: none; border-top: 1px solid #D5C9AF; margin: 16px 0;" />
      ${reasonBlock}
    </div>
  `
  const text = `Loppis borttagen via takeover-länk\n\nLoppis: ${businessName}${location}\nflea_market_id: ${marketId}\n\nAnledning: ${reason ?? '(ingen)'}`
  return { html, text }
}
