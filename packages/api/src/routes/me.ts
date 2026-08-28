import type { FastifyInstance } from 'fastify';
import { requireStaff } from './require-staff.js';
import type { AppDependencies } from '../app.js';

export async function meRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.get('/me', { preHandler: requireStaff(deps) }, async (request, reply) => {
    return reply.code(200).send(request.staff);
  });
}
