// Which phone number (E.164) this device last looked up its punch cards
// with, so returning to /card works without retyping. Same namespaced-key,
// try/catch-both-ways shape as the SMS-consent ledger in CheckIn.tsx, just
// one key globally rather than one per shop — the lookup itself is
// cross-shop.
const REMEMBERED_PHONE_KEY = 'tallyup:card-phone';

export function loadRememberedPhone(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_PHONE_KEY);
  } catch {
    return null;
  }
}

export function rememberPhone(e164: string): void {
  try {
    localStorage.setItem(REMEMBERED_PHONE_KEY, e164);
  } catch {
    // Private mode / storage disabled. The page still works for this visit,
    // it just won't come straight back next time.
  }
}

export function forgetRememberedPhone(): void {
  try {
    localStorage.removeItem(REMEMBERED_PHONE_KEY);
  } catch {
    // Nothing to clean up if storage was never reachable to begin with.
  }
}
