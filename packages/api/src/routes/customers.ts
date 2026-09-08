import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { listAllCustomersForExport, listCustomers } from '../services/customers.js';
import { toCsv } from '../services/csv.js';
import { requireStaff } from './require-staff.js';
import { requireOwner } from './require-owner.js';
import { ownerBySlugParam, requireOwnership } from './require-ownership.js';
import type { AppDependencies } from '../app.js';

const CSV_HEADER = ['Phone', 'Points', 'Joined', 'SMS Consent'];

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

// Query params arrive as strings; z.coerce.number() parses them. sort/dir
// are a strict allowlist mapped to real column names inside the port —
// never a raw string reaching SQL.
const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  sort: z.enum(['points', 'joined']).default('joined'),
  dir: z.enum(['asc', 'desc']).default('desc'),
});

export async function customerRoutes(app: FastifyInstance, deps: AppDependencies): Promise<void> {
  app.get(
    '/businesses/:slug/customers',
    // All staff, not owner-only — per-route decision, distinct from the
    // owner-only invite/export routes.
    { preHandler: [requireStaff(deps), requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      const parsedQuery = listCustomersQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.code(400).send({ error: 'invalid_query' });
      }

      // Past the guard, the slug's business is the caller's own business.
      const page = await listCustomers(deps.checkInPort, {
        businessId: request.staff!.business.id,
        ...parsedQuery.data,
      });
      return reply.code(200).send(page);
    },
  );

  app.get(
    '/businesses/:slug/customers/export',
    // Owner-only, unlike the roster read above — this is the whole customer
    // list leaving in one click, not paginated browsing.
    { preHandler: [requireStaff(deps), requireOwner, requireOwnership(deps, ownerBySlugParam)] },
    async (request, reply) => {
      // Reuses the exact same service (and therefore the exact same
      // masking) as the roster route — this must never become a second
      // place that could drift and leak a raw phone number.
      const entries = await listAllCustomersForExport(deps.checkInPort, request.staff!.business.id);
      const rows = [
        CSV_HEADER,
        ...entries.map((entry) => [
          entry.maskedPhone,
          String(entry.points),
          entry.joinedAt.toISOString(),
          entry.hasSmsConsent ? 'yes' : 'no',
        ]),
      ];

      return reply.type('text/csv; charset=utf-8').send(toCsv(rows));
    },
  );
}
