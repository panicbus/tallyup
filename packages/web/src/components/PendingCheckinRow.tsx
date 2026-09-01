import { Clock } from 'lucide-react';
import type { QueuedPendingCheckin } from '../lib/api';
import { formatWaitTime, isUrgentWait } from '../lib/format';

interface PendingCheckinRowProps {
  checkin: QueuedPendingCheckin;
  onConfirm: (pendingCheckinId: string) => void;
  confirmDisabled: boolean;
  now?: number;
}

export function PendingCheckinRow({ checkin, onConfirm, confirmDisabled, now }: PendingCheckinRowProps) {
  const urgent = isUrgentWait(checkin.createdAt, now);

  return (
    <li
      className="tu-fadein"
      style={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 16px',
        background: 'var(--color-surface)',
        borderRadius: 'var(--radius-md)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15 }}>{checkin.maskedPhone}</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 12,
            color: urgent ? 'var(--color-accent-700)' : 'var(--color-neutral-600)',
            fontWeight: urgent ? 700 : 400,
          }}
        >
          <Clock size={12} /> {formatWaitTime(checkin.createdAt, now)}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button
          type="button"
          className="btn btn-primary"
          style={{ fontSize: 14 }}
          onClick={() => onConfirm(checkin.id)}
          disabled={confirmDisabled}
        >
          Confirm
        </button>
      </div>
    </li>
  );
}
