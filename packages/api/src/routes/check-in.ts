import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { phoneSchema, smsConsentLanguageV1 } from '@tallyup/shared';
import { confirmCheckin, listPendingCheckins } from '../services/check-in.js';
import { redeem } from '../services/redemption.js';
import { getCheckinStatus } from '../services/checkin-status.js';
import { getCustomerCards } from '../services/customer-cards.js';
import { requireStaff } from './require-staff.js';
import {
  ownerByCustomerParam,
  ownerByPendingCheckinParam,
  ownerBySlugParam,
  requireOwnership,
} from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const createPendingCheckinBodySchema = z.object({
  phone: phoneSchema,
  // Absent or false both mean "no consent" — only an explicit `true` records
  // anything. The server renders the consent language itself from the
  // business already loaded below; the client sends only this boolean, or
  // the stored "evidence" would just be whatever text an attacker chose.
  smsConsent: z.boolean().optional().default(false),
});

const lookupCardsBodySchema = z.object({ phone: phoneSchema });

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

      const consentGivenNow = parsedBody.data.smsConsent;

      // Both touch only (business, phone) and neither needs the other's
      // result — run them together. `hasConsented` is skipped entirely when
      // the box is ticked, since consent is being given right now.
      const [pendingCheckin, priorConsent] = await Promise.all([
        deps.checkInPort.createPendingCheckin({ businessId: business.id, phone: parsedBody.data.phone }),
        consentGivenNow
          ? false
          : deps.checkInPort.hasConsented({ businessId: business.id, phone: parsedBody.data.phone }),
      ]);

      // Deliberately outside the fraud-gate transaction and independent of
      // the pending check-in's own lifecycle — consent is recorded the
      // instant it's given, by the customer, not up to 20 minutes later
      // when staff confirm. An unticked box writes nothing and revokes
      // nothing; a prior consent is never touched.
      if (consentGivenNow) {
        await deps.checkInPort.recordConsent({
          businessId: business.id,
          phone: parsedBody.data.phone,
          language: smsConsentLanguageV1(business.name),
          ip: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
        });
      }

      // So the customer-facing form can drop the consent checkbox on a
      // repeat check-in for a number that has already opted in — just
      // ticked, or opted in on any earlier visit.
      return reply.code(200).send({ ...pendingCheckin, hasSmsConsent: consentGivenNow || priorConsent });
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

  app.post(
    '/cards/lookup',
    // Public, unauthenticated, and keyed by a guessable phone number rather
    // than an unguessable id — a deliberate reversal of that norm (see
    // ADR-0004). POST, not GET, so the number never lands in Fastify's
    // request-URL logs; no-store so it's never cached anywhere in between.
    // This 10/min-per-IP limit is a speed bump against bulk sweeps, not a
    // defense against someone targeting one number they already know.
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsedBody = lookupCardsBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_phone' });
      }

      const cards = await getCustomerCards(deps.checkInPort, parsedBody.data.phone);

      // Never 404: "no customer anywhere" and "a customer with nothing to
      // show" must be the same response from outside, same reasoning as
      // /customers/:id/redeem's missing:'allow'.
      return reply.header('cache-control', 'no-store').code(200).send({ cards });
    },
  );

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
