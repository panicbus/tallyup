import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, loadStoredTheme, preferredTheme, storeTheme, systemTheme } from './theme';

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  describe('loadStoredTheme / storeTheme', () => {
    it('returns null when nothing has been chosen yet', () => {
      expect(loadStoredTheme()).toBeNull();
    });

    it('round-trips a stored choice', () => {
      storeTheme('dark');

      expect(loadStoredTheme()).toBe('dark');
    });

    it('ignores a corrupted stored value instead of returning it', () => {
      localStorage.setItem('tallyup:theme', 'sepia');

      expect(loadStoredTheme()).toBeNull();
    });

    describe('when storage throws (private mode / disabled)', () => {
      let getSpy: ReturnType<typeof vi.spyOn>;
      let setSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
          throw new Error('storage disabled');
        });
        setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('storage disabled');
        });
      });

      afterEach(() => {
        getSpy.mockRestore();
        setSpy.mockRestore();
      });

      it('load falls back to null instead of throwing', () => {
        expect(loadStoredTheme()).toBeNull();
      });

      it('store silently no-ops instead of throwing', () => {
        expect(() => storeTheme('dark')).not.toThrow();
      });
    });
  });

  // jsdom doesn't implement window.matchMedia at all (it's undefined, not a
  // stub), so there's nothing for vi.spyOn to attach to — assign it
  // directly instead, and delete it afterward to restore that same
  // "unavailable" baseline other tests (and the real fallback path) rely on.
  describe('systemTheme', () => {
    afterEach(() => {
      // @ts-expect-error -- deleting a property jsdom never defined
      delete window.matchMedia;
    });

    it('reports dark when the OS prefers dark', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      expect(systemTheme()).toBe('dark');
    });

    it('reports light when the OS prefers light', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      expect(systemTheme()).toBe('light');
    });

    it('falls back to light if matchMedia is unavailable (older WebViews)', () => {
      window.matchMedia = vi.fn().mockImplementation(() => {
        throw new Error('matchMedia unsupported');
      });

      expect(systemTheme()).toBe('light');
    });
  });

  describe('preferredTheme', () => {
    afterEach(() => {
      // @ts-expect-error -- deleting a property jsdom never defined
      delete window.matchMedia;
    });

    it('prefers a stored choice over the system preference', () => {
      storeTheme('dark');
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });

      expect(preferredTheme()).toBe('dark');
    });

    it('falls back to the system preference when nothing is stored', () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: true });

      expect(preferredTheme()).toBe('dark');
    });
  });

  describe('applyTheme', () => {
    it('sets data-theme on the document element', () => {
      applyTheme('dark');

      expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('updates the theme-color meta tag to match', () => {
      const meta = document.createElement('meta');
      meta.setAttribute('name', 'theme-color');
      meta.setAttribute('content', '#eef1f6');
      document.head.appendChild(meta);

      applyTheme('dark');

      expect(meta.getAttribute('content')).toBe('#23303a');
      document.head.removeChild(meta);
    });

    it('does not throw when the theme-color meta tag is absent', () => {
      expect(() => applyTheme('light')).not.toThrow();
    });
  });
});
