import type { RosterEntry } from '../lib/api';
import { formatJoinedDate } from '../lib/format';

interface RosterTableProps {
  items: RosterEntry[];
}

/** Desktop rendering of the customer roster — the app's first table,
 * reusing the design system's ported `.table` styling. See RosterCardList
 * for the mobile equivalent; the two are swapped by CSS, not JS. */
export function RosterTable({ items }: RosterTableProps) {
  return (
    <div className="roster-table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Phone</th>
            <th>Current points</th>
            <th>Lifetime points</th>
            <th>Rewards given</th>
            <th>Joined</th>
            <th>SMS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td style={{ fontFamily: 'ui-monospace, monospace' }}>{item.displayPhone}</td>
              <td>{item.points}</td>
              <td>{item.lifetimePoints}</td>
              <td>{item.rewardsGiven}</td>
              <td>{formatJoinedDate(item.joinedAt)}</td>
              <td>
                {item.hasSmsConsent ? (
                  <span className="tag tag-accent-2">Opted in</span>
                ) : (
                  <span className="text-muted">No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
