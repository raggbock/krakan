import { defineEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import {
  AdminMarketEditInput,
  AdminMarketEditOutput,
} from '@fyndstigen/shared/contracts/admin-market-edit.ts'

defineEndpoint({
  name: 'admin-market-edit',
  input: AdminMarketEditInput,
  output: AdminMarketEditOutput,
  handler: async ({ user, admin }, { marketId, patch }) => {
    const { data: isAdminResult, error: rpcErr } = await admin.rpc('is_admin', { uid: user.id })
    if (rpcErr) throw new Error(rpcErr.message)
    if (!isAdminResult) throw new HttpError(403, 'not_admin')

    // Build the markets-table update payload from contact + address + location patches.
    const update: Record<string, unknown> = {}
    if (patch.contact) {
      const c = patch.contact
      if ('website' in c) update.contact_website = c.website ?? null
      if ('facebook' in c) update.contact_facebook = c.facebook ?? null
      if ('instagram' in c) update.contact_instagram = c.instagram ?? null
      if ('phone' in c) update.contact_phone = c.phone ?? null
      if ('email' in c) update.contact_email = c.email ?? null
    }
    if (patch.address) {
      const a = patch.address
      if ('street' in a) update.street = a.street ?? null
      if ('zipCode' in a) update.zip_code = a.zipCode ?? null
      if ('city' in a) update.city = a.city ?? null
      if (a.country) update.country = a.country
    }
    if (patch.location) {
      // location uses PostGIS POINT(lng lat) — keep latitude/longitude in sync
      // for the convenience columns the UI reads.
      update.location = `SRID=4326;POINT(${patch.location.longitude} ${patch.location.latitude})`
      update.latitude = patch.location.latitude
      update.longitude = patch.location.longitude
    }

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from('flea_markets').update(update).eq('id', marketId)
      if (error) throw new Error(error.message)
    }

    if (patch.openingHourRules) {
      // Replace all rules atomically — same shape the organizer edit page uses.
      const { error: delErr } = await admin
        .from('opening_hour_rules')
        .delete()
        .eq('flea_market_id', marketId)
      if (delErr) throw new Error(delErr.message)

      if (patch.openingHourRules.length > 0) {
        const rows = patch.openingHourRules.map((r) => ({
          flea_market_id: marketId,
          type: r.type,
          day_of_week: r.dayOfWeek,
          anchor_date: r.anchorDate,
          open_time: r.openTime,
          close_time: r.closeTime,
        }))
        const { error: insErr } = await admin.from('opening_hour_rules').insert(rows)
        if (insErr) throw new Error(insErr.message)
      }
    }

    const { error: auditErr } = await admin.from('admin_actions').insert({
      admin_user_id: user.id,
      action: 'market.edit',
      target_type: 'flea_market',
      target_id: marketId,
      payload: {
        sections: Object.keys(patch),
      },
    })
    if (auditErr) console.error('[admin-market-edit] audit log failed:', auditErr.message)

    return { success: true as const }
  },
})
