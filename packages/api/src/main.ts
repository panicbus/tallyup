import './data-access/load-env.js';
import { buildApp } from './app.js';
import { createDb, requireEnv } from './data-access/db.js';
import { createKyselyCheckInPort } from './data-access/kysely-check-in-port.js';

const db = createDb(requireEnv('DATABASE_URL'));
const app = buildApp({ checkInPort: createKyselyCheckInPort(db), db });

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

app.listen({ port, host }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
