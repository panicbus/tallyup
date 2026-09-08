import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, UserPlus } from 'lucide-react';
import { createInvite, deactivateStaffMember, getMe, getStaffRoster } from '../lib/api';
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
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInvite, setNewInvite] = useState<CreatedInvite | null>(null);
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
        <StaffHeader slug={slug} businessName={me.business.name} logoUrl={me.business.logoUrl} onSignOut={handleSignOut} />

        <div className="page-content app-content" style={{ paddingTop: 24, gap: 16, maxWidth: 'none' }}>
          {error && (
            <p role="alert" style={{ color: 'var(--color-accent-700)' }}>
              {error}
            </p>
          )}

          <h3 style={{ margin: 0 }}>Staff</h3>

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
            <select
              className="input"
              style={{ width: 'auto' }}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as StaffRole)}
            >
              <option value="staff">Staff</option>
              <option value="owner">Owner</option>
            </select>
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
                gap: 8,
                padding: '14px 16px',
                background: 'var(--color-accent-100)',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <p style={{ margin: 0, fontSize: 13 }}>
                Share this code — it's shown <strong>only once</strong>:
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
