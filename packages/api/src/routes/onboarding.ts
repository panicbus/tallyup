import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createBusinessWithOwner } from '../data-access/onboarding.js';
import { requireAuthenticatedIdentity } from './require-staff.js';
import type { AppDependencies } from '../app.js';

const createBusinessBodySchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, alphanumeric, hyphen-separated'),
  rewardThreshold: z.number().int().positive(),
  rewardDescription: z.string().trim().min(1),
});

export async function onboardingRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.post('/businesses', { preHandler: requireAuthenticatedIdentity(deps) }, async (request, reply) => {
    const parsedBody = createBusinessBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({ error: 'invalid_body' });
    }

    const result = await createBusinessWithOwner(deps.db, {
      ...parsedBody.data,
      authUserId: request.identity!.userId,
      email: request.identity!.email,
    });

    if (result.outcome === 'slug_taken') {
      return reply.code(409).send({ error: 'slug_taken' });
    }
    if (result.outcome === 'already_onboarded') {
      return reply.code(409).send({ error: 'already_onboarded' });
    }

    return reply.code(201).send(result);
  });
}
