import { normalizeEmail } from '@tallyup/shared';
import type { EmailPort } from '../data-access/email-port.js';
import type { PendingInviteEntry, StaffPort } from '../data-access/staff-port.js';
import type { StaffRole } from '../data-access/types.js';
import { renderInviteEmail } from './invite-email.js';

export interface VisibleStaffEntry {
  id: string;
  name: string | null;
  email: string;
  role: StaffRole;
  deactivatedAt: Date | null;
}

export interface VisibleRoster {
  staff: VisibleStaffEntry[];
  /** Owner-only — a non-owner caller must not be able to enumerate
   * outstanding invite metadata. */
  pendingInvites?: PendingInviteEntry[];
}

/**
 * Shapes the roster per caller role. Everyone on the team can see who their
 * active colleagues are (name, falling back to email, and role) so shifts
 * can tell each other apart. Only the owner additionally sees deactivated
 * history and pending invites.
 */
export async function getStaffRoster(
  port: Pick<StaffPort, 'listStaff'>,
  input: { businessId: string; callerRole: StaffRole },
): Promise<VisibleRoster> {
  const roster = await port.listStaff(input.businessId);

  if (input.callerRole === 'owner') {
    return roster;
  }

  return {
    staff: roster.staff
      .filter((entry) => entry.deactivatedAt === null)
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        deactivatedAt: null,
      })),
  };
}

export type SendStaffInviteResult =
  | { outcome: 'sent'; id: string; email: string; expiresAt: Date }
  // The invite could not be emailed. The just-created invite has been
  // revoked, so nothing was left behind -- the owner retries from scratch.
  | { outcome: 'email_failed' };

/**
 * Mints an invite and emails the join link to the invited address. If the
 * send fails, the invite is revoked before returning, so an owner never
 * sees a "pending" invite that will never arrive. The plaintext code lives
 * only inside the emailed link and is never returned to the caller.
 */
export async function sendStaffInvite(
  deps: { staffPort: Pick<StaffPort, 'createInvite' | 'revokeInvite'>; emailPort: EmailPort; appUrl: string },
  input: {
    businessId: string;
    businessName: string;
    email: string;
    role: StaffRole;
    createdBy: string;
    inviterEmail: string;
  },
): Promise<SendStaffInviteResult> {
  const to = normalizeEmail(input.email);
  const invite = await deps.staffPort.createInvite({
    businessId: input.businessId,
    email: to,
    role: input.role,
    createdBy: input.createdBy,
  });

  const joinUrl = `${deps.appUrl}/join?token=${encodeURIComponent(invite.code)}`;
  const { subject, html, text } = renderInviteEmail({
    businessName: input.businessName,
    inviterEmail: input.inviterEmail,
    role: input.role,
    joinUrl,
    expiresAt: invite.expiresAt,
  });

  const send = await deps.emailPort.send({ to, subject, html, text });
  if (send.outcome === 'failed') {
    // Compensate. If the revoke itself throws, the invite is stranded but
    // the owner still needs to hear the send failed -- swallow and report.
    try {
      await deps.staffPort.revokeInvite({ inviteId: invite.id, businessId: input.businessId });
    } catch {
      // nothing we can do here; the send failure is the reportable outcome
    }
    return { outcome: 'email_failed' };
  }

  return { outcome: 'sent', id: invite.id, email: to, expiresAt: invite.expiresAt };
}
