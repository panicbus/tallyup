import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { describe, expect, it } from 'vitest';
import { createDb } from '../data-access/db.js';
import { createInMemoryCheckInPort } from '../test-support/in-memory-check-in-port.js';
import { createInMemoryAuthPort } from '../test-support/in-memory-auth-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';
import { requireStaff } from './require-staff.js';
import { requireOwner } from './require-owner.js';
import type { AppDependencies } from '../app.js';
import type { StaffRole } from '../data-access/types.js';

/** Exercises the guard in isolation, against a probe route — mirrors
 * require-ownership.test.ts's pattern. */
function buildProbe() {
  const { port: checkInPort } = createInMemoryCheckInPort();
  const { port: authPort, issueToken } = createInMemoryAuthPort();
  const { port: staffPort, addStaff } = createInMemoryStaffPort();
  // Never queried — Pool connections are lazy, so a bogus connection string is
  // fine for a dependency the guard never touches.
  const deps: AppDependencies = { checkInPort, authPort, staffPort, db: createDb('postgres://unused') };

  const app: FastifyInstance = Fastify({ logger: false });
  app.get('/probe', { preHandler: [requireStaff(deps), requireOwner] }, async () => ({ reached: true }));

  function loginAs(role: StaffRole) {
    const authUserId = randomUUID();
    const staff = addStaff({ authUserId, businessId: randomUUID(), role });
    return { authorization: `Bearer ${issueToken({ userId: authUserId, email: staff.email })}` };
  }

  return { app, loginAs };
}

describe('requireOwner', () => {
  it('reaches the handler when the caller is an owner', async () => {
    const { app, loginAs } = buildProbe();

    const response = await app.inject({ method: 'GET', url: '/probe', headers: loginAs('owner') });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ reached: true });
  });

  it('403s a signed-in staff member who is not an owner', async () => {
    const { app, loginAs } = buildProbe();

    const response = await app.inject({ method: 'GET', url: '/probe', headers: loginAs('staff') });

    expect(response.statusCode).toBe(403);
  });

  it('401s before this guard runs, when the caller is not signed in at all', async () => {
    // Ordering constraint: requireStaff owns 401 and must short-circuit
    // first, or this guard would dereference an unset request.staff.
    const { app } = buildProbe();

    const response = await app.inject({ method: 'GET', url: '/probe' });

    expect(response.statusCode).toBe(401);
  });
});
