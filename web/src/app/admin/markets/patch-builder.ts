import type { AdminMarketRow } from '@fyndstigen/shared/contracts/admin-markets-overview'

export type RuleDraft = {
  type: 'weekly' | 'biweekly' | 'date'
  dayOfWeek: number | null
  anchorDate: string | null
  openTime: string
  closeTime: string
}

export type MarketDraft = {
  name: string
  website: string
  facebook: string
  instagram: string
  phone: string
  email: string
  street: string
  zipCode: string
  city: string
  latitude: number | null
  longitude: number | null
  weeklyRules: RuleDraft[]
  hoursTouched: boolean
}

export type MarketEditPatch = {
  name?: string
  contact?: { website?: string | null; facebook?: string | null; instagram?: string | null; phone?: string | null; email?: string | null }
  address?: { street?: string | null; zipCode?: string | null; city?: string | null }
  location?: { latitude: number; longitude: number }
  openingHourRules?: Array<{ type: 'weekly' | 'biweekly' | 'date'; dayOfWeek: number | null; anchorDate: string | null; openTime: string; closeTime: string }>
}

export function buildPatch(current: AdminMarketRow, draft: MarketDraft): MarketEditPatch {
  const patch: MarketEditPatch = {}

  const trimmedName = draft.name.trim()
  if (trimmedName && trimmedName !== current.name) {
    patch.name = trimmedName
  }

  const contactChanged =
    draft.website !== (current.contactWebsite ?? '') ||
    draft.facebook !== (current.contactFacebook ?? '') ||
    draft.instagram !== (current.contactInstagram ?? '') ||
    draft.phone !== (current.contactPhone ?? '') ||
    draft.email !== (current.contactEmail ?? '')
  if (contactChanged) {
    patch.contact = {
      website: draft.website || null,
      facebook: draft.facebook || null,
      instagram: draft.instagram || null,
      phone: draft.phone || null,
      email: draft.email || null,
    }
  }

  const addressChanged =
    draft.street !== (current.street ?? '') ||
    draft.zipCode !== (current.zipCode ?? '') ||
    draft.city !== (current.city ?? '')
  if (addressChanged) {
    patch.address = {
      street: draft.street || null,
      zipCode: draft.zipCode || null,
      city: draft.city || null,
    }
  }

  const locationChanged = draft.latitude !== current.latitude || draft.longitude !== current.longitude
  if (locationChanged && draft.latitude != null && draft.longitude != null) {
    patch.location = { latitude: draft.latitude, longitude: draft.longitude }
  }

  if (draft.hoursTouched) {
    const normalised = draft.weeklyRules
      .filter((r) => r.dayOfWeek != null)
      .map((r) => ({
        type: r.type,
        dayOfWeek: r.dayOfWeek,
        anchorDate: r.anchorDate,
        openTime: r.openTime.length === 5 ? `${r.openTime}:00` : r.openTime,
        closeTime: r.closeTime.length === 5 ? `${r.closeTime}:00` : r.closeTime,
      }))
    patch.openingHourRules = normalised
  }

  return patch
}
