export function adminInviteEmail(opts: { inviterEmail: string; acceptUrl: string }) {
  const { inviterEmail, acceptUrl } = opts
  const html = `
<!doctype html>
<html>
<body style="font-family: system-ui, sans-serif; color: #2C241D; background: #F2EBE0; padding: 24px;">
  <div style="max-width: 520px; margin: 0 auto; background: #FAF7F2; padding: 32px; border-radius: 12px;">
    <h1 style="font-family: Georgia, serif; color: #A84B2A; margin-top: 0;">Välkommen som Fyndstigen-admin</h1>
    <p>${inviterEmail} har bjudit in dig att bli admin på Fyndstigen.</p>
    <p>Klicka på länken nedan för att aktivera ditt admin-konto. Länken är giltig i 7 dagar.</p>
    <p><a href="${acceptUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 20px; border-radius:6px; text-decoration:none;">Aktivera admin-konto</a></p>
    <p style="font-size: 12px; color: #4A3F34;">Om knappen inte fungerar, kopiera denna länk till din webbläsare:<br/>${acceptUrl}</p>
  </div>
</body>
</html>`.trim()
  const text = `Välkommen som Fyndstigen-admin\n\n${inviterEmail} har bjudit in dig.\nÖppna länken för att aktivera:\n${acceptUrl}\n\nLänken gäller i 7 dagar.`
  return { html, text }
}
