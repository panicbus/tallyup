import type { EmailPort } from './email-port.js';

/**
 * Development fallback used when RESEND_API_KEY is unset (see main.ts):
 * prints the message to stdout instead of sending it, so the whole invite
 * flow is exercisable locally with no Resend account. main.ts refuses to
 * fall back to this in production.
 */
export function createConsoleEmailPort(): EmailPort {
  return {
    async send({ to, subject, text }) {
      console.log(`\n--- email (console fallback, not sent) ---\nto: ${to}\nsubject: ${subject}\n\n${text}\n---\n`);
      return { outcome: 'sent' };
    },
  };
}
