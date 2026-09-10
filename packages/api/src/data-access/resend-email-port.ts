import type { EmailPort } from './email-port.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// A hung outbound call on a free Render dyno holds the owner's request open
// and ties up a socket. Fail fast and let the caller compensate.
const SEND_TIMEOUT_MS = 10_000;

/**
 * Thin wrapper over Resend's REST API — a plain `fetch`, no SDK dependency.
 * Not unit tested directly (same bucket as the Supabase auth port); the
 * in-memory fake covers callers and step 14 verifies this against the real
 * service. Config is arguments, never `process.env` — main.ts reads the env.
 *
 * @param from a full From header, e.g. `TallyUp <invites@hellotallyup.com>`
 */
export function createResendEmailPort(apiKey: string, from: string): EmailPort {
  return {
    async send({ to, subject, html, text }) {
      try {
        const response = await fetch(RESEND_ENDPOINT, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ from, to, subject, html, text }),
          signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
        });

        if (!response.ok) {
          // Resend returns a JSON error body; keep it for our logs only.
          const detail = await response.text().catch(() => '');
          return { outcome: 'failed', reason: `resend ${response.status}: ${detail.slice(0, 200)}` };
        }

        return { outcome: 'sent' };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown send error';
        return { outcome: 'failed', reason };
      }
    },
  };
}
