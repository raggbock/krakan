export function takeoverCodeEmail(opts: { code: string; businessName: string }) {
  const { code, businessName } = opts
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Verifiera din e-post</h1>
      <p>Du håller på att ta över <strong>${businessName}</strong> på Fyndstigen.</p>
      <p>Din verifieringskod:</p>
      <p style="font-size: 32px; font-family: 'Courier New', monospace; letter-spacing: 4px; background: #f5efe6; padding: 16px; text-align: center; border-radius: 6px;">${code}</p>
      <p style="color: #6b5a48; font-size: 14px;">Koden är giltig i 15 minuter. Om du inte begärt detta kan du ignorera det här mailet.</p>
    </div>
  `
  const text = `Verifiera din e-post på Fyndstigen\n\nDu tar över ${businessName}.\nKod: ${code}\nGäller i 15 minuter.`
  return { html, text }
}

export function takeoverMagicLinkEmail(opts: { magicLink: string; businessName: string }) {
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Slutför inloggning</h1>
      <p>Klart! Du är nu kopplad som ägare till <strong>${opts.businessName}</strong>.</p>
      <p>Klicka på länken nedan för att logga in och börja redigera profilen:</p>
      <p><a href="${opts.magicLink}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none;">Logga in</a></p>
      <p style="color: #6b5a48; font-size: 14px;">Länken är giltig i 1 timme.</p>
    </div>
  `
  const text = `Du är nu ägare till ${opts.businessName}.\nLogga in: ${opts.magicLink}\n(Giltig 1 timme.)`
  return { html, text }
}
