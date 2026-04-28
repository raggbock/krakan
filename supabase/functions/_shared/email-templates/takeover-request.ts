export function takeoverRequestEmail(opts: {
  marketName: string
  marketCity: string | null
  marketSlug: string | null
  marketId: string
  requesterEmail: string
  note: string | null
  adminUrl: string
}) {
  const { marketName, marketCity, marketSlug, marketId, requesterEmail, note, adminUrl } = opts
  const location = marketCity ? ` (${marketCity})` : ''
  const escNote = (note ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const noteBlock = note
    ? `<p><strong>Koppling till loppisen:</strong></p><p style="white-space: pre-wrap;">${escNote}</p>`
    : `<p style="color: #8F8775;">Ingen koppling angiven.</p>`
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #2C241D;">
      <h2 style="margin-top: 0;">Ny takeover-förfrågan</h2>
      <p><strong>Loppis:</strong> ${marketName}${location}</p>
      <p><strong>Förfrågare:</strong> ${requesterEmail}</p>
      <p><strong>Slug:</strong> ${marketSlug ?? '(saknas)'}</p>
      <p><strong>Market-id:</strong> ${marketId}</p>
      <hr style="border: none; border-top: 1px solid #D5C9AF; margin: 16px 0;" />
      ${noteBlock}
      <hr style="border: none; border-top: 1px solid #D5C9AF; margin: 16px 0;" />
      <p>Om förfrågan ser legitim ut: gå till <a href="${adminUrl}">/admin/markets</a>,
      filtrera på loppisen, sätt <code>contact_email = ${requesterEmail}</code>, och skicka takeover-mejl.</p>
      <p style="color: #6b5a48; font-size: 13px;">— Fyndstigen</p>
    </div>
  `
  const text = `Ny takeover-förfrågan\n\nLoppis: ${marketName}${location}\nFörfrågare: ${requesterEmail}\nSlug: ${marketSlug ?? '(saknas)'}\nMarket-id: ${marketId}\n\nKoppling: ${note ?? '(ingen angiven)'}\n\nGå till ${adminUrl}/admin/markets för att granska och skicka takeover-mejl.`
  return { html, text }
}
