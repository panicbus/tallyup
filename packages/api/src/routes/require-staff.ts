import type { FastifyReply, FastifyRequest } from 'fastify';
import type { StaffContext } from '../data-access/staff-port.js';
import type { AppDependencies } from '../app.js';

declare module 'fastify' {
  interface FastifyRequest {
    staff?: StaffContext;
  }
}

const BEARER_PREFIX = 'Bearer ';

/** 401 only — "is this a valid, logged-in staff member at all." Which
 * business a route requires them to belong to is route-specific (some
 * routes check it against a :slug param, others against a resource looked
 * up inside the handler), so that's a 403 decided by the caller, not here. */
export function requireStaff(deps: AppDependencies) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization;
    const token = header?.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : null;
    if (!token) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const identity = await deps.authPort.verifyToken(token);
    if (!identity) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    const staff = await deps.staffPort.findByAuthUserId(identity.userId);
    if (!staff) {
      return reply.code(401).send({ error: 'unauthorized' });
    }

    request.staff = staff;
  };
}
