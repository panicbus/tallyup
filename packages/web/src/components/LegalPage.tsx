import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getMe } from '../lib/api';

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Readable single-column layout for Terms and Privacy. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  // Back to the landing page for a visitor, back to their dashboard for a
  // signed-in user. Defaults to the landing page until getMe() resolves.
  const [backTo, setBackTo] = useState('/');
  useEffect(() => {
    getMe()
      .then((me) => {
        if (me) setBackTo(`/dashboard/${me.business.slug}`);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="page">
      <div className="page-content" style={{ maxWidth: 680 }}>
        <Link to={backTo} style={{ fontSize: 13, alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>
          ← Back
        </Link>
        <h1 style={{ margin: '0 0 2px' }}>{title}</h1>
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Last updated {updated}</p>
        <div className="prose">{children}</div>
      </div>
    </div>
  );
}
