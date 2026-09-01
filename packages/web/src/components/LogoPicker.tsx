import { useEffect, useRef, useState } from 'react';
import { ImageIcon, X } from 'lucide-react';
import { ALLOWED_LOGO_TYPES, uploadLogo } from '../lib/logo-upload';

interface LogoPickerProps {
  /** The already-stored logo URL, if the business has one. */
  value?: string | null;
  /** Called with the stored URL once an upload succeeds, or null on removal.
   * Optional so the control still renders standalone. */
  onChange?: (logoUrl: string | null) => void;
}

/**
 * Business logo field. The file goes straight from the browser to Supabase
 * Storage on selection — the API never sees the bytes, only the resulting
 * URL, which it validates against the caller's own storage folder.
 *
 * Uploading on selection rather than on submit means a failure surfaces
 * immediately, next to the control that caused it, instead of taking down
 * an otherwise-valid settings save.
 */
export function LogoPicker({ value, onChange }: LogoPickerProps) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  // The instant local preview wins while it exists, so the image appears the
  // moment it's picked rather than after the round trip to storage.
  const previewUrl = localPreviewUrl ?? value ?? null;

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    setUploading(true);
    const result = await uploadLogo(file);
    setUploading(false);

    if (result.outcome === 'failed') {
      setError(result.reason);
      // Drop the preview: showing an image that was never stored would
      // claim a save that isn't going to happen.
      setLocalPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    onChange?.(result.url);
  }

  function handleRemove() {
    setError(null);
    setLocalPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = '';
    onChange?.(null);
  }

  return (
    <div className="field">
      <label htmlFor="business-logo">
        Business logo <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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
            opacity: uploading ? 0.6 : 1,
          }}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ImageIcon size={20} color="var(--color-neutral-500)" />
          )}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: 14 }}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? 'Uploading…' : previewUrl ? 'Change image' : 'Upload image'}
        </button>
        {previewUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 13,
              background: 'none',
              border: 'none',
              color: 'var(--color-accent-700)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <X size={14} /> Remove logo
          </button>
        )}
        <input
          id="business-logo"
          ref={inputRef}
          type="file"
          accept={ALLOWED_LOGO_TYPES.join(',')}
          onChange={handleChange}
          style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        />
      </div>
      {error && (
        <p role="alert" style={{ color: 'var(--color-accent-700)', fontSize: 13, margin: '6px 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}
