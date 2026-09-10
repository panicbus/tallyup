import { describe, expect, it } from 'vitest';
import { getStaffRoster, sendStaffInvite } from './staff-management.js';
import type { StaffPort, StaffRoster } from '../data-access/staff-port.js';
import { createInMemoryStaffPort } from '../test-support/in-memory-staff-port.js';
import { createInMemoryEmailPort } from '../test-support/in-memory-email-port.js';

function fakePortReturning(roster: StaffRoster): Pick<StaffPort, 'listStaff'> {
  return { listStaff: async () => roster };
}

const roster: StaffRoster = {
  staff: [
    { id: 's1', name: 'Alex', email: 'owner@example.com', role: 'owner', deactivatedAt: null },
    { id: 's2', name: null, email: 'staff@example.com', role: 'staff', deactivatedAt: null },
    { id: 's3', name: 'Jo', email: 'fired@example.com', role: 'staff', deactivatedAt: new Date('2026-01-01') },
  ],
  pendingInvites: [
    { id: 'i1', email: 'pending@example.com', role: 'staff', createdAt: new Date(), expiresAt: new Date() },
  ],
};

describe('getStaffRoster', () => {
  it('shows an owner everything: names, emails, deactivated history, and pending invites', async () => {
    const result = await getStaffRoster(fakePortReturning(roster), { businessId: 'b1', callerRole: 'owner' });

    expect(result).toEqual(roster);
  });

  it('shows a non-owner active colleagues with name and email, but no deactivated rows or pending invites', async () => {
    const result = await getStaffRoster(fakePortReturning(roster), { businessId: 'b1', callerRole: 'staff' });

    expect(result).toEqual({
      staff: [
        { id: 's1', name: 'Alex', email: 'owner@example.com', role: 'owner', deactivatedAt: null },
        { id: 's2', name: null, email: 'staff@example.com', role: 'staff', deactivatedAt: null },
      ],
    });
    expect(result.pendingInvites).toBeUndefined();
  });
});

describe('sendStaffInvite', () => {
  function setup() {
    const { port: staffPort, seedBusiness, addStaff } = createInMemoryStaffPort();
    const email = createInMemoryEmailPort();
    return { staffPort, emailPort: email.port, sent: email.sent, failNextSend: email.failNextSend, seedBusiness, addStaff };
  }

  const inviteInput = {
    businessId: 'b1',
    businessName: 'Blue Bottle Coffee',
    email: '  New.Teammate@Example.com ',
    role: 'staff' as const,
    createdBy: 'owner-staff-id',
    inviterEmail: 'sofia@bluebottle.com',
  };

  it('creates an invite and emails a join link to the invited address', async () => {
    const { staffPort, emailPort, sent } = setup();

    const result = await sendStaffInvite(
      { staffPort, emailPort, appUrl: 'https://app.example.com' },
      inviteInput,
    );

    expect(result).toMatchObject({ outcome: 'sent', email: 'new.teammate@example.com' });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('new.teammate@example.com');
    expect(sent[0]?.subject).toContain('Blue Bottle Coffee');
    const roster = await staffPort.listStaff('b1');
    expect(roster.pendingInvites.map((i) => i.email)).toEqual(['new.teammate@example.com']);
  });

  it('never returns the plaintext code to its caller', async () => {
    const { staffPort, emailPort, sent } = setup();

    const result = await sendStaffInvite(
      { staffPort, emailPort, appUrl: 'https://app.example.com' },
      inviteInput,
    );

    expect(result).not.toHaveProperty('code');
    // The code only exists inside the emailed link.
    expect(JSON.stringify(result)).not.toContain(sent[0]!.text.split('token=')[1]!.split(/[\s"]/)[0]!);
  });

  it('points the join link at appUrl /join with the code as a token parameter', async () => {
    const { staffPort, emailPort, sent } = setup();

    await sendStaffInvite({ staffPort, emailPort, appUrl: 'https://app.example.com' }, inviteInput);

    const match = sent[0]!.text.match(/https:\/\/app\.example\.com\/join\?token=([^\s]+)/);
    expect(match).not.toBeNull();
    expect(decodeURIComponent(match![1]!).length).toBeGreaterThan(0);
  });

  it('revokes the just-created invite and reports email_failed when the send fails', async () => {
    const { staffPort, emailPort, failNextSend } = setup();
    failNextSend('smtp exploded');

    const result = await sendStaffInvite(
      { staffPort, emailPort, appUrl: 'https://app.example.com' },
      inviteInput,
    );

    expect(result).toEqual({ outcome: 'email_failed' });
    const roster = await staffPort.listStaff('b1');
    expect(roster.pendingInvites).toHaveLength(0);
  });

  it('still reports email_failed when the compensating revoke also throws', async () => {
    const { staffPort, emailPort, failNextSend } = setup();
    failNextSend();
    const brokenRevoke: Pick<StaffPort, 'createInvite' | 'revokeInvite'> = {
      createInvite: staffPort.createInvite,
      revokeInvite: async () => {
        throw new Error('revoke exploded');
      },
    };

    const result = await sendStaffInvite(
      { staffPort: brokenRevoke, emailPort, appUrl: 'https://app.example.com' },
      inviteInput,
    );

    expect(result).toEqual({ outcome: 'email_failed' });
  });
});
