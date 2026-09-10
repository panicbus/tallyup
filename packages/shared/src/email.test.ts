import { describe, expect, it } from 'vitest';
import { emailSchema, normalizeEmail } from './email.js';

describe('normalizeEmail', () => {
  it('trims surrounding whitespace and lowercases', () => {
    expect(normalizeEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });

  it('leaves an already-normalized address unchanged', () => {
    expect(normalizeEmail('sam@example.com')).toBe('sam@example.com');
  });

  it('lowercases the local part too, matching what Supabase stores', () => {
    expect(normalizeEmail('Sam.Smith+staff@Example.com')).toBe('sam.smith+staff@example.com');
  });
});

describe('emailSchema', () => {
  it('parses and normalizes valid input', () => {
    expect(emailSchema.parse('  Sam@Example.com ')).toBe('sam@example.com');
  });

  it('rejects a string with no at sign', () => {
    expect(() => emailSchema.parse('not-an-email')).toThrow();
  });

  it('rejects an address with nothing before the at sign', () => {
    expect(() => emailSchema.parse('@example.com')).toThrow();
  });

  it('rejects an address with no dot in the domain', () => {
    expect(() => emailSchema.parse('sam@localhost')).toThrow();
  });

  it('rejects an address with whitespace inside it', () => {
    expect(() => emailSchema.parse('sam smith@example.com')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => emailSchema.parse('   ')).toThrow();
  });

  it('rejects an address longer than 254 characters', () => {
    const tooLong = `${'a'.repeat(250)}@example.com`;
    expect(() => emailSchema.parse(tooLong)).toThrow();
  });
});
