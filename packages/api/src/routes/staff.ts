import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getStaffRoster } from '../services/staff-management.js';
import { requireAuthenticatedIdentity, requireStaff } from './require-staff.js';
import { requireOwner } from './require-owner.js';
import { ownerByStaffIdParam, ownerBySlugParam, requireOwnership } from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const staffRoleSchema = z.enum(['owner', 'staff']);
const createInviteBodySchema = z.object({ role: staffRoleSchema });
const redeemInviteBodySchema = z.object({ code: z.string().trim().min(1) });

export async function staffRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.post(
    '/businesses/:slug/invites',
    { preHandler: [requireStaff(deps), requireOwner, requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      const parsedBody = createInviteBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      const invite = await deps.staffPort.createInvite({
        businessId: request.staff!.business.id,
        role: parsedBody.data.role,
        createdBy: request.staff!.id,
      });

      return reply.code(201).send(invite);
    },
  );

  app.get(
    '/businesses/:slug/staff',
    // All staff, not owner-only — per-route decision, distinct from the
    // invite/deactivate routes below. Redaction for non-owners happens in
    // the service, not here.
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      const roster = await getStaffRoster(deps.staffPort, {
        businessId: request.staff!.business.id,
        callerRole: request.staff!.role,
      });
      return reply.code(200).send(roster);
    },
  );

  app.post(
    '/staff/:id/deactivate',
    // No :slug in this path, matching /customers/:id/redeem and
    // /pending-checkins/:id/confirm — tenant isolation comes entirely from
    // ownerByStaffIdParam resolving the target's actual business, not from
    // a slug in the URL that would otherwise be purely decorative.
    { preHandler: [requireStaff(deps), requireOwner, requireOwnership(deps, ownerByStaffIdParam)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await deps.staffPort.deactivateStaff({ staffId: id, deactivatedBy: request.staff!.id });

      if (result.outcome === 'not_found') {
        return reply.code(404).send({ error: 'not_found' });
      }
      if (result.outcome === 'last_owner') {
        return reply.code(409).send({ error: 'last_owner' });
      }
      return reply.code(200).send(result);
    },
  );

  app.post(
    '/invites/redeem',
    {
      // The redeemer has no staff row by definition — a real identity is
      // all this needs, same as onboarding's POST /businesses.
      preHandler: requireAuthenticatedIdentity(deps),
      // A guessable-secret-probing surface, same reasoning and same limit
      // as the public check-in submission route.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsedBody = redeemInviteBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      const result = await deps.staffPort.redeemInvite({
        code: parsedBody.data.code,
        authUserId: request.identity!.userId,
        email: request.identity!.email,
      });

      if (result.outcome === 'invalid_code') {
        return reply.code(400).send({ error: 'invalid_code' });
      }
      if (result.outcome === 'already_staff') {
        return reply.code(409).send({ error: 'already_staff' });
      }
      return reply.code(200).send(result);
    },
  );
}
