import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { emailSchema } from '@tallyup/shared';
import { getStaffRoster, sendStaffInvite } from '../services/staff-management.js';
import { requireAuthenticatedIdentity, requireStaff } from './require-staff.js';
import { requireOwner } from './require-owner.js';
import { ownerByStaffIdParam, ownerBySlugParam, requireOwnership } from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const staffRoleSchema = z.enum(['owner', 'staff']);
const createInviteBodySchema = z.object({ email: emailSchema, role: staffRoleSchema });
const redeemInviteBodySchema = z.object({ code: z.string().trim().min(1) });
const lookupInviteBodySchema = z.object({ code: z.string().trim().min(1) });

export async function staffRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.post(
    '/businesses/:slug/invites',
    {
      preHandler: [requireStaff(deps), requireOwner, requireOwnership(deps, ownerBySlugParam)],
      // This route sends an email to an arbitrary address on the owner's
      // say-so, so it's a spam vector aimed at our sending domain's
      // reputation. The limiter runs at onRequest, before the preHandlers
      // set request.staff, so the key is the caller's IP, not their
      // business -- coarse, but fine at pilot scale.
      config: { rateLimit: { max: 5, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const parsedBody = createInviteBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      const result = await sendStaffInvite(
        { staffPort: deps.staffPort, emailPort: deps.emailPort, appUrl: deps.appUrl },
        {
          businessId: request.staff!.business.id,
          businessName: request.staff!.business.name,
          email: parsedBody.data.email,
          role: parsedBody.data.role,
          createdBy: request.staff!.id,
          inviterEmail: request.staff!.email,
        },
      );

      if (result.outcome === 'email_failed') {
        return reply.code(502).send({ error: 'email_failed' });
      }

      return reply.code(201).send({ id: result.id, email: result.email, expiresAt: result.expiresAt });
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
    '/invites/:id/revoke',
    // Tenant isolation is the port's `business_id` scope, not a slug in the
    // path — same shape as /staff/:id/deactivate. An invite id from another
    // business simply doesn't match and comes back 404.
    { preHandler: [requireStaff(deps), requireOwner] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const result = await deps.staffPort.revokeInvite({
        inviteId: id,
        businessId: request.staff!.business.id,
      });

      if (result.outcome === 'not_found') {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.code(200).send(result);
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
    '/invites/lookup',
    {
      // Unauthenticated: the invitee has no account yet. POST, not GET, so
      // the bearer code never lands in Fastify's request-URL logs. The
      // body carries an email address keyed by that code, so it must not be
      // cached anywhere.
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsedBody = lookupInviteBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      const description = await deps.staffPort.describeInvite(parsedBody.data.code);
      if (!description) {
        return reply.code(404).send({ error: 'invalid_code' });
      }

      return reply.header('cache-control', 'no-store').code(200).send(description);
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
      if (result.outcome === 'wrong_account') {
        return reply.code(403).send({ error: 'wrong_account' });
      }
      if (result.outcome === 'already_staff') {
        return reply.code(409).send({ error: 'already_staff' });
      }
      return reply.code(200).send(result);
    },
  );
}
