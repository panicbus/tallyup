import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * The role gate: is this staff member the business's owner? Distinct from
 * `requireOwnership` (a tenant check — "is this resource yours at all") —
 * this is a permission check within a tenant a caller already belongs to.
 *
 * Owns 403, not 401 — `requireStaff` already proved this is a real, signed-in
 * staff member; this only says they lack the permission this route needs.
 * Must run after `requireStaff` in the route's preHandler array, since it
 * reads the `request.staff` that establishes.
 *
 * Takes no config and needs no dependencies (the role it checks is already
 * on `request.staff`), so unlike `requireStaff`/`requireOwnership` this is a
 * plain handler, not a factory.
 */
export async function requireOwner(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.staff!.role !== 'owner') {
    return reply.code(403).send({ error: 'forbidden' });
  }
}
