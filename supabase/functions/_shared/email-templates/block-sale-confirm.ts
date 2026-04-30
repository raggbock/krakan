export function blockSaleConfirmEmail(opts: {
  eventName: string
  confirmUrl: string
}) {
  const { eventName, confirmUrl } = opts
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Bekräfta din ansökan</h1>
      <p>Hej! Tack för din ansökan till <strong>${eventName}</strong>.
      Klicka på länken nedan för att bekräfta din e-postadress — först då
      skickas ansökan till arrangören.</p>
      <p><a href="${confirmUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Bekräfta min ansökan</a></p>
      <p style="color: #6b5a48; font-size: 13px; margin-top: 24px;">— Fyndstigen</p>
    </div>
  `
  const text = `Tack för din ansökan till ${eventName}!\n\nKlicka på länken nedan för att bekräfta din e-postadress — först då skickas ansökan till arrangören:\n${confirmUrl}\n\n— Fyndstigen`
  return { subject: `Bekräfta din ansökan till ${eventName}`, html, text }
}
