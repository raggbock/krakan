export function routeSavedAnonEmail(opts: {
  magicLink: string
  routeName: string
  stopCount: number
}) {
  const { magicLink, routeName, stopCount } = opts
  const stopWord = stopCount === 1 ? 'stopp' : 'stopp'
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Din loppisrunda är sparad!</h1>
      <p>Du har sparat rundan <strong>${routeName}</strong> med ${stopCount} ${stopWord} på Fyndstigen.</p>
      <p>Klicka på länken nedan för att logga in och se din runda:</p>
      <p><a href="${magicLink}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Visa min runda</a></p>
      <p style="color: #6b5a48; font-size: 14px; margin-top: 24px;">
        Länken loggar in dig automatiskt. Den är giltig i 1 timme — be om en ny
        på <a href="https://fyndstigen.se/auth">fyndstigen.se/auth</a> om den
        går ut innan du hunnit klicka.
      </p>
      <p style="color: #6b5a48; font-size: 13px;">— Fyndstigen-teamet</p>
    </div>
  `
  const text = `Din loppisrunda är sparad!\n\nDu har sparat rundan "${routeName}" med ${stopCount} ${stopWord} på Fyndstigen.\n\nKlicka på länken nedan för att logga in och se din runda:\n${magicLink}\n\nLänken loggar in dig automatiskt och är giltig i 1 timme.\n\n— Fyndstigen-teamet`
  return { html, text }
}
