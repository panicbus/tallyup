import { describe, expect, it } from 'vitest';
import { maskPhone } from './phone-masking.js';

describe('maskPhone', () => {
  it('shows only the last 4 digits of an E.164 number', () => {
    expect(maskPhone('+15551234567')).toBe('•••-•••-4567');
  });

  it('works regardless of leading formatting', () => {
    expect(maskPhone('15551234567')).toBe('•••-•••-4567');
  });
});
