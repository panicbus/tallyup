import { z } from 'zod';

const TEN_DIGITS = /^\d{10}$/;

/**
 * Normalizes US phone number input to E.164 (+1XXXXXXXXXX). Returns null
 * for anything that isn't a plausible 10-digit US number (with or without
 * a leading country code / formatting characters).
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;

  if (!TEN_DIGITS.test(tenDigits)) {
    return null;
  }

  return `+1${tenDigits}`;
}

export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value);
  if (!normalized) {
    ctx.addIssue({ code: 'custom', message: 'Invalid US phone number' });
    return z.NEVER;
  }
  return normalized;
});
