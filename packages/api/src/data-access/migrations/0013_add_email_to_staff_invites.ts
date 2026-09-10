import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // Retire every outstanding invite from the old copy-a-code flow before the
  // column that replaces it exists. Those invites can no longer be redeemed
  // once the "join with a code" UI is gone, and setting `redeemed_at` is
  // already this schema's idiom for killing an invite (see revokeInvite in
  // kysely-staff-port.ts). Doing this first means the `''` backfill below is
  // never a live credential -- there is nothing left for it to be attached
  // to. Production pre-flight before this runs: `select count(*) from
  // staff_invites where redeemed_at is null` (10 at time of writing, all
  // from local/manual testing).
  await sql`update staff_invites set redeemed_at = now() where redeemed_at is null`.execute(db);

  // The address the invite was sent to, stored normalized (trimmed +
  // lowercased, see @tallyup/shared normalizeEmail). This, not the code
  // alone, is what authorizes a redemption: the signed-in account's email
  // must match, or redeemInvite returns wrong_account without consuming the
  // invite. The transient default only covers the rows retired above, which
  // can never be redeemed regardless of what it holds.
  await sql`alter table staff_invites add column email text not null default ''`.execute(db);
  await sql`alter table staff_invites alter column email drop default`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // The invite retirements in up() are not reversed -- like 0012's down(),
  // this restores the shape, not the data.
  await sql`alter table staff_invites drop column email`.execute(db);
}
