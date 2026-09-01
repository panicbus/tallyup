import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { updateBusiness } from '../data-access/update-business.js';
import { isValidLogoUrlOrAbsent } from '../services/logo-url.js';
import { requireStaff } from './require-staff.js';
import { ownerBySlugParam, requireOwnership } from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const updateBusinessBodySchema = z.object({
  name: z.string().trim().min(1),
  rewardThreshold: z.number().int().positive(),
  rewardDescription: z.string().trim().min(1),
  // Optional and nullable are meaningfully different here: omitted leaves
  // the current logo alone, an explicit null clears it.
  logoUrl: z.string().nullable().optional(),
});

export async function businessRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.patch(
    '/businesses/:slug',
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      const parsedBody = updateBusinessBodySchema.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.code(400).send({ error: 'invalid_body' });
      }

      // The bytes never came through here, so the URL is only as trustworthy
      // as this check makes it — it must point into this caller's own folder
      // in our own storage bucket, not an arbitrary host or another shop's.
      const logoUrlContext = { supabaseUrl: process.env.SUPABASE_URL ?? '', authUserId: request.identity!.userId };
      if (!isValidLogoUrlOrAbsent(parsedBody.data.logoUrl, logoUrlContext)) {
        return reply.code(400).send({ error: 'invalid_logo_url' });
      }

      // Past the guard, the slug's business is the caller's own business.
      const updated = await updateBusiness(deps.db, request.staff!.business.id, parsedBody.data);
      return reply.code(200).send(updated);
    },
  );
}
