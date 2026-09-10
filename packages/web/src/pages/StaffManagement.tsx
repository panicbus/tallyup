import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, UserPlus, X } from 'lucide-react';
import { normalizeEmail } from '@tallyup/shared';
import { createInvite, deactivateStaffMember, getMe, getStaffRoster, revokeInvite } from '../lib/api';
import type { MeResponse, StaffRole, StaffRosterResponse } from '../lib/api';
import { supabaseClient } from '../lib/supabase';
import { StaffHeader } from '../components/StaffHeader';

export function StaffManagement() {
  const { slug } = useParams() as { slug: string };
  const navigate = useNavigate();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [roster, setRoster] = useState<StaffRosterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<StaffRole>('staff');
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const roleMenuRef = useRef<HTMLDivElement>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

  useEffect(() => {
    getMe().then((result) => {
      if (!result) {
        navigate('/login');
        return;
      }
      if (result.business.slug !== slug) {
        navigate(`/dashboard/${result.business.slug}/staff`);
        return;
      }
      if (result.role !== 'owner') {
        navigate(`/dashboard/${slug}`);
        return;
      }
      setMe(result);
    });
  }, [slug, navigate]);

  useEffect(() => {
    if (!me) return;
    getStaffRoster(slug)
      .then(setRoster)
      .catch(() => setError('Could not load staff.'));
  }, [slug, me]);

  useEffect(() => {
    if (!roleMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setRoleMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setRoleMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [roleMenuOpen]);

  async function refreshRoster() {
    try {
      setRoster(await getStaffRoster(slug));
    } catch {
      setError('Could not load staff.');
    }
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    setError(null);
    setInviteSentTo(null);
    try {
      const result = await createInvite(slug, inviteEmail, inviteRole);
      if (result.outcome === 'invalid_email') {
        setError('Enter a valid email address.');
        return;
      }
      if (result.outcome === 'email_failed') {
        setError('Could not send that invitation. Check the address and try again.');
        return;
      }
      setInviteSentTo(result.email);
      setInviteEmail('');
      await refreshRoster();
    } catch {
      setError('Could not create an invite.');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setError(null);
    // Optimistic: drop it from the list immediately, then reconcile.
    setRoster((current) =>
      current
        ? { ...current, pendingInvites: current.pendingInvites?.filter((i) => i.id !== inviteId) }
        : current,
    );
    try {
      await revokeInvite(inviteId);
      await refreshRoster();
    } catch {
      setError('Could not revoke that invite.');
      await refreshRoster();
    }
  }

  async function handleDeactivate(staffId: string) {
    if (!window.confirm('Deactivate this staff member? They will lose access immediately.')) {
      return;
    }
    setError(null);
    try {
      const result = await deactivateStaffMember(staffId);
      if (result.outcome === 'last_owner') {
        setError('You cannot deactivate the last active owner.');
        return;
      }
      await refreshRoster();
    } catch {
      setError('Could not deactivate that staff member.');
    }
  }

  async function handleSignOut() {
    await supabaseClient.auth.signOut();
    navigate('/login');
  }

  if (!me) {
    return (
      <div className="page">
        <div className="page-content" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <p className="text-muted">Loading…</p>
        </div>
      </div>
    );
  }

  // Cheap client-side guard against the "re-invite to change a role" trap,
  // which the API rejects as already_staff with no promote path.
  const typedEmail = normalizeEmail(inviteEmail);
  const alreadyOnTeam =
    typedEmail !== '' &&
    (roster?.staff ?? []).some((s) => s.email && normalizeEmail(s.email) === typedEmail && s.deactivatedAt === null);

  return (
    <div className="page">
      <div className="app-shell" style={{ width: '100%', maxWidth: 'var(--page-max-width)' }}>
        <StaffHeader
          slug={slug}
          businessName={me.business.name}
          logoUrl={me.business.logoUrl}
          userEmail={me.email}
          userRole={me.role}
          onSignOut={handleSignOut}
          showStaffTab={me.role === 'owner'}
        />

        <div className="page-content app-content" style={{ paddingTop: 24, gap: 16, maxWidth: 'none' }}>
          {error && (
            <p role="alert" style={{ color: 'var(--color-accent-700)' }}>
              {error}
            </p>
          )}

          <h3 style={{ margin: 0 }}>Staff</h3>

          <p className="text-muted" style={{ margin: 0, fontSize: 13, maxWidth: 460 }}>
            Enter a teammate's email and we'll send them an invitation link. The role you pick is what
            they get: <strong>staff</strong> can run check-ins and redemptions; <strong>owners</strong>{' '}
            can also change settings, manage staff, and export customers.
          </p>

          {inviteSentTo && (
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-accent-700)' }}>
              Invitation sent to {inviteSentTo}.
            </p>
          )}
          {alreadyOnTeam && (
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {inviteEmail.trim()} is already on your team. Changing someone's role isn't supported yet.
            </p>
          )}

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
              padding: '14px 16px',
              background: 'var(--color-surface)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <input
              type="email"
              className="input"
              placeholder="teammate@example.com"
              aria-label="Teammate's email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{ flex: '1 1 200px' }}
            />
            <div className="dropdown" data-open={roleMenuOpen} ref={roleMenuRef}>
              <button
                type="button"
                className="dropdown-trigger"
                aria-haspopup="listbox"
                aria-expanded={roleMenuOpen}
                onClick={() => setRoleMenuOpen((open) => !open)}
              >
                {inviteRole === 'owner' ? 'Owner' : 'Staff'}
                <ChevronDown size={14} />
              </button>
              {roleMenuOpen && (
                <div className="dropdown-menu" role="listbox" aria-label="Invite role">
                  {(['staff', 'owner'] as const).map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="option"
                      aria-selected={inviteRole === role}
                      onClick={() => {
                        setInviteRole(role);
                        setRoleMenuOpen(false);
                      }}
                    >
                      {role === 'owner' ? 'Owner' : 'Staff'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              disabled={creatingInvite || inviteEmail.trim() === ''}
              onClick={handleCreateInvite}
            >
              <UserPlus size={14} /> {creatingInvite ? 'Sending…' : 'Send invitation'}
            </button>
          </div>

          {roster && (
            <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {roster.staff.map((entry) => (
                <li
                  key={entry.id}
                  style={{
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 16px',
                    background: 'var(--color-surface)',
                    borderRadius: 'var(--radius-md)',
                    flexWrap: 'wrap',
                    opacity: entry.deactivatedAt ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{entry.email ?? entry.role}</span>
                  <span className="tag tag-neutral">{entry.role}</span>
                  {entry.deactivatedAt && <span className="tag tag-neutral">Deactivated</span>}
                  {!entry.deactivatedAt && entry.id !== me.id && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ marginLeft: 'auto', fontSize: 13 }}
                      onClick={() => handleDeactivate(entry.id)}
                    >
                      Deactivate
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {roster?.pendingInvites && roster.pendingInvites.length > 0 && (
            <>
              <h4 style={{ margin: 0 }}>Pending invites</h4>
              <ul style={{ margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {roster.pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    style={{
                      listStyle: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 16px',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>{invite.email}</span>
                    <span className="tag tag-neutral">{invite.role}</span>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      Expires {new Date(invite.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                    </span>
                    <button
                      type="button"
                      aria-label="Revoke this invite"
                      onClick={() => handleRevokeInvite(invite.id)}
                      style={{
                        marginLeft: 'auto',
                        display: 'flex',
                        padding: 4,
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-neutral-600)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
