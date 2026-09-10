import type { StaffRole } from '../data-access/types.js';

export interface InviteEmailInput {
  businessName: string;
  /** Email of the staff member who sent the invite. */
  inviterEmail: string;
  role: StaffRole;
  /** Absolute URL of the join page, token included. */
  joinUrl: string;
  expiresAt: Date;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// businessName and inviterEmail both originate from user input and land in a
// recipient's mail client, so every interpolation into the HTML body goes
// through this. The join URL and role are system-generated and constrained,
// but escaping them too costs nothing and keeps the rule "everything is
// escaped" rather than "audit each site".
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function roleNoun(role: StaffRole): string {
  return role === 'owner' ? 'owner' : 'staff';
}

function formatExpiry(expiresAt: Date): string {
  return expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Pure renderer for the staff-invitation email. No I/O — the send service
 * hands the result to the EmailPort.
 */
export function renderInviteEmail({ businessName, inviterEmail, role, joinUrl, expiresAt }: InviteEmailInput): RenderedEmail {
  const noun = roleNoun(role);
  const expiry = formatExpiry(expiresAt);

  const subject = `Join ${businessName} on TallyUp`;

  const text = [
    `${inviterEmail} invited you to join ${businessName} on TallyUp, the loyalty punch-card app, as ${noun}.`,
    '',
    'Open this link to accept:',
    joinUrl,
    '',
    `This invitation expires ${expiry}. You are getting this because ${inviterEmail} entered your address on TallyUp's staff form. If that wasn't expected, you can ignore this email.`,
  ].join('\n');

  const html = [
    '<div style="font-family: system-ui, sans-serif; font-size: 15px; line-height: 1.5; color: #1a1a1a;">',
    `<p>${escapeHtml(inviterEmail)} invited you to join <strong>${escapeHtml(businessName)}</strong> on TallyUp, the loyalty punch-card app, as ${escapeHtml(noun)}.</p>`,
    `<p><a href="${escapeHtml(joinUrl)}" style="display: inline-block; padding: 10px 18px; background: #1a1a1a; color: #fff; border-radius: 6px; text-decoration: none;">Accept invitation</a></p>`,
    `<p style="font-size: 13px; color: #6b6b6b;">Or paste this link into your browser:<br>${escapeHtml(joinUrl)}</p>`,
    `<p style="font-size: 13px; color: #6b6b6b;">This invitation expires ${escapeHtml(expiry)}. You are getting this because ${escapeHtml(inviterEmail)} entered your address on TallyUp's staff form. If that wasn't expected, you can ignore this email.</p>`,
    '</div>',
  ].join('\n');

  return { subject, html, text };
}
