import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings as SettingsIcon } from 'lucide-react';
import { ProfileMenu } from './ProfileMenu';
import { AboutModal } from './AboutModal';

interface StaffHeaderProps {
  slug: string;
  businessName: string;
  logoUrl: string | null;
  userEmail: string;
  userName: string | null;
  userRole: string;
  onSignOut: () => void;
}

/**
 * The staff app's top bar: logo, business name, nav tabs, and sign-out —
 * shared by Dashboard and Customers (Settings uses its own back-link
 * instead, unchanged). Extracted once a second page needed the identical
 * markup, which is also what surfaced the aria-current bug this fixes: it
 * used to be hardcoded to the Dashboard tab regardless of which page was
 * actually active.
 */
export function StaffHeader({
  slug,
  businessName,
  logoUrl,
  userEmail,
  userName,
  userRole,
  onSignOut,
}: StaffHeaderProps) {
  const { pathname } = useLocation();
  const [aboutOpen, setAboutOpen] = useState(false);

  // Every role sees every tab. The Staff page itself shows a read-only
  // roster to non-owners (no invite form, no deactivate).
  const tabs = [
    { label: 'Dashboard', href: `/dashboard/${slug}` },
    { label: 'Customers', href: `/dashboard/${slug}/customers` },
    { label: 'Staff', href: `/dashboard/${slug}/staff` },
    { label: 'Settings', href: `/dashboard/${slug}/settings` },
  ];

  return (
    <>
    <div
      className="app-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 20px',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          flex: 'none',
          overflow: 'hidden',
          background: 'var(--color-surface)',
          border: logoUrl ? 'none' : '1px dashed var(--color-neutral-400)',
        }}
      >
        {logoUrl && <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700 }}>{businessName}</div>

      <nav className="nav-tabs" aria-label="Primary">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            className="nav-tab"
            aria-current={pathname === tab.href ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
        <button type="button" className="nav-tab" onClick={() => setAboutOpen(true)}>
          About
        </button>
      </nav>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link
          to={`/dashboard/${slug}/settings`}
          aria-label="Settings"
          className="settings-icon-mobile"
          style={{ color: 'var(--color-neutral-600)', padding: 4, display: 'flex' }}
        >
          <SettingsIcon size={18} />
        </Link>
        <ProfileMenu email={userEmail} name={userName} role={userRole} onSignOut={onSignOut} />
      </div>
    </div>
    {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </>
  );
}
