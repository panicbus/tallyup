import type { CSSProperties } from 'react';

interface LogoProps {
  size?: number;
  style?: CSSProperties;
}

/**
 * The TallyUp mark, inlined as JSX rather than an <img src="/logo.svg">.
 * An externally-referenced SVG image can't see the host page's CSS
 * variables, so its outline stayed the light-mode ink color and nearly
 * disappeared against the dark theme's background — inlining it lets the
 * outline track currentColor like every other icon in the app. The punch
 * dots and confirm badge keep their fixed brand colors in both themes;
 * only the outline adapts. (public/logo.svg — the favicon — is the same
 * art frozen to the light-mode outline, which is fine: favicons render in
 * browser chrome, not on the page.)
 */
export function Logo({ size = 80, style }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      style={{ color: 'var(--color-text)', flex: 'none', ...style }}
    >
      <g stroke="currentColor" strokeWidth={6} strokeLinecap="round">
        <path d="M50 8 L50 20" />
        <path d="M32 14 L38 24" />
        <path d="M68 14 L62 24" />
      </g>
      <rect x="16" y="34" width="68" height="46" rx="11" stroke="currentColor" strokeWidth={6} />
      <g fill="#8fa073">
        <circle cx="34" cy="50" r="6.5" />
        <circle cx="50" cy="50" r="6.5" />
        <circle cx="66" cy="50" r="6.5" />
        <circle cx="34" cy="66" r="6.5" />
        <circle cx="50" cy="66" r="6.5" />
      </g>
      <circle cx="76" cy="72" r="17" fill="#c67139" stroke="#f5ead8" strokeWidth={4} />
      <path
        d="M68 72.5 L74 78.5 L85 65.5"
        stroke="#f5ead8"
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
