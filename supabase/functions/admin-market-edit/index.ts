import { defineAdminEndpoint } from '../_shared/endpoint.ts'
import { HttpError } from '../_shared/handler.ts'
import { appError } from '@fyndstigen/shared/errors.ts'
import {
  AdminMarketEditInput,
  AdminMarketEditOutput,
} from '@fyndstigen/shared/contracts/admin-market-edit.ts'

defineAdminEndpoint({
  name: 'admin-market-edit',
  input: AdminMarketEditInput,
  output: AdminMarketEditOutput,
  handler: async ({ admin, user }, { marketId, patch }) => {
    // Publishing requires at least one opening_hour_rule. If the same patch
    // also includes new rules, those count — admin can publish in a single
    // round-trip after filling hours in the drawer. Otherwise we look at
    // what's already in the table.
    if (patch.publish === true) {
      const incomingRules = patch.openingHourRules?.length ?? 0
      if (incomingRules === 0) {
        const { data: existing, error: hErr } = await admin
          .from('opening_hour_rules')
          .select('id')
          .eq('flea_market_id', marketId)
          .limit(1)
        if (hErr) throw new Error(hErr.message)
        if (!existing || existing.length === 0) {
          throw new HttpError(
            400,
            'Cannot publish market without opening hours',
            appError('market.cannot_publish_without_hours'),
          )
        }
      }
    }

    // Build the markets-table update payload from contact + address + location patches.
    const update: Record<string, unknown> = {}
    if (patch.name !== undefined) update.name = patch.name
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
      // latitude/longitude are GENERATED ALWAYS columns derived from
      // location via st_y/st_x — Postgres rejects any direct UPDATE on
      // them ("cannot be updated"). Only set location; the generated
      // columns refresh automatically from the new POINT.
      update.location = `SRID=4326;POINT(${patch.location.longitude} ${patch.location.latitude})`
    }
    if (patch.publish !== undefined) {
      update.published_at = patch.publish ? new Date().toISOString() : null
    }
    if (patch.status) {
      update.status = patch.status
    }

    if (Object.keys(update).length > 0) {
      const { error } = await admin.from('flea_markets').update(update).eq('id', marketId)
      if (error) throw new Error(error.message)
    }

    if (patch.openingHourRules) {
      // Atomically replace all rules via a single Postgres function call —
      // the DELETE and INSERT run inside one implicit transaction, so a
      // failed INSERT can never leave the market with zero hours.
      const p_rules = patch.openingHourRules.map((r) => ({
        type: r.type,
        day_of_week: r.dayOfWeek,
        anchor_date: r.anchorDate,
        open_time: r.openTime,
        close_time: r.closeTime,
      }))
      const { error: rpcErr } = await admin.rpc('replace_opening_hours_atomic', {
        p_market_id: marketId,
        p_rules: JSON.stringify(p_rules),
      })
      if (rpcErr) throw new Error(rpcErr.message)
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
