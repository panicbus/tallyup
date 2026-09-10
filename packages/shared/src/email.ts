import { z } from 'zod';

// Deliberately loose: a local part, an @, a domain with at least one dot, and
// no whitespace anywhere. Not RFC 5322 (nothing short of a parser is), just
// enough to reject fat-finger input before it becomes an invite nobody can
// ever redeem. Real validation is the recipient clicking the link.
const PLAUSIBLE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The RFC 5321 ceiling on a full address. Anything longer is not a real
// mailbox and would just bloat the row.
const MAX_EMAIL_LENGTH = 254;

/**
 * Trims and lowercases an email address. Supabase lowercases addresses on its
 * side, so the value we later compare against (`identity.email`) is already
 * lower; matching that normalization is the actual requirement here, not
 * strict RFC handling of the local part.
 */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export const emailSchema = z.string().transform((value, ctx) => {
  const normalized = normalizeEmail(value);
  if (normalized.length > MAX_EMAIL_LENGTH || !PLAUSIBLE_EMAIL.test(normalized)) {
    ctx.addIssue({ code: 'custom', message: 'Invalid email address' });
    return z.NEVER;
  }
  return normalized;
});
