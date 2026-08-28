import './load-env.js';
import { createClient } from '@supabase/supabase-js';
import { createDb, requireEnv } from './db.js';

const DEMO_STAFF_EMAIL = 'demo-staff@example.com';
// Dev-only credential for a throwaway pilot project's Auth server — not a
// production secret, fine to keep in source.
const DEMO_STAFF_PASSWORD = 'tallyup-demo-password';

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

const supabaseAdmin = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'));

// The admin API has no "find by email" — list and search instead. Fine at
// pilot scale (a handful of demo/test users), not how W8's real onboarding
// will provision accounts.
const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
let authUser = existingUsers.users.find((u) => u.email === DEMO_STAFF_EMAIL);

if (!authUser) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_STAFF_EMAIL,
    password: DEMO_STAFF_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error('failed to create demo staff auth user');
  }
  authUser = data.user;
}

// staff.email has no unique constraint (deliberately, see W1 notes), so
// there's no ON CONFLICT target to upsert against — check-then-insert instead.
const existingStaff = await db
  .selectFrom('staff')
  .select('id')
  .where('business_id', '=', business.id)
  .where('email', '=', DEMO_STAFF_EMAIL)
  .executeTakeFirst();

if (existingStaff) {
  await db
    .updateTable('staff')
    .set({ auth_user_id: authUser.id })
    .where('id', '=', existingStaff.id)
    .execute();
} else {
  await db
    .insertInto('staff')
    .values({ business_id: business.id, email: DEMO_STAFF_EMAIL, role: 'owner', auth_user_id: authUser.id })
    .execute();
}

await db.destroy();
console.log(`seeded demo business and staff member (${DEMO_STAFF_EMAIL} / ${DEMO_STAFF_PASSWORD})`);
