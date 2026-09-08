import { describe, expect, it } from 'vitest';
import { smsConsentLanguageV1 } from './sms-consent.js';

describe('smsConsentLanguageV1', () => {
  it('names the business, not TallyUp — consent runs to the sender', () => {
    expect(smsConsentLanguageV1("Nico's Bookstore")).toContain("Nico's Bookstore");
  });

  it('states the opt-out method', () => {
    expect(smsConsentLanguageV1('Test Shop')).toMatch(/stop/i);
  });

  it('is deterministic — the same business name always renders the same text', () => {
    expect(smsConsentLanguageV1('Test Shop')).toBe(smsConsentLanguageV1('Test Shop'));
  });
});
