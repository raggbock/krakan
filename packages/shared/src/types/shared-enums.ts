// Central home for enum-like string unions shared by both the DB-row and
// domain-view layers. Importing here keeps db.ts and domain.ts from depending
// on each other (triangulation, not a cycle).

export type RuleType = 'weekly' | 'biweekly' | 'date'

export type BookingStatus = 'pending' | 'confirmed' | 'denied' | 'cancelled'

export type PaymentStatus =
  | 'requires_capture'
  | 'requires_payment'
  | 'captured'
  | 'cancelled'
  | 'failed'
  | 'free'
