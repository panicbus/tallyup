import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneSchema } from './phone.js';

describe('normalizePhone', () => {
  it('normalizes a 10-digit number to E.164', () => {
    expect(normalizePhone('5551234567')).toBe('+15551234567');
  });

  it('strips formatting characters', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
  });

  it('accepts an 11-digit number with a leading 1', () => {
    expect(normalizePhone('15551234567')).toBe('+15551234567');
  });

  it('accepts an already-normalized E.164 number', () => {
    expect(normalizePhone('+15551234567')).toBe('+15551234567');
  });

  it('rejects too few digits', () => {
    expect(normalizePhone('555123')).toBeNull();
  });

  it('rejects too many digits', () => {
    expect(normalizePhone('25551234567')).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(normalizePhone('not a phone')).toBeNull();
  });
});

describe('phoneSchema', () => {
  it('parses and normalizes valid input', () => {
    expect(phoneSchema.parse('(555) 123-4567')).toBe('+15551234567');
  });

  it('rejects invalid input', () => {
    expect(() => phoneSchema.parse('123')).toThrow();
  });
});
