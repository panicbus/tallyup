import { useEffect, useRef, useState } from 'react';

interface ProfileMenuProps {
  email: string;
  name: string | null;
  role: string;
  onSignOut: () => void;
}

/** The signed-in indicator in the top bar: a round button showing the first
 * letter of the account's name (or email, until a name is set). Clicking it
 * opens a small menu with that identity, the role it grants, and a sign-out
 * action. Closes on Escape or an outside click. */
export function ProfileMenu({ email, name, role, onSignOut }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const identity = name && name.trim() ? name.trim() : email;
  const initial = identity.charAt(0).toUpperCase() || '?';
  const roleLabel = role === 'owner' ? 'Owner' : 'Staff';

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="profile-menu" ref={ref}>
      <button
        type="button"
        className="avatar-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        {initial}
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          <div className="profile-menu-label">
            Signed in as:
            <span className="profile-menu-identity">{identity}</span>
            <span className="tag tag-neutral profile-menu-role">{roleLabel}</span>
          </div>
          <button type="button" role="menuitem" className="profile-menu-signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
