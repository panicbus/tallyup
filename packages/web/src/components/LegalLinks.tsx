import { Link } from 'react-router-dom';

/** Terms · Privacy — on the auth pages and the landing footer. */
export function LegalLinks() {
  return (
    <p className="text-muted" style={{ margin: 0, fontSize: 12, textAlign: 'center' }}>
      <Link to="/terms">Terms</Link> · <Link to="/privacy">Privacy</Link>
    </p>
  );
}
