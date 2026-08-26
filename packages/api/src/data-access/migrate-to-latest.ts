import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FileMigrationProvider, Migrator } from 'kysely/migration';
import { createDb } from './db.js';

const migrationFolder = path.join(import.meta.dirname, 'migrations');

export async function migrateToLatest(connectionString: string): Promise<void> {
  const db = createDb(connectionString);

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({ fs, path, migrationFolder }),
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === 'Error') {
      console.error(`failed to execute migration "${result.migrationName}"`);
    }
  }

  await db.destroy();

  if (error) {
    throw error;
  }
}
