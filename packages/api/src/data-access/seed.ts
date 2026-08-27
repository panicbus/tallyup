import './load-env.js';
import { createDb, requireEnv } from './db.js';

const db = createDb(requireEnv('DATABASE_URL'));

// doUpdateSet (rather than doNothing) so RETURNING always yields the row,
// whether this run inserted it or a prior run already did.
const business = await db
  .insertInto('businesses')
  .values({
    name: 'Demo Bookstore',
    slug: 'demo-bookstore',
    reward_threshold: 10,
    reward_description: 'A free used book',
  })
  .onConflict((oc) => oc.column('slug').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
  .returningAll()
  .executeTakeFirstOrThrow();

// staff.email has no unique constraint (deliberately, see W1 notes), so
// there's no ON CONFLICT target to upsert against — check-then-insert instead.
const existingStaff = await db
  .selectFrom('staff')
  .select('id')
  .where('business_id', '=', business.id)
  .where('email', '=', 'demo-staff@example.com')
  .executeTakeFirst();

if (!existingStaff) {
  await db
    .insertInto('staff')
    .values({ business_id: business.id, email: 'demo-staff@example.com', role: 'owner' })
    .execute();
}

await db.destroy();
console.log('seeded demo business and staff member');
