import { test as base } from 'vitest';
import type { Kysely } from 'kysely';
import type { Database } from '../data-access/types.js';
import { withTestTransaction } from './db.js';

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
