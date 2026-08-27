import type { QueuedPendingCheckin } from '../lib/api';
import { formatWaitTime } from '../lib/format';

interface PendingCheckinRowProps {
  checkin: QueuedPendingCheckin;
  onConfirm: (pendingCheckinId: string) => void;
  confirmDisabled: boolean;
}

export function PendingCheckinRow({ checkin, onConfirm, confirmDisabled }: PendingCheckinRowProps) {
  return (
    <li>
      <span>{checkin.maskedPhone}</span>
      <span>{formatWaitTime(checkin.createdAt)}</span>
      <button type="button" onClick={() => onConfirm(checkin.id)} disabled={confirmDisabled}>
        Confirm
      </button>
    </li>
  );
}
