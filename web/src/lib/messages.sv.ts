import type { AppError, ErrorCode } from '@fyndstigen/shared'

/**
 * Swedish message catalog for AppError codes.
 *
 * Every ErrorCode MUST have an entry. The exhaustive `Record<ErrorCode, ...>`
 * type makes it a compile error to add a new code without also adding a
 * message here.
 */
export const MESSAGES: Record<ErrorCode, (detail?: AppError['detail']) => string> = {
  'booking.duplicate': () =>
    'Du har redan en bokning för det här bordet. Kolla dina bokningar under ditt konto.',
  'booking.table_unavailable': () =>
    'Det här bordet är tyvärr inte längre tillgängligt. Välj ett annat bord eller försök igen senare.',
  'stripe.not_onboarded': () =>
    'Arrangören har inte slutfört sin betalningsregistrering än. Försök igen om en stund eller kontakta arrangören.',
  'stripe.capture_failed': () =>
    'Betalningen kunde inte genomföras. Kontrollera ditt kort eller prova ett annat betalningssätt.',
  'geocode.not_found': () =>
    'Vi kunde inte hitta den adressen på kartan. Kontrollera stavningen och försök igen.',
  'auth.required': () => 'Du behöver logga in för att fortsätta.',
  'input.invalid': () => 'Några av uppgifterna ser inte rätt ut. Kontrollera fälten och försök igen.',
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
