import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateBusiness } from '../data-access/update-business.js';
import { requireStaff } from './require-staff.js';
import { ownerBySlugParam, requireOwnership } from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const updateBusinessBodySchema = z.object({
  name: z.string().trim().min(1),
  rewardThreshold: z.number().int().positive(),
  rewardDescription: z.string().trim().min(1),
});

export async function businessRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.patch(
    '/businesses/:slug',
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      const parsedBody = updateBusinessBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      // Past the guard, the slug's business is the caller's own business.
      const updated = await updateBusiness(deps.db, request.staff!.business.id, parsedBody.data);
      return reply.code(200).send(updated);
    },
  );
}
