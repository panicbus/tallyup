import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface LegalPageProps {
  title: string;
  updated: string;
  children: ReactNode;
}

/** Readable single-column layout for Terms and Privacy. */
export function LegalPage({ title, updated, children }: LegalPageProps) {
  return (
    <div className="page">
      <div className="page-content" style={{ maxWidth: 680 }}>
        <Link to="/" style={{ fontSize: 13, alignSelf: 'flex-start', color: 'var(--color-accent-700)' }}>
          ← Back
        </Link>
        <h1 style={{ margin: '0 0 2px' }}>{title}</h1>
        <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>Last updated {updated}</p>
        <div className="prose">{children}</div>
      </div>
    </div>
  );
}
