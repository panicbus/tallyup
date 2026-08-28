import './data-access/load-env.js';
import { buildApp } from './app.js';
import { createDb, requireEnv } from './data-access/db.js';
import { createKyselyCheckInPort } from './data-access/kysely-check-in-port.js';
import { createKyselyStaffPort } from './data-access/staff-port.js';
import { createSupabaseAuthPort } from './data-access/supabase-auth-port.js';

const db = createDb(requireEnv('DATABASE_URL'));
const authPort = createSupabaseAuthPort(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'));
const app = buildApp({ checkInPort: createKyselyCheckInPort(db), staffPort: createKyselyStaffPort(db), authPort });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
