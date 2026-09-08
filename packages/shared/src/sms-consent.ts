/**
 * The exact SMS opt-in language shown at check-in, shared so the web
 * checkbox and the api's stored evidence can never drift apart — a customer
 * must see precisely the text that gets recorded as what they agreed to.
 *
 * Versioned by function name, not by parameter: a future translated or
 * reworded version is added as smsConsentLanguageV2 alongside this one,
 * never edited in place. Rows already written store the full rendered
 * string, not a version number, so this stays the true historical record of
 * what v1 actually said even after a v2 exists.
 */
export function smsConsentLanguageV1(businessName: string): string {
  return `By checking this box, you agree to receive text messages from ${businessName} about your loyalty rewards. Message and data rates may apply. Reply STOP to opt out at any time.`;
}
