import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, preferredTheme, storeTheme, type Theme } from '../lib/theme';

/** Sun/moon toggle for light vs. dark mode. Owns the applied theme itself
 * (applies on mount too, so the page matches even if the pre-paint script
 * in index.html and this component ever disagree) and remembers the choice
 * for next visit. Lives in Settings since it's a personal preference open
 * to owners and staff alike, not a business setting. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => preferredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    storeTheme(next);
  }

  return (
    <button
      type="button"
      className="btn btn-icon btn-secondary"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
