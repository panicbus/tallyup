import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronDown, Copy, UserPlus, X } from 'lucide-react';
import { createInvite, deactivateStaffMember, getMe, getStaffRoster, revokeInvite } from '../lib/api';
import type { CreatedInvite, MeResponse, StaffRole, StaffRosterResponse } from '../lib/api';
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
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInvite, setNewInvite] = useState<CreatedInvite | null>(null);
  const [newInviteRole, setNewInviteRole] = useState<StaffRole>('staff');
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    try {
      const invite = await createInvite(slug, inviteRole);
      setNewInvite(invite);
      setNewInviteRole(inviteRole);
      await refreshRoster();
    } catch {
      setError('Could not create an invite.');
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleCopyCode() {
    if (!newInvite) return;
    try {
      await navigator.clipboard.writeText(newInvite.code);
      setCopied(true);
    } catch {
      // Clipboard access can fail (permissions, insecure context) — the
      // code is still on screen to copy by hand, so this isn't fatal.
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

  return (
    <div className="page">
      <div className="app-shell" style={{ width: '100%', maxWidth: 'var(--page-max-width)' }}>
        <StaffHeader
          slug={slug}
          businessName={me.business.name}
          logoUrl={me.business.logoUrl}
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
            To add a teammate, generate a one-time invite code and send it to them. The role you pick is
            what the code grants: <strong>staff</strong> can run check-ins and redemptions;{' '}
            <strong>owners</strong> can also change settings, manage staff, and export customers.
          </p>

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
                        // Changing the role invalidates the code on screen —
                        // it's already been issued for the old role. Hide it;
                        // "Invite" mints a fresh one.
                        setNewInvite(null);
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
              disabled={creatingInvite}
              onClick={handleCreateInvite}
            >
              <UserPlus size={14} /> {creatingInvite ? 'Creating…' : 'Invite'}
            </button>
          </div>

          {newInvite && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: '14px 16px',
                background: 'var(--color-accent-100)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <p style={{ margin: 0, fontSize: 13 }}>
                Invite code for a new <strong>{newInviteRole === 'owner' ? 'owner' : 'staff member'}</strong>.
                Copy it now (it won't be shown again).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code
                  style={{
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 15,
                    padding: '6px 10px',
                    background: '#fff',
                    borderRadius: 'var(--radius-sm)',
                    wordBreak: 'break-all',
                  }}
                >
                  {newInvite.code}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                  onClick={handleCopyCode}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ fontSize: 13 }}>
                Send it to them. To use it, they:
                <ol style={{ margin: '4px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <li>
                    Open <strong>{window.location.host}</strong> and create their own account
                  </li>
                  <li>
                    Pick <strong>“Join with a code”</strong> and paste this in
                  </li>
                </ol>
              </div>
              <p className="text-muted" style={{ margin: 0, fontSize: 12 }}>
                Works once, and expires{' '}
                {new Date(newInvite.expiresAt).toLocaleDateString('en-US', { timeZone: 'UTC' })}.
              </p>
            </div>
          )}

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
