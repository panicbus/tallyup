/**
 * Masks a phone number for staff-facing display, showing only the last 4
 * digits. Must never round-trip a full number to the browser — every
 * endpoint the staff dashboard reads from applies this before responding.
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `•••-•••-${last4}`;
}
