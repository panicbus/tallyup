import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetRememberedPhone, loadRememberedPhone, rememberPhone } from './remembered-phone';

describe('remembered-phone', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when nothing has been remembered yet', () => {
    expect(loadRememberedPhone()).toBeNull();
  });

  it('round-trips a remembered number', () => {
    rememberPhone('+15551234567');

    expect(loadRememberedPhone()).toBe('+15551234567');
  });

  it('overwrites an earlier remembered number, not appends', () => {
    rememberPhone('+15551234567');
    rememberPhone('+15559998888');

    expect(loadRememberedPhone()).toBe('+15559998888');
  });

  it('forgetting clears it back to null', () => {
    rememberPhone('+15551234567');

    forgetRememberedPhone();

    expect(loadRememberedPhone()).toBeNull();
  });

  describe('when storage throws (private mode / disabled)', () => {
    let getSpy: ReturnType<typeof vi.spyOn>;
    let setSpy: ReturnType<typeof vi.spyOn>;
    let removeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
    });

    afterEach(() => {
      getSpy.mockRestore();
      setSpy.mockRestore();
      removeSpy.mockRestore();
    });

    it('load falls back to null instead of throwing', () => {
      expect(loadRememberedPhone()).toBeNull();
    });

    it('remember silently no-ops instead of throwing', () => {
      expect(() => rememberPhone('+15551234567')).not.toThrow();
    });

    it('forget silently no-ops instead of throwing', () => {
      expect(() => forgetRememberedPhone()).not.toThrow();
    });
  });
});
