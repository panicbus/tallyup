import path from 'node:path';

// Scripts run via `npm run <script> -w @tallyup/api` get a cwd of
// packages/api, but .env lives at the repo root — resolve relative to this
// file's location instead of relying on process.loadEnvFile()'s cwd default.
const rootEnvPath = path.join(import.meta.dirname, '../../../../.env');

try {
  process.loadEnvFile(rootEnvPath);
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
    throw err;
  }
  // No .env file (e.g. CI, where real env vars are injected directly) — fine.
}
