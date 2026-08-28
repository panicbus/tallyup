/**
 * Derives a URL-safe slug from a business name — lowercase, ASCII
 * alphanumerics only, hyphen-separated. Non-ASCII characters (accents,
 * emoji) are dropped rather than transliterated; fine for a slug the owner
 * reviews and can edit before confirming.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
