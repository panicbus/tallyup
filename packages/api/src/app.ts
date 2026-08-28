import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Kysely } from 'kysely';
import { registerRoutes } from './routes/index.js';
import type { CheckInPort } from './data-access/check-in-port.js';
import type { Database } from './data-access/types.js';

export interface AppDependencies {
  checkInPort: CheckInPort;
  /** Raw connection, for reads simple enough not to need the port/fake
   * treatment (e.g. listing staff) — see data-access/staff.ts. */
  db: Kysely<Database>;
}

export function buildApp(deps: AppDependencies, opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...opts });
  // web (Vite dev server / deployed Vercel origin) is always a different
  // origin than api, even in local dev — CORS_ORIGIN lets W7's deploy point
  // this at the real Vercel URL without touching code.
  app.register(cors, { origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  // No global limit — most routes are staff-facing (dashboard polling needs
  // headroom) or keyed by an unguessable id. Only the public phone-number
  // submission route opts in, via its own route-level config.
  app.register(rateLimit, { global: false });
  app.register(registerRoutes, deps);
  return app;
}
