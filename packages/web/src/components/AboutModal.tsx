import { useEffect } from 'react';
import { X } from 'lucide-react';
import { LegalLinks } from './LegalLinks';

interface AboutModalProps {
  onClose: () => void;
}

/** The "About" entry in the staff nav opens this: what TallyUp is, how the
 * punch card works, and the credits. */
export function AboutModal({ onClose }: AboutModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="About TallyUp" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          <X size={18} />
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>About TallyUp</h2>

          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            TallyUp is a digital loyalty program for small businesses. No paper cards, no hole punch, nothing
            for your customers to install.
          </p>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            A customer scans your shop's QR code at the counter to check in, and a staff member
            confirms it on the dashboard. After a set number of visits, they've earned the reward
            you chose and you deliver it.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              paddingTop: 12,
              borderTop: '1px solid var(--color-divider)',
              fontSize: 13,
            }}
          >
            <span className="text-muted">Created by Nico Crisafulli with Claude Code in Alameda, CA</span>
            <span className="text-muted">© 2026 TallyUp</span>
            <a href="https://ko-fi.com/nicocrisafulli" target="_blank" rel="noopener noreferrer">
              Buy me a coffee
            </a>
          </div>

          <LegalLinks />
        </div>
      </div>
    </div>
  );
}
