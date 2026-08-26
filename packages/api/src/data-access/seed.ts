import './load-env.js';
import { createDb, requireEnv } from './db.js';

const db = createDb(requireEnv('DATABASE_URL'));

await db
  .insertInto('businesses')
  .values({
    name: 'Demo Bookstore',
    slug: 'demo-bookstore',
    reward_threshold: 10,
    reward_description: 'A free used book',
  })
  .onConflict((oc) => oc.column('slug').doNothing())
  .execute();

await db.destroy();
console.log('seeded demo business');
