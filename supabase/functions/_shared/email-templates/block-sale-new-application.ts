export function blockSaleNewApplicationEmail(opts: {
  eventName: string
  applicantName: string
  adminUrl: string
}) {
  const { eventName, applicantName, adminUrl } = opts
  const html = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #2a1d12;">
      <h1 style="color: #A84B2A; margin-top: 0;">Ny ansökan till ${eventName}</h1>
      <p><strong>${applicantName}</strong> har ansökt om ett stånd på <strong>${eventName}</strong>.</p>
      <p><a href="${adminUrl}" style="display:inline-block; background:#A84B2A; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold;">Granska ansökan</a></p>
      <p style="color: #6b5a48; font-size: 13px; margin-top: 24px;">— Fyndstigen</p>
    </div>
  `
  const text = `Ny ansökan till ${eventName}\n\n${applicantName} har ansökt om ett stånd på ${eventName}.\n\nGranska ansökan:\n${adminUrl}\n\n— Fyndstigen`
  return { subject: `Ny ansökan till ${eventName}`, html, text }
}
