export function blockSaleApprovedEmail(opts: {
  eventName: string
  eventUrl: string
  editUrl: string
}) {
  const { eventName, eventUrl, editUrl } = opts
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Du är godkänd till ${eventName}!</h1>
      <p>Du är godkänd till <strong>${eventName}</strong>!</p>
      <p><a href="${eventUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Se eventsidan</a></p>
      <p>Du kan redigera din ansökan här:
      <a href="${editUrl}" style="color:#A84B2A;">Redigera</a></p>
      <p style="color: #6b5a48; font-size: 14px;">
        Tips: skapa ett Fyndstigen-konto med samma email så blir det enklare nästa gång.
      </p>
      <p style="color: #6b5a48; font-size: 13px; margin-top: 24px;">— Fyndstigen</p>
    </div>
  `
  const text = `Du är godkänd till ${eventName}!\n\nSe eventsidan:\n${eventUrl}\n\nDu kan redigera din ansökan här:\n${editUrl}\n\nTips: skapa ett Fyndstigen-konto med samma email så blir det enklare nästa gång.\n\n— Fyndstigen`
  return { subject: `Du är godkänd till ${eventName}!`, html, text }
}
