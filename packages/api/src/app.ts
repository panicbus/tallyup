import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerRoutes } from './routes/index.js';
import type { CheckInPort } from './data-access/check-in-port.js';

export interface AppDependencies {
  checkInPort: CheckInPort;
}

export function buildApp(deps: AppDependencies, opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...opts });
  app.register(registerRoutes, deps);
  return app;
}
