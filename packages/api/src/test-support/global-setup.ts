import '../data-access/load-env.js';
import { migrateToLatest } from '../data-access/migrate-to-latest.js';
import { requireEnv } from '../data-access/db.js';

export default async function setup(): Promise<void> {
  await migrateToLatest(requireEnv('TEST_DATABASE_URL'));
}
