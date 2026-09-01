import { LOGO_BUCKET } from '@tallyup/shared';
import { supabaseClient } from './supabase';

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Raster only. SVG is deliberately excluded rather than sanitized — it can
 * carry script, and a shop logo has no need for vector. */
export const ALLOWED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export type UploadLogoResult = { outcome: 'uploaded'; url: string } | { outcome: 'failed'; reason: string };

/**
 * Uploads a logo straight from the browser to Supabase Storage and returns
 * its public URL, which the caller then saves via the API.
 *
 * The object path is `{authUserId}/{uuid}.{ext}` — keyed on the signed-in
 * user, not the business, for two reasons: the storage access policy can
 * then be the stock `(storage.foldername(name))[1] = auth.uid()::text` with
 * no join to our own tables, and the auth user already exists during
 * onboarding, before there's any business to key on.
 *
 * A fresh uuid per upload means URLs are self-cache-busting and a replaced
 * logo never overwrites the bytes the database still points at. The
 * superseded object is left behind on purpose — same stance as expired
 * pending check-ins, which are never cleaned up either.
 */
export async function uploadLogo(file: File): Promise<UploadLogoResult> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type as (typeof ALLOWED_LOGO_TYPES)[number])) {
    return { outcome: 'failed', reason: 'Use a PNG, JPG, or WebP image.' };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { outcome: 'failed', reason: 'That image is over 2MB. Try a smaller one.' };
  }

  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    return { outcome: 'failed', reason: 'You need to be signed in to upload a logo.' };
  }

  const path = `${userId}/${crypto.randomUUID()}.${EXTENSION_BY_TYPE[file.type] ?? 'png'}`;

  const { error } = await supabaseClient.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    return { outcome: 'failed', reason: "Couldn't upload that image. Try again." };
  }

  const { data } = supabaseClient.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return { outcome: 'uploaded', url: data.publicUrl };
}
