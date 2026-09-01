import { LOGO_BUCKET } from '@tallyup/shared';

export interface LogoUrlContext {
  /** The project's Supabase base URL, e.g. https://abcdefgh.supabase.co */
  supabaseUrl: string;
  /** The caller's verified Supabase Auth user id. */
  authUserId: string;
}

/**
 * Whether a client-supplied logo URL points at an object in *this* project's
 * public logo bucket, inside *this* caller's own folder.
 *
 * This is the trust boundary for the whole feature. Logo bytes never pass
 * through the API — the browser uploads straight to Supabase Storage and
 * hands back a URL — so without this check a staff member could record an
 * arbitrary external host, or another shop's object, as their logo.
 *
 * Pure and dependency-free (an S1 seam): the Supabase URL is passed in
 * rather than read from the environment, so it stays trivially testable.
 */
export function isOwnLogoUrl(candidate: string, { supabaseUrl, authUserId }: LogoUrlContext): boolean {
  let url: URL;
  let base: URL;
  try {
    url = new URL(candidate);
    base = new URL(supabaseUrl);
  } catch {
    return false;
  }

  if (url.origin !== base.origin) return false;

  // Compare against the *parsed* pathname, which has already resolved any
  // `..` segments — a raw string prefix check would let traversal through.
  const prefix = `/storage/v1/object/public/${LOGO_BUCKET}/${authUserId}/`;
  if (!url.pathname.startsWith(prefix)) return false;

  // Something must actually follow the folder, and it must be a single
  // path segment — no nesting, no empty filename.
  const objectName = url.pathname.slice(prefix.length);
  return objectName.length > 0 && !objectName.includes('/');
}

/**
 * The full guard both business.ts and onboarding.ts need on their logoUrl
 * body field: true when there's nothing to check (the field was omitted or
 * explicitly null — the route's own logic decides what that means) or the
 * supplied string is the caller's own object; false only when a string was
 * supplied and isOwnLogoUrl rejects it — the one case both routes 400 on.
 */
export function isValidLogoUrlOrAbsent(logoUrl: unknown, ctx: LogoUrlContext): boolean {
  if (typeof logoUrl !== 'string') return true;
  return isOwnLogoUrl(logoUrl, ctx);
}
