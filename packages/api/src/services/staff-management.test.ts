import { describe, expect, it } from 'vitest';
import { getStaffRoster } from './staff-management.js';
import type { StaffPort, StaffRoster } from '../data-access/staff-port.js';

function fakePortReturning(roster: StaffRoster): Pick<StaffPort, 'listStaff'> {
  return { listStaff: async () => roster };
}

const roster: StaffRoster = {
  staff: [
    { id: 's1', email: 'owner@example.com', role: 'owner', deactivatedAt: null },
    { id: 's2', email: 'staff@example.com', role: 'staff', deactivatedAt: null },
    { id: 's3', email: 'fired@example.com', role: 'staff', deactivatedAt: new Date('2026-01-01') },
  ],
  pendingInvites: [{ id: 'i1', role: 'staff', createdAt: new Date(), expiresAt: new Date() }],
};

describe('getStaffRoster', () => {
  it('shows an owner everything: emails, deactivated history, and pending invites', async () => {
    const result = await getStaffRoster(fakePortReturning(roster), { businessId: 'b1', callerRole: 'owner' });

    expect(result).toEqual(roster);
  });

  it('shows a non-owner only active colleagues, with no email and no pending invites', async () => {
    const result = await getStaffRoster(fakePortReturning(roster), { businessId: 'b1', callerRole: 'staff' });

    expect(result).toEqual({
      staff: [
        { id: 's1', role: 'owner', deactivatedAt: null },
        { id: 's2', role: 'staff', deactivatedAt: null },
      ],
    });
    expect(result.pendingInvites).toBeUndefined();
  });
});
