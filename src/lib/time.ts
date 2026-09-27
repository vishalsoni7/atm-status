export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.round(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

// Reports older than this are shown greyed out as "last known".
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000

export function isStale(iso: string, now = Date.now()): boolean {
  return now - new Date(iso).getTime() > STALE_AFTER_MS
}
