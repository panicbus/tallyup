import type { FastifyInstance } from 'fastify';
import { listStaffByBusiness } from '../data-access/staff.js';
import type { AppDependencies } from '../app.js';

export async function staffRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.get('/businesses/:slug/staff', async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const business = await deps.checkInPort.findBusinessBySlug(slug);
    if (!business) {
      return reply.code(404).send({ error: 'business_not_found' });
    }

    const staff = await listStaffByBusiness(deps.db, business.id);
    return reply.code(200).send(staff);
  });
}
