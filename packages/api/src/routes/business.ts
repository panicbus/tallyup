import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateBusiness } from '../data-access/update-business.js';
import { requireStaff } from './require-staff.js';
import type { AppDependencies } from '../app.js';

const updateBusinessBodySchema = z.object({
  name: z.string().trim().min(1),
  rewardThreshold: z.number().int().positive(),
  rewardDescription: z.string().trim().min(1),
});

export async function businessRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.patch('/businesses/:slug', { preHandler: requireStaff(deps) }, async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsedBody = updateBusinessBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'invalid_body' });
    }

    const business = await deps.checkInPort.findBusinessBySlug(slug);
    if (!business) {
      return reply.code(404).send({ error: 'business_not_found' });
    }
    if (business.id !== request.staff!.business.id) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const updated = await updateBusiness(deps.db, business.id, parsedBody.data);
    return reply.code(200).send(updated);
  });
}
