import { randomUUID } from 'node:crypto';
import type { StaffContext, StaffPort } from '../data-access/staff-port.js';

export function createInMemoryStaffPort() {
  const staffByAuthUserId = new Map<string, StaffContext>();

  return {
    port: {
      async findByAuthUserId(authUserId: string): Promise<StaffContext | null> {
        return staffByAuthUserId.get(authUserId) ?? null;
      },
    } satisfies StaffPort,

    /** Registers a staff member as reachable via `authUserId`, returning
     * both — pass `staff.id` where a test needs it (e.g. asserting who a
     * visit/redemption was `confirmedBy`). */
    addStaff(input: {
      authUserId: string;
      businessId: string;
      email?: string;
      role?: string;
    }): StaffContext {
      const staff: StaffContext = {
        id: randomUUID(),
        email: input.email ?? 'staff@example.com',
        role: input.role ?? 'owner',
        business: {
          id: input.businessId,
          name: 'Test Business',
          slug: `test-business-${randomUUID()}`,
          rewardThreshold: 10,
          rewardDescription: 'Free item',
        },
      };
      staffByAuthUserId.set(input.authUserId, staff);
      return staff;
    },
  };
}
