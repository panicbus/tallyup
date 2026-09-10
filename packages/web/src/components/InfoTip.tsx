import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';

/** A small "i" button that toggles a text popover. Click / tap to open,
 * outside-click or Escape to close. Works the same on touch and pointer,
 * so it does not depend on hover. */
export function InfoTip({ children, label = 'More info' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} style={{ position: 'relative', display: 'inline-flex', verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          padding: 0,
          background: 'none',
          border: 'none',
          color: 'var(--color-neutral-600)',
          cursor: 'pointer',
        }}
      >
        <Info size={14} />
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            width: 240,
            padding: '10px 12px',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--color-text)',
            background: '#fff',
            border: '1px solid var(--color-divider)',
            borderRadius: 'var(--radius-sm)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {children}
        </span>
      )}
    </span>
  );
}
