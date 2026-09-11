import { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

type Props = {
  slug: string;
  /** QR module size in px; the white frame around it adds 16px. Default 164 (matches onboarding). */
  size?: number;
};

/**
 * The business's customer check-in QR code, rendered from its slug alone.
 * The value encoded is `${origin}/checkin/${slug}` — fully derived, nothing
 * stored — so this renders a byte-identical code wherever it's shown
 * (onboarding's "you're ready" screen and Settings).
 */
export function CheckInQrCode({ slug, size = 164 }: Props) {
  const qrRef = useRef<SVGSVGElement>(null);
  const checkinUrl = `${window.location.origin}/checkin/${slug}`;
  const displayUrl = `${window.location.host}/checkin/${slug}`;

  function handleSaveQr() {
    const svg = qrRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(svgUrl);
      if (!ctx) return;
      ctx.fillStyle = '#fff'; // scan contrast, not a theme color — see the frame above
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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
