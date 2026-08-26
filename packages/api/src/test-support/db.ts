import { Kysely } from 'kysely';
import { createDb, requireEnv } from '../data-access/db.js';
import type { Database } from '../data-access/types.js';

// Singleton, shared across all integration test files in this worker
// (the integration project runs singleFork). Not explicitly destroyed —
// `vitest run` exits the process when the suite finishes, which closes the
// pool; explicit per-file teardown here would break sibling files still
// using it.
export const testDb: Kysely<Database> = createDb(requireEnv('TEST_DATABASE_URL'));

class RollbackTransaction extends Error {}

/**
 * Runs `fn` inside a transaction that is always rolled back, regardless of
 * whether `fn` throws. Used as a per-test fixture so integration tests never
 * leave residual data for the next test.
 */
export async function withTestTransaction<T>(
  fn: (trx: Kysely<Database>) => Promise<T>,
): Promise<T> {
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
