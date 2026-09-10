import './data-access/load-env.js';
import { buildApp } from './app.js';
import { createDb, requireEnv } from './data-access/db.js';
import { createKyselyCheckInPort } from './data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from './data-access/kysely-staff-port.js';
import { createSupabaseAuthPort } from './data-access/supabase-auth-port.js';
import { createResendEmailPort } from './data-access/resend-email-port.js';
import { createConsoleEmailPort } from './data-access/console-email-port.js';
import type { EmailPort } from './data-access/email-port.js';

const db = createDb(requireEnv('DATABASE_URL'));
const authPort = createSupabaseAuthPort(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'));

// Real sender when configured, console fallback otherwise so the invite flow
// works locally with no Resend account. Never fall back in production: crash
// at boot rather than silently dropping every invitation, matching how the
// required DB/auth vars behave.
let emailPort: EmailPort;
if (process.env.RESEND_API_KEY) {
  emailPort = createResendEmailPort(requireEnv('RESEND_API_KEY'), requireEnv('RESEND_FROM'));
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('RESEND_API_KEY is required in production');
} else {
  emailPort = createConsoleEmailPort();
}

// Same URL as CORS_ORIGIN in every real deployment; APP_URL only exists as an
// override for the day CORS_ORIGIN becomes a comma-separated list.
const appUrl = process.env.APP_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = buildApp({
  checkInPort: createKyselyCheckInPort(db),
  staffPort: createKyselyStaffPort(db),
  authPort,
  emailPort,
  db,
  appUrl,
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
