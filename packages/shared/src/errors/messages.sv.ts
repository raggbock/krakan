import type { ErrorCode } from '../errors'

/**
 * Swedish message catalog for all ErrorCode values.
 *
 * Rules:
 * - Every ErrorCode MUST have an entry (enforced by Record<ErrorCode, string>).
 * - Use {param} placeholders for interpolation (see `interpolate` in errors.ts).
 * - Strings must be plain Swedish — no HTML, no markdown.
 */
export const MESSAGES_SV: Record<ErrorCode, string> = {
  // Booking — date validation
  'booking.date.required': 'Datum krävs',
  'booking.date.invalid_format': 'Ogiltigt datumformat',
  'booking.date.invalid': 'Ogiltigt datum',
  'booking.date.in_past': 'Kan inte boka i det förflutna',
  'booking.date.already_booked': 'Redan bokat detta datum',

  // Booking — business rules
  'booking.market_closed': 'Marknaden är stängd det valda datumet',
  'booking.market_not_found': 'Marknaden hittades inte',
  'booking.table_not_found': 'Bordet hittades inte',
  'booking.not_found': 'Bokningen hittades inte',
  'booking.duplicate': 'Du har redan en bokning för det här bordet. Kolla dina bokningar under ditt konto.',
  'booking.table_unavailable': 'Det här bordet är tyvärr inte längre tillgängligt. Välj ett annat bord eller försök igen senare.',
  'booking.not_pending': 'Bokningen kan inte uppdateras — den är inte längre väntande.',
  'booking.stripe_not_setup': 'Arrangören har inte slutfört sin betalningsregistrering än. Försök igen om en stund eller kontakta arrangören.',

  // Stripe
  'stripe.not_onboarded': 'Arrangören har inte slutfört sin betalningsregistrering än. Försök igen om en stund eller kontakta arrangören.',
  'stripe.capture_failed': 'Betalningen kunde inte genomföras. Kontrollera ditt kort eller prova ett annat betalningssätt.',
  'stripe.card_declined': 'Kortet nekades. Kontrollera kortuppgifterna eller prova ett annat kort.',
  'stripe.authentication_required': 'Din bank kräver extra verifiering. Godkänn betalningen i din bankapp och försök sedan igen.',
  'stripe.network_error': 'Nätverksfel vid betalning. Kontrollera din anslutning och försök igen.',
  'stripe.connect.account_creation_failed': 'Det gick inte att skapa Stripe-konto. Försök igen eller kontakta support.',
  'stripe.connect.no_account': 'Inget Stripe-konto hittades. Påbörja kopplingen på nytt.',

  // Booking — concurrent/state errors
  'booking.invalid_status': 'Ogiltig bokningsstatus angiven.',
  'booking.concurrent_update': 'Bokningen uppdaterades redan av en annan åtgärd. Ladda om sidan och försök igen.',

  // Organizer
  'organizer.fetch_failed': 'Det gick inte att hämta marknadsdata. Försök igen om en liten stund.',

  // Market publication
  'market.cannot_publish_without_hours': 'Loppisen saknar öppettider. Lägg till öppettider innan du publicerar.',

  // Profile
  'profile.not_found': 'Vi hittar ingen profil för dig. Logga ut och in igen, eller kontakta support.',

  // Skyltfönstret subscription
  'skyltfonstret.already_subscribed': 'Du har redan ett aktivt Skyltfönstret-abonnemang.',
  'skyltfonstret.no_subscription': 'Inget Skyltfönstret-abonnemang hittades på ditt konto.',
  'skyltfonstret.config_missing': 'Skyltfönstret är inte korrekt konfigurerat. Kontakta support.',

  // Geo
  'geocode.not_found': 'Vi kunde inte hitta den adressen på kartan. Kontrollera stavningen och försök igen.',

  // Auth / generic
  'auth.required': 'Du behöver logga in för att fortsätta.',
  'auth.forbidden': 'Du har inte behörighet att göra det här.',
  'auth.lookup_failed': 'Det gick inte att hämta dina kontouppgifter. Försök igen om en stund.',
  'input.invalid': 'Några av uppgifterna ser inte rätt ut. Kontrollera fälten och försök igen.',
  unknown: 'Något gick fel. Försök igen om en liten stund.',
}
