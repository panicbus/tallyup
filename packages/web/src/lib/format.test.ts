import { describe, expect, it } from 'vitest';
import { formatJoinedDate, formatUsPhoneInput, formatWaitTime, isUrgentWait, staffDisplayName } from './format';

describe('staffDisplayName', () => {
  it('uses the name when one is set', () => {
    expect(staffDisplayName('Riley', 'riley@example.com')).toBe('Riley');
  });

  it('falls back to the email when the name is null', () => {
    expect(staffDisplayName(null, 'riley@example.com')).toBe('riley@example.com');
  });

  it('falls back to the email when the name is blank or whitespace', () => {
    expect(staffDisplayName('', 'riley@example.com')).toBe('riley@example.com');
    expect(staffDisplayName('   ', 'riley@example.com')).toBe('riley@example.com');
  });

  it('trims a name with surrounding whitespace', () => {
    expect(staffDisplayName('  Riley  ', 'riley@example.com')).toBe('Riley');
  });
});

describe('formatWaitTime', () => {
  it('formats under a minute as 0:SS waiting', () => {
    const now = Date.parse('2026-01-01T00:00:24Z');
    const createdAt = '2026-01-01T00:00:00Z';
    expect(formatWaitTime(createdAt, now)).toBe('0:24 waiting');
  });

  it('formats minutes and seconds, zero-padding seconds under 10', () => {
    const now = Date.parse('2026-01-01T00:03:12Z');
    const createdAt = '2026-01-01T00:00:00Z';
    expect(formatWaitTime(createdAt, now)).toBe('3:12 waiting');
  });

  it('never goes negative for a createdAt in the future (clock skew)', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const createdAt = '2026-01-01T00:00:05Z';
    expect(formatWaitTime(createdAt, now)).toBe('0:00 waiting');
  });
});

describe('isUrgentWait', () => {
  it('is not urgent under 90 seconds', () => {
    const now = Date.parse('2026-01-01T00:01:29Z');
    const createdAt = '2026-01-01T00:00:00Z';
    expect(isUrgentWait(createdAt, now)).toBe(false);
  });

  it('is urgent past 90 seconds', () => {
    const now = Date.parse('2026-01-01T00:01:31Z');
    const createdAt = '2026-01-01T00:00:00Z';
    expect(isUrgentWait(createdAt, now)).toBe(true);
  });
});

describe('formatUsPhoneInput', () => {
  it('is empty until the first digit', () => {
    expect(formatUsPhoneInput('')).toBe('');
    expect(formatUsPhoneInput('(')).toBe('');
  });

  it('wraps the area code in parens as it is typed', () => {
    expect(formatUsPhoneInput('5')).toBe('(5');
    expect(formatUsPhoneInput('555')).toBe('(555');
    expect(formatUsPhoneInput('5551')).toBe('(555) 1');
  });

  it('adds the dash once the exchange is complete', () => {
    expect(formatUsPhoneInput('555123')).toBe('(555) 123');
    expect(formatUsPhoneInput('5551234567')).toBe('(555) 123-4567');
  });

  it('reformats already-punctuated input', () => {
    expect(formatUsPhoneInput('555-123-4567')).toBe('(555) 123-4567');
    expect(formatUsPhoneInput('(555) 123-4567')).toBe('(555) 123-4567');
  });

  it('drops a leading country-code 1 and caps at 10 digits', () => {
    expect(formatUsPhoneInput('15551234567')).toBe('(555) 123-4567');
    expect(formatUsPhoneInput('555123456789')).toBe('(555) 123-4567');
  });
});

describe('formatJoinedDate', () => {
  it('formats an ISO timestamp as a short, human date', () => {
    expect(formatJoinedDate('2026-03-05T00:00:00Z')).toBe('Mar 5, 2026');
  });

  it('is anchored to UTC, not the viewer\'s timezone, so a near-midnight time never shifts calendar day', () => {
    expect(formatJoinedDate('2026-03-05T23:30:00Z')).toBe('Mar 5, 2026');
  });
});
