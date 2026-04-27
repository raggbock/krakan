export function takeoverInviteEmail(opts: {
  businessName: string
  city: string | null
  takeoverUrl: string
}) {
  const { businessName, city, takeoverUrl } = opts
  const location = city ? ` i ${city}` : ''
  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">${businessName}${location} på fyndstigen</h1>
      <p>Hej! Vi har lagt upp en sida för <strong>${businessName}</strong>${location} på
      <a href="https://fyndstigen.se">fyndstigen.se</a> — en katalog över
      loppisar och second hand-butiker i Sverige.</p>
      <p>Sidan är skapad av oss baserat på offentlig information.
      Klicka på länken nedan så kan ni välja: ta över och redigera, föreslå
      en ändring, eller ta bort sidan helt.</p>
      <p><a href="${takeoverUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Hantera er sida</a></p>
      <p style="color: #6b5a48; font-size: 14px; margin-top: 24px;">
        Länken är personlig och giltig i 90 dagar.
      </p>
      <p style="color: #6b5a48; font-size: 13px;">— Fyndstigen-teamet</p>
    </div>
  `
  const text = `${businessName}${location}\n\nVi har lagt upp en sida för er på fyndstigen.se. Klicka på länken nedan för att ta över, föreslå en ändring eller ta bort sidan:\n${takeoverUrl}\n\nLänken är personlig och giltig i 90 dagar.\n\n— Fyndstigen-teamet`
  return { html, text }
}
