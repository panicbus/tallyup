import { test as base } from 'vitest';
import { Kysely } from 'kysely';
import { createDb, requireEnv } from '../data-access/db.js';
import type { Database } from '../data-access/types.js';

// Singleton, shared across all integration test files in this worker
// (the integration project runs singleFork). Not explicitly destroyed —
// `vitest run` exits the process when the suite finishes, which closes the
// pool; explicit per-file teardown here would break sibling files still
// using it.
const testDb: Kysely<Database> = createDb(requireEnv('TEST_DATABASE_URL'));

class RollbackTransaction extends Error {}

/**
 * Runs `fn` inside a transaction that is always rolled back, regardless of
 * whether `fn` throws. Internal to this module — the `db` fixture below is
 * the only sanctioned way to get a test-scoped transaction; nothing outside
 * this file should reach for this directly.
 */
async function withTestTransaction<T>(fn: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
  let result: T | undefined;

  await testDb
    .transaction()
    .execute(async (trx) => {
      result = await fn(trx);
      throw new RollbackTransaction();
    })
    .catch((err) => {
      if (!(err instanceof RollbackTransaction)) {
        throw err;
      }
    });

  return result as T;
}

/**
 * `test` extended with a `db` fixture: a Kysely instance scoped to a
 * transaction that is rolled back after the test, regardless of outcome.
 */
export const test = base.extend<{ db: Kysely<Database> }>({
  db: async ({}, use) => {
    await withTestTransaction(async (trx) => {
      await use(trx);
    });
  },
});

export { expect, describe } from 'vitest';
