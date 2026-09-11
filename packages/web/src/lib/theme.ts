// Light/dark mode. Once a visitor picks one from the sun/moon toggle in
// Settings, that choice sticks (no re-checking the OS preference on later
// visits) — same namespaced-key, try/catch-both-ways shape as
// remembered-phone.ts. Anyone who hasn't chosen yet (including customers on
// /checkin or /card, who never see the toggle) gets the OS preference.
export type Theme = 'light' | 'dark';

const THEME_KEY = 'tallyup:theme';

const THEME_COLOR: Record<Theme, string> = {
  light: '#eef1f6',
  dark: '#23303a',
};

function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark';
}

export function loadStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode / storage disabled. The toggle still works for this visit.
  }
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function preferredTheme(): Theme {
  return loadStoredTheme() ?? systemTheme();
}

/** Paints the theme onto the document — the `data-theme` attribute the CSS
 * keys off, plus the mobile browser-chrome tint. Matches the inline script
 * in index.html that runs this same logic before first paint. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}
