export function formatWaitTime(isoDate: string): string {
  const elapsedMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(elapsedMs / 60_000);
  if (minutes < 1) return 'just now';
  return `${minutes}m ago`;
}
