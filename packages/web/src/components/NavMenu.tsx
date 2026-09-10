import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';

interface NavMenuProps {
  tabs: { label: string; href: string }[];
  currentPath: string;
  onAbout: () => void;
}

/** The mobile stand-in for the desktop tab row: a hamburger button that
 * drops down every view plus About. Hidden on desktop, where the tab row
 * shows instead. Same open/close behavior as ProfileMenu. */
export function NavMenu({ tabs, currentPath, onAbout }: NavMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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
    <div className="nav-menu" ref={ref}>
      <button
        type="button"
        className="nav-menu-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Menu size={18} />
      </button>
      {open && (
        <div className="dropdown-menu" role="menu">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              to={tab.href}
              role="menuitem"
              aria-current={currentPath === tab.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {tab.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="nav-menu-about"
            onClick={() => {
              setOpen(false);
              onAbout();
            }}
          >
            About
          </button>
        </div>
      )}
    </div>
  );
}
