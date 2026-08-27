import { describe, expect, it } from 'vitest';
import { isEligibleForRedemption } from './eligibility.js';

describe('isEligibleForRedemption', () => {
  it('is not eligible below the threshold', () => {
    expect(isEligibleForRedemption(9, 10)).toBe(false);
  });

  it('is eligible exactly at the threshold', () => {
    expect(isEligibleForRedemption(10, 10)).toBe(true);
  });

  it('is eligible above the threshold', () => {
    expect(isEligibleForRedemption(12, 10)).toBe(true);
  });

  it('is eligible at a multiple of the threshold', () => {
    expect(isEligibleForRedemption(20, 10)).toBe(true);
  });
});
