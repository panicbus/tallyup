import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { phoneSchema } from '@tallyup/shared';
import { confirmCheckin } from '../services/check-in.js';
import type { AppDependencies } from '../app.js';

const createPendingCheckinBodySchema = z.object({ phone: phoneSchema });
const confirmBodySchema = z.object({ confirmedBy: z.string().uuid() });

export async function checkInRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.post('/businesses/:slug/pending-checkins', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const parsedBody = createPendingCheckinBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'invalid_phone' });
    }

    const business = await deps.checkInPort.findBusinessBySlug(slug);
    if (!business) {
      return reply.code(404).send({ error: 'business_not_found' });
    }

    const pendingCheckin = await deps.checkInPort.createPendingCheckin({
      businessId: business.id,
      phone: parsedBody.data.phone,
    });

    return reply.code(200).send(pendingCheckin);
  });

  app.post('/pending-checkins/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsedBody = confirmBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'invalid_confirmed_by' });
    }

    const result = await confirmCheckin(deps.checkInPort, {
      pendingCheckinId: id,
      confirmedBy: parsedBody.data.confirmedBy,
    });

    if (result.outcome === 'not_found') {
      return reply.code(404).send({ error: 'not_found' });
    }

    return reply.code(200).send(result);
  });
}
