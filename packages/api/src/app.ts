import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { Kysely } from 'kysely';
import { registerRoutes } from './routes/index.js';
import type { CheckInPort } from './data-access/check-in-port.js';
import type { AuthPort } from './data-access/auth-port.js';
import type { EmailPort } from './data-access/email-port.js';
import type { StaffPort } from './data-access/staff-port.js';
import type { Database } from './data-access/types.js';

export interface AppDependencies {
  checkInPort: CheckInPort;
  authPort: AuthPort;
  staffPort: StaffPort;
  /** Outbound transactional email (staff invitations). Fake in tests. */
  emailPort: EmailPort;
  /** Raw connection, for writes simple enough not to need the port/fake
   * treatment (e.g. onboarding/editing a business) — see
   * data-access/onboarding.ts and data-access/update-business.ts. */
  db: Kysely<Database>;
  /** Public origin of the web app, for building links that land in emails
   * (the invite join link). A value, not a port: nothing calls it. Defaults
   * to CORS_ORIGIN in main.ts, since they are the same URL in every
   * deployment. */
  appUrl: string;
}

export function buildApp(deps: AppDependencies, opts: FastifyServerOptions = {}): FastifyInstance {
  // Render terminates the connection at its own edge, so without this,
  // request.ip resolves to Render's proxy — not the caller — which would
  // silently break both the public check-in route's per-IP rate limit and
  // the SMS consent ledger's recorded IP. Harmless locally: with no
  // X-Forwarded-For header, Fastify just falls back to the socket address.
  const app = Fastify({ logger: true, trustProxy: true, ...opts });
  // web (Vite dev server / deployed Vercel origin) is always a different
  // origin than api, even in local dev — CORS_ORIGIN lets W7's deploy point
  // this at the real Vercel URL without touching code.
  // @fastify/cors defaults to methods: 'GET,HEAD,POST' — PATCH (W8's
  // settings route) needs to be listed explicitly or its preflight fails.
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    methods: ['GET', 'HEAD', 'POST', 'PATCH'],
  });
  // No global limit — most routes are staff-facing (dashboard polling needs
  // headroom) or keyed by an unguessable id. Only the public phone-number
  // submission route opts in, via its own route-level config.
  app.register(rateLimit, { global: false });
  app.register(registerRoutes, deps);
  return app;
}
