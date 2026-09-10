import { describe, expect, it } from 'vitest';
import { renderInviteEmail } from './invite-email.js';

const base = {
  businessName: 'Blue Bottle Coffee',
  inviterEmail: 'sofia@bluebottle.com',
  role: 'staff' as const,
  joinUrl: 'https://hellotallyup.com/join?token=abc123',
  expiresAt: new Date('2026-09-16T00:00:00Z'),
};

describe('renderInviteEmail', () => {
  it('names the shop, the inviter, and the role, and includes the join link', () => {
    const { subject, html, text } = renderInviteEmail(base);

    expect(subject).toContain('Blue Bottle Coffee');
    for (const body of [html, text]) {
      expect(body).toContain('Blue Bottle Coffee');
      expect(body).toContain('sofia@bluebottle.com');
      expect(body).toContain('staff');
      expect(body).toContain('https://hellotallyup.com/join?token=abc123');
    }
  });

  it('says "owner" when the invited role is owner', () => {
    const { html, text } = renderInviteEmail({ ...base, role: 'owner' });

    expect(html).toContain('owner');
    expect(text).toContain('owner');
  });

  it('escapes HTML in the shop name so a crafted name cannot inject markup', () => {
    const { html } = renderInviteEmail({ ...base, businessName: '<script>alert(1)</script>Evil & Co' });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Evil &amp; Co');
  });

  it('does not carry an unescaped inviter address into the HTML', () => {
    const { html } = renderInviteEmail({ ...base, inviterEmail: 'a<b>@example.com' });

    expect(html).not.toContain('a<b>@example.com');
    expect(html).toContain('a&lt;b&gt;@example.com');
  });

  it('states when the invitation expires, in both bodies', () => {
    const { html, text } = renderInviteEmail(base);

    expect(html).toContain('September 16, 2026');
    expect(text).toContain('September 16, 2026');
  });

  it('produces a plain-text alternative with no HTML tags', () => {
    const { text } = renderInviteEmail(base);

    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain('https://hellotallyup.com/join?token=abc123');
  });
});
