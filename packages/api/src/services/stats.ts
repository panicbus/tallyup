import type { BusinessStats, CheckInPort } from '../data-access/check-in-port.js';

/** The dashboard's headline strip covers a trailing week. One place, so the
 * label the web renders ("Past N days") can't drift from what's counted. */
const STATS_WINDOW_DAYS = 7;

export interface RecentBusinessStats extends BusinessStats {
  windowDays: number;
}

/**
 * Headline counts for the last {@link STATS_WINDOW_DAYS}. `now` is injectable
 * for tests, same as `formatWaitTime` — production always passes the default.
 */
export async function getRecentBusinessStats(
  port: Pick<CheckInPort, 'getBusinessStats'>,
  businessId: string,
  now: number = Date.now(),
): Promise<RecentBusinessStats> {
  const since = new Date(now - STATS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const stats = await port.getBusinessStats({ businessId, since });
  return { ...stats, windowDays: STATS_WINDOW_DAYS };
}
