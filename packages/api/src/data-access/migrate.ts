import './load-env.js';
import { migrateToLatest } from './migrate-to-latest.js';
import { requireEnv } from './db.js';

await migrateToLatest(requireEnv('DATABASE_URL'));
console.log('migrations up to date');
