import type { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';
import { checkInRoutes } from './check-in.js';
import { meRoutes } from './me.js';
import type { AppDependencies } from '../app.js';

export async function registerRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  await app.register(healthRoutes);
  await app.register(checkInRoutes, deps);
  await app.register(meRoutes, deps);
}
