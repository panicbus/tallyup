import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { registerRoutes } from './routes/index.js';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: true, ...opts });
  app.register(registerRoutes);
  return app;
}
