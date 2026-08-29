import { useEffect, useRef, useState } from 'react';
import { ImageIcon } from 'lucide-react';

/**
 * Business logo field — client-side preview only. Upload/storage wiring is a
 * later waypoint; this component's whole job today is to feel like a real,
 * working control while there's nowhere yet for the file to go.
 */
export function LogoPicker() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  return (
    <div className="field">
      <label htmlFor="business-logo">
        Business logo <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 12,
            flex: 'none',
            overflow: 'hidden',
            background: 'var(--color-surface)',
            border: previewUrl ? 'none' : '1px dashed var(--color-neutral-400)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ImageIcon size={20} color="var(--color-neutral-500)" />
          )}
        </div>
        <button type="button" className="btn btn-primary" style={{ fontSize: 14 }} onClick={() => inputRef.current?.click()}>
          Upload image
        </button>
        <input
          id="business-logo"
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleChange}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        />
      </div>
    </div>
  );
}
