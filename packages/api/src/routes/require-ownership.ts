import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppDependencies } from '../app.js';

/**
 * Resolves which business owns the resource a request targets, from that
 * request's own path params. Null means no such resource.
 */
export type OwnerResolver = (deps: AppDependencies, request: FastifyRequest) => Promise<string | null>;

export const ownerBySlugParam: OwnerResolver = async (deps, request) => {
  const { slug } = request.params as { slug: string };
  const business = await deps.checkInPort.findBusinessBySlug(slug);
  return business?.id ?? null;
};

export const ownerByPendingCheckinParam: OwnerResolver = async (deps, request) => {
  const { id } = request.params as { id: string };
  return deps.checkInPort.findPendingCheckinBusinessId(id);
};

export const ownerByCustomerParam: OwnerResolver = async (deps, request) => {
  const { id } = request.params as { id: string };
  return deps.checkInPort.findCustomerBusinessId(id);
};

export interface RequireOwnershipOptions {
  /**
   * What a missing resource means for this route.
   * - `'notFound'` (default) — reply 404; the route has nothing to say about
   *   a resource that isn't there.
   * - `'allow'` — fall through to the handler, for routes whose own result
   *   already covers it. Redeem is the case: an unknown customer id is a
   *   routine `not_eligible` (409), indistinguishable by design from
   *   "insufficient points", so it must not become a 404 here.
   */
  missing?: 'notFound' | 'allow';
}

/**
 * The tenant-isolation gate: may this staff member act on this resource?
 *
 * Owns 403 (and, by policy, 404). It does **not** own 401 — `requireStaff`
 * does, and must run before this in the route's preHandler array, since this
 * reads the `request.staff` that `requireStaff` establishes. Fastify halts the
 * chain when an earlier hook replies, so an unauthenticated request never
 * reaches here.
 *
 * Routes need nothing back from this: once it passes, the resource's owning
 * business is by definition `request.staff.business.id`, which the handler
 * already has.
 */
export function requireOwnership(
  deps: AppDependencies,
  resolveOwner: OwnerResolver,
  { missing = 'notFound' }: RequireOwnershipOptions = {},
) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ownerBusinessId = await resolveOwner(deps, request);

    if (ownerBusinessId === null) {
      if (missing === 'allow') return;
      return reply.code(404).send({ error: 'not_found' });
    }

    if (ownerBusinessId !== request.staff!.business.id) {
      return reply.code(403).send({ error: 'forbidden' });
    }
  };
}
