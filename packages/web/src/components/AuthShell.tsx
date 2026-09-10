import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { LegalLinks } from './LegalLinks';

interface AuthShellProps {
  heading: string;
  subheading?: string;
  children: ReactNode;
  /** Cross-links under the form, e.g. "Already have an account? Sign in".
   * Multiple stack vertically. */
  footer?: ReactNode;
}

/** The shared chrome for every auth screen — sign in, sign up, and the two
 * password-reset steps. */
export function AuthShell({ heading, subheading, children, footer }: AuthShellProps) {
  return (
    <div className="page">
      <div className="auth-stage">
        <div className="page-content" style={{ position: 'relative' }}>
          <Link
            to="/"
            aria-label="Close"
            style={{ position: 'absolute', top: 16, right: 16, color: 'var(--color-neutral-600)', display: 'flex' }}
          >
            <X size={20} />
          </Link>
          <img src="/logo.svg" alt="" width={96} height={96} style={{ display: 'block', margin: '4px auto 8px' }} />
          <div>
            <h2 style={{ margin: subheading ? '0 0 4px' : 0 }}>{heading}</h2>
            {subheading && (
              <p className="text-muted" style={{ margin: 0 }}>
                {subheading}
              </p>
            )}
          </div>
          {children}
          {footer && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', fontSize: 13 }}>
              {footer}
            </div>
          )}
          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
