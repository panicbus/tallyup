const URGENT_WAIT_MS = 90_000;

export function formatWaitTime(createdAt: string, now: number = Date.now()): string {
  const elapsedMs = Math.max(0, now - new Date(createdAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} waiting`;
}

export function isUrgentWait(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() > URGENT_WAIT_MS;
}

/**
 * Progressively formats phone input as a US number, `(555) 123-4567`,
 * while it's being typed. Strips non-digits, drops a leading country-code
 * `1`, caps at 10 digits, and only adds punctuation for the digits
 * present so far. `normalizePhone` (shared) still does the real parsing on
 * submit — this is display only.
 */
export function formatUsPhoneInput(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  digits = digits.slice(0, 10);

  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Fixed locale and UTC, not the viewer's — deterministic across browsers,
 * and anchored to the same timestamp the database stored rather than
 * shifting by whatever timezone the viewer happens to be in. No timezone
 * concept exists anywhere in the schema yet; this is a placeholder until
 * one does, not a considered choice of "always show UTC." */
export function formatJoinedDate(joinedAt: string): string {
  return new Date(joinedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** How a staff member is labelled in the UI: their chosen name, or their
 * email address until they set one. The API stores `name` trimmed-or-null,
 * but the `.trim()` guard here keeps the two call sites (the account menu
 * and the staff roster) from diverging if that ever changes. */
export function staffDisplayName(name: string | null, email: string): string {
  return name && name.trim() ? name.trim() : email;
}
