// Shared enum / union types used by both DB rows and domain views.
// Kept in a separate file to avoid circular imports.

export type RuleType = 'weekly' | 'biweekly' | 'date'

export type BookingStatus = 'pending' | 'confirmed' | 'denied' | 'cancelled'

export type PaymentStatus =
  | 'requires_capture'
  | 'requires_payment'
  | 'captured'
  | 'cancelled'
  | 'failed'
  | 'free'
