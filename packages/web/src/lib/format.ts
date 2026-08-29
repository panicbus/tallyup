const URGENT_WAIT_MS = 90_000;

export function formatWaitTime(createdAt: string, now: number = Date.now()): string {
  const elapsedMs = Math.max(0, now - new Date(createdAt).getTime());
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')} waiting`;
}

export function isUrgentWait(createdAt: string, now: number = Date.now()): boolean {
  return now - new Date(createdAt).getTime() > URGENT_WAIT_MS;
}
