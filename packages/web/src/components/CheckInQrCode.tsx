import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

type Props = {
  slug: string;
  businessName: string;
  /** QR module size in px; the white frame around it adds 16px. Default 164 (matches onboarding). */
  size?: number;
};

// Matches index.css's h2 (32px) and --font-heading, at the same 3x scale as
// the rest of the export — the business name is printed on this, it isn't
// styled UI, so it's drawn straight onto the canvas at a fixed size rather
// than read from a CSS variable.
const NAME_FONT_SIZE = 32;
const NAME_MIN_FONT_SIZE = 12; // floor before truncating with an ellipsis instead of shrinking further
const NAME_PADDING_X = 20;
const NAME_PADDING_Y = 20;

/**
 * The business's customer check-in QR code, rendered from its slug alone.
 * The value encoded is `${origin}/checkin/${slug}` — fully derived, nothing
 * stored — so this renders a byte-identical code wherever it's shown
 * (onboarding's "you're ready" screen, the dashboard empty state, and
 * Settings). The business name only appears on the downloaded image, not
 * the on-screen preview — the surrounding page already shows it.
 */
export function CheckInQrCode({ slug, businessName, size = 164 }: Props) {
  const qrRef = useRef<SVGSVGElement>(null);
  const checkinUrl = `${window.location.origin}/checkin/${slug}`;
  const displayUrl = `${window.location.host}/checkin/${slug}`;

  function handleSaveQr() {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = async () => {
      const scale = 3;
      const fontSize = NAME_FONT_SIZE * scale;
      const labelHeight = fontSize + NAME_PADDING_Y * scale * 2;

      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale + labelHeight;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(svgUrl);
      if (!ctx) return;

      ctx.fillStyle = '#fff'; // scan contrast, not a theme color — see the frame above
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Canvas text doesn't wait for web fonts the way the DOM does — without
      // this, the name can silently render in a fallback system font instead
      // of Space Grotesk. A failure here (an older browser, a slow fetch)
      // just means that fallback, not a broken download.
      try {
        await document.fonts.load(`700 ${fontSize}px "Space Grotesk"`);
      } catch {
        // fall through with whatever's already loaded
      }

      ctx.fillStyle = '#1c2230'; // fixed ink, same reasoning as the white frame: this is printed, not themed
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxTextWidth = canvas.width - NAME_PADDING_X * scale * 2;
      const minFontSize = NAME_MIN_FONT_SIZE * scale;
      let nameSize = fontSize;
      ctx.font = `700 ${nameSize}px "Space Grotesk", system-ui, sans-serif`;
      while (ctx.measureText(businessName).width > maxTextWidth && nameSize > minFontSize) {
        nameSize -= scale;
        ctx.font = `700 ${nameSize}px "Space Grotesk", system-ui, sans-serif`;
      }
      let label = businessName;
      if (ctx.measureText(label).width > maxTextWidth) {
        // Shrinking alone couldn't get an unusually long name to fit even at
        // the smallest allowed size — truncate rather than let it run off
        // the edges of a printed sign.
        while (label.length > 1 && ctx.measureText(`${label}…`).width > maxTextWidth) {
          label = label.slice(0, -1);
        }
        label = `${label}…`;
      }
      ctx.fillText(label, canvas.width / 2, labelHeight / 2);

      ctx.drawImage(img, 0, labelHeight, img.width * scale, img.height * scale);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${slug}-qr.png`;
        a.click();
        URL.revokeObjectURL(downloadUrl);
      }, 'image/png');
    };
    img.src = svgUrl;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <h2 style={{ margin: 0, textAlign: 'center' }}>{businessName}</h2>
      <div
        className="elev-md"
        style={{
          width: size + 16,
          height: size + 16,
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // Hardcoded white, not var(--color-surface): a scanner needs real
          // contrast against the QR's black modules, in print and in dark
          // mode alike, so this frame stays white regardless of theme.
          border: '8px solid #fff',
          background: '#fff',
        }}
      >
        <QRCodeSVG ref={qrRef} value={checkinUrl} size={size} />
      </div>
      <p style={{ fontFamily: 'ui-monospace, monospace', margin: 0 }}>{displayUrl}</p>
      <button
        type="button"
        onClick={handleSaveQr}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          textDecoration: 'underline',
          background: 'none',
          border: 'none',
          color: 'var(--color-accent-700)',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <Download size={14} /> Download QR code image or save to photos.
      </button>
    </div>
  );
}
