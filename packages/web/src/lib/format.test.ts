import { describe, expect, it } from 'vitest';
import { formatJoinedDate, formatWaitTime, isUrgentWait } from './format';

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

describe('formatJoinedDate', () => {
  it('formats an ISO timestamp as a short, human date', () => {
    expect(formatJoinedDate('2026-03-05T00:00:00Z')).toBe('Mar 5, 2026');
  });

  it('is anchored to UTC, not the viewer\'s timezone, so a near-midnight time never shifts calendar day', () => {
    expect(formatJoinedDate('2026-03-05T23:30:00Z')).toBe('Mar 5, 2026');
  });
});
