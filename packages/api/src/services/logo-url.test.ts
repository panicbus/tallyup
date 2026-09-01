import { describe, expect, it } from 'vitest';
import { isOwnLogoUrl, isValidLogoUrlOrAbsent } from './logo-url.js';

const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

function urlFor(userId: string, file = 'a1b2c3.png'): string {
  return `${SUPABASE_URL}/storage/v1/object/public/business-logos/${userId}/${file}`;
}

describe('isOwnLogoUrl', () => {
  it('accepts a well-formed URL in the caller’s own folder', () => {
    expect(isOwnLogoUrl(urlFor(USER_ID), { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(true);
  });

  it('rejects another user’s folder — the whole point of the check', () => {
    expect(isOwnLogoUrl(urlFor(OTHER_USER_ID), { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a foreign host even with an otherwise identical path', () => {
    const evil = `https://evil.example.com/storage/v1/object/public/business-logos/${USER_ID}/a.png`;
    expect(isOwnLogoUrl(evil, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a different bucket', () => {
    const other = `${SUPABASE_URL}/storage/v1/object/public/other-bucket/${USER_ID}/a.png`;
    expect(isOwnLogoUrl(other, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a non-public storage path', () => {
    const signed = `${SUPABASE_URL}/storage/v1/object/sign/business-logos/${USER_ID}/a.png`;
    expect(isOwnLogoUrl(signed, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a path that escapes the folder via traversal', () => {
    const traversal = `${SUPABASE_URL}/storage/v1/object/public/business-logos/${USER_ID}/../${OTHER_USER_ID}/a.png`;
    expect(isOwnLogoUrl(traversal, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects the folder itself, with no file under it', () => {
    const bare = `${SUPABASE_URL}/storage/v1/object/public/business-logos/${USER_ID}/`;
    expect(isOwnLogoUrl(bare, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a folder whose name merely starts with the caller’s id', () => {
    const prefixed = `${SUPABASE_URL}/storage/v1/object/public/business-logos/${USER_ID}-evil/a.png`;
    expect(isOwnLogoUrl(prefixed, { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('rejects a string that is not a URL at all', () => {
    expect(isOwnLogoUrl('not-a-url', { supabaseUrl: SUPABASE_URL, authUserId: USER_ID })).toBe(false);
  });

  it('tolerates a trailing slash on the configured Supabase URL', () => {
    expect(isOwnLogoUrl(urlFor(USER_ID), { supabaseUrl: `${SUPABASE_URL}/`, authUserId: USER_ID })).toBe(true);
  });
});

describe('isValidLogoUrlOrAbsent', () => {
  const ctx = { supabaseUrl: SUPABASE_URL, authUserId: USER_ID };

  it('is valid when the field is omitted (undefined) — nothing to check', () => {
    expect(isValidLogoUrlOrAbsent(undefined, ctx)).toBe(true);
  });

  it('is valid when the field is explicitly null — clearing the logo', () => {
    expect(isValidLogoUrlOrAbsent(null, ctx)).toBe(true);
  });

  it('defers to isOwnLogoUrl when a string is supplied: valid for the caller’s own folder', () => {
    expect(isValidLogoUrlOrAbsent(urlFor(USER_ID), ctx)).toBe(true);
  });

  it('defers to isOwnLogoUrl when a string is supplied: invalid for another user’s folder', () => {
    expect(isValidLogoUrlOrAbsent(urlFor(OTHER_USER_ID), ctx)).toBe(false);
  });
});
