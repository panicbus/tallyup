import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { phoneSchema } from '@tallyup/shared';
import { confirmCheckin, listPendingCheckins } from '../services/check-in.js';
import { redeem } from '../services/redemption.js';
import { getCheckinStatus } from '../services/checkin-status.js';
import { requireStaff } from './require-staff.js';
import {
  ownerByCustomerParam,
  ownerByPendingCheckinParam,
  ownerBySlugParam,
  requireOwnership,
} from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const createPendingCheckinBodySchema = z.object({ phone: phoneSchema });

export async function checkInRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.get('/businesses/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const business = await deps.checkInPort.findBusinessBySlug(slug);
    if (!business) {
      return reply.code(404).send({ error: 'business_not_found' });
    }

    return reply.code(200).send(business);
  });

  app.post(
    '/businesses/:slug/pending-checkins',
    // Public, unauthenticated, and the one place a phone number can be
    // probed by trying arbitrary values — rate-limited per IP.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
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
    },
  );

  app.get('/pending-checkins/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string };

    const result = await getCheckinStatus(deps.checkInPort, id);

    if (result.status === 'not_found') {
      return reply.code(404).send({ error: 'not_found' });
    }

    return reply.code(200).send(result);
  });

  app.get(
    '/businesses/:slug/pending-checkins',
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      // Past the guard, the slug's business is the caller's own business.
      const queue = await listPendingCheckins(deps.checkInPort, request.staff!.business.id);
      return reply.code(200).send(queue);
    },
  );

  app.post(
    '/pending-checkins/:id/confirm',
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerByPendingCheckinParam)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await confirmCheckin(deps.checkInPort, {
        pendingCheckinId: id,
        confirmedBy: request.staff!.id,
      });

      // Still reachable with the guard passed: the row exists and is owned,
      // but was already confirmed or has expired. That's the fraud gate's
      // own outcome, not an ownership question.
      if (result.outcome === 'not_found') {
        return reply.code(404).send({ error: 'not_found' });
      }

      return reply.code(200).send(result);
    },
  );

  app.post(
    '/customers/:id/redeem',
    // missing: 'allow' — an unknown customer id must stay a 409 not_eligible,
    // indistinguishable by design from "insufficient points", never a 404.
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerByCustomerParam, { missing: 'allow' })] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await redeem(deps.checkInPort, {
        customerId: id,
        confirmedBy: request.staff!.id,
      });

      if (result.outcome === 'not_eligible') {
        return reply.code(409).send({ error: 'not_eligible' });
      }

      return reply.code(200).send(result);
    },
  );
}
