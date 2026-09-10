import type { RosterEntry } from '../lib/api';
import { formatJoinedDate } from '../lib/format';

interface RosterCardListProps {
  items: RosterEntry[];
}

/** Mobile rendering of the customer roster, matching PendingCheckinRow's
 * card styling. See RosterTable for the desktop equivalent; the two are
 * swapped by CSS, not JS. */
export function RosterCardList({ items }: RosterCardListProps) {
  return (
    <ul className="roster-cards" style={{ margin: 0, padding: 0 }}>
      {items.map((item) => (
        <li
          key={item.id}
          className="tu-fadein"
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '14px 16px',
            background: 'var(--color-surface)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15 }}>{item.displayPhone}</span>
            {item.hasSmsConsent && <span className="tag tag-accent-2">Opted in</span>}
            <span className="text-muted" style={{ fontSize: 13, marginLeft: 'auto' }}>
              {formatJoinedDate(item.joinedAt)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="tag tag-neutral">{item.points} pts now</span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {item.lifetimePoints} lifetime
            </span>
            <span className="text-muted" style={{ fontSize: 13 }}>
              {item.rewardsGiven} {item.rewardsGiven === 1 ? 'reward' : 'rewards'} given
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
