import type { AppError, ErrorCode } from '@fyndstigen/shared'

/**
 * Swedish message catalog for AppError codes — WEB LAYER (transitional).
 *
 * The CANONICAL catalog is `packages/shared/src/errors/messages.sv.ts`.
 * This file predates the shared catalog and will be collapsed into it in
 * a follow-up. For now, both exist; new codes should go in the shared
 * catalog first, and only be added here if the web surface needs a
 * UI-specific override.
 */
export const MESSAGES: Record<ErrorCode, (detail?: AppError['detail']) => string> = {
  // --- Booking: date validation ---
  'booking.date.required': () => 'Datum krävs',
  'booking.date.invalid_format': () => 'Ogiltigt datumformat',
  'booking.date.invalid': () => 'Ogiltigt datum',
  'booking.date.in_past': () => 'Kan inte boka i det förflutna',
  'booking.date.already_booked': () => 'Redan bokat detta datum',

  // --- Booking: business rules ---
  'booking.market_closed': () => 'Marknaden är stängd det valda datumet',
  'booking.market_not_found': () => 'Marknaden hittades inte',
  'booking.table_not_found': () => 'Bordet hittades inte',
  'booking.not_found': () => 'Bokningen hittades inte',
  'booking.duplicate': () =>
    'Du har redan en bokning för det här bordet. Kolla dina bokningar under ditt konto.',
  'booking.table_unavailable': () =>
    'Det här bordet är tyvärr inte längre tillgängligt. Välj ett annat bord eller försök igen senare.',
  'booking.not_pending': () =>
    'Bokningen kan inte uppdateras — den är inte längre väntande.',
  'booking.stripe_not_setup': () =>
    'Arrangören har inte slutfört sin betalningsregistrering än. Försök igen om en stund eller kontakta arrangören.',

  // --- Stripe ---
  'stripe.not_onboarded': () =>
    'Arrangören har inte slutfört sin betalningsregistrering än. Försök igen om en stund eller kontakta arrangören.',
  'stripe.capture_failed': () =>
    'Betalningen kunde inte genomföras. Kontrollera ditt kort eller prova ett annat betalningssätt.',
  'stripe.card_declined': () =>
    'Kortet nekades. Kontrollera kortuppgifterna eller prova ett annat kort.',
  'stripe.authentication_required': () =>
    'Din bank kräver extra verifiering. Godkänn betalningen i din bankapp och försök sedan igen.',
  'stripe.network_error': () =>
    'Nätverksfel vid betalning. Kontrollera din anslutning och försök igen.',

  // --- Geo ---
  'geocode.not_found': () =>
    'Vi kunde inte hitta den adressen på kartan. Kontrollera stavningen och försök igen.',

  // --- Auth / generic ---
  'auth.required': () => 'Du behöver logga in för att fortsätta.',
  'input.invalid': () =>
    'Några av uppgifterna ser inte rätt ut. Kontrollera fälten och försök igen.',
  unknown: () => 'Något gick fel. Försök igen om en liten stund.',
}

/**
 * Look up a Swedish message for an AppError. Falls back to the `unknown`
 * message if the code is not in the catalog (should be impossible given
 * the exhaustive type, but defensive at runtime).
 */
export function messageFor(err: AppError): string {
  const template = MESSAGES[err.code] ?? MESSAGES.unknown
  return template(err.detail)
}
