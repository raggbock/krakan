export function takeoverInviteEmail(opts: {
  businessName: string
  city: string | null
  takeoverUrl: string
}) {
  const { businessName, city, takeoverUrl } = opts
  const location = city ? ` i ${city}` : ''
  const html = `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Är ${businessName} din?</h1>
      <p>Hej! Vi har lagt upp en profil för <strong>${businessName}</strong>${location} på
      <a href="https://fyndstigen.se">fyndstigen.se</a> — en katalog över
      loppisar och second hand-butiker i Örebro län.</p>
      <p>Profilen är skapad av oss baserat på offentlig information. Vi vill
      att du som är ägare ska kunna ta över och redigera den fritt: öppettider,
      bilder, beskrivning.</p>
      <p><a href="${takeoverUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Ta över profilen</a></p>
      <p style="color: #6b5a48; font-size: 14px; margin-top: 24px;">
        Länken är personlig och giltig i 90 dagar. Om du inte är ägare — hoppa
        över eller svara så tar vi bort profilen.
      </p>
      <p style="color: #6b5a48; font-size: 13px;">— Fyndstigen-teamet</p>
    </div>
  `
  const text = `${businessName}${location}\n\nVi har lagt upp en profil för din butik på fyndstigen.se. Ta över och redigera den själv:\n${takeoverUrl}\n\nLänken är personlig och giltig i 90 dagar.\n\n— Fyndstigen-teamet`
  return { html, text }
}
