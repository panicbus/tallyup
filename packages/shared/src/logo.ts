/** The public Supabase Storage bucket business logos are uploaded to.
 * Shared so the api's URL validator (services/logo-url.ts) and the web's
 * uploader (lib/logo-upload.ts) can't drift on the bucket name independently. */
export const LOGO_BUCKET = 'business-logos';
