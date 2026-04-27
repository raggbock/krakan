export function marketCreatedEmail(opts: { magicLink: string; marketName: string }) {
  const { magicLink, marketName } = opts
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Tack — ${marketName} är registrerad!</h1>
      <p>Din loppis-sida är skapad som ett utkast på <a href="https://fyndstigen.se">fyndstigen.se</a>.
      Klicka på länken nedan för att slutföra: lägg till bilder, beskrivning,
      och tryck på Publicera när ni är klara.</p>
      <p><a href="${magicLink}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Slutför och publicera</a></p>
      <p style="color: #6b5a48; font-size: 14px; margin-top: 24px;">
        Länken loggar in dig automatiskt. Den är giltig i 1 timme — be om en ny
        på <a href="https://fyndstigen.se/auth">fyndstigen.se/auth</a> om den
        går ut innan ni hunnit klicka.
      </p>
      <p style="color: #6b5a48; font-size: 13px;">— Fyndstigen-teamet</p>
    </div>
  `
  const text = `Tack — ${marketName} är registrerad!\n\nDin loppis-sida är skapad som ett utkast. Klicka på länken nedan för att slutföra och publicera:\n${magicLink}\n\nLänken loggar in dig automatiskt och är giltig i 1 timme.\n\n— Fyndstigen-teamet`
  return { html, text }
}
