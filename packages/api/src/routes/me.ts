import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireStaff } from './require-staff.js';
import type { AppDependencies } from '../app.js';

// A first name is plenty; the cap is just to keep it a label, not a bio.
const updateMeBodySchema = z.object({ name: z.string().trim().max(60) });

export async function meRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.get('/me', { preHandler: requireStaff(deps) }, async (request, reply) => {
    return reply.code(200).send(request.staff);
  });

  // Any signed-in staff member can set their own display name — this is
  // about identifying yourself to colleagues, not a business setting, so it
  // is not owner-gated. Plain write through deps.db, same as the settings
  // route: no branching worth a port.
  app.patch('/me', { preHandler: requireStaff(deps) }, async (request, reply) => {
    const parsed = updateMeBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_body' });
    }

    const name = parsed.data.name === '' ? null : parsed.data.name;
    await deps.db.updateTable('staff').set({ name }).where('id', '=', request.staff!.id).execute();

    return reply.code(200).send({ ...request.staff!, name });
  });
}
