import type { Lifecycle, ReportReason, ReportStatus } from './types'
import { timeAgo } from './time'

// v1 shows two statuses. A report counts for this long; after that it's Unknown.
export const FRESH_HOURS = 10
export const FRESH_MS = FRESH_HOURS * 60 * 60 * 1000

export type Tone = 'ok' | 'down' | 'unknown'

export const TONE: Record<Tone, { label: string; icon: 'check' | 'xmark' | 'question' }> = {
  ok: { label: 'Working', icon: 'check' },
  down: { label: 'Not working', icon: 'xmark' },
  unknown: { label: 'Unknown', icon: 'question' },
}

// Reasons offered under "Not working", in display order.
export const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'no_cash', label: 'No cash' },
  { id: 'machine_off', label: 'Machine is off' },
  { id: 'shutter_closed', label: 'Shutter closed' },
  { id: 'out_of_service', label: 'Out of service screen' },
  { id: 'card_not_accepted', label: 'Card not accepted' },
  { id: 'other', label: 'Other' },
]

// Older reports used a separate 'no_cash' status; it now reads as Not working.
export function toneOfStatus(status: ReportStatus): Tone {
  return status === 'working' ? 'ok' : 'down'
}

export function reasonOf(status: ReportStatus, reason: ReportReason | null | undefined): ReportReason | null {
  return reason ?? (status === 'no_cash' ? 'no_cash' : null)
}

export function reasonLabel(reason: ReportReason | null): string | null {
  return REASONS.find((r) => r.id === reason)?.label ?? null
}

// "Working" or "Not working · No cash".
export function reportLabel(status: ReportStatus, reason?: ReportReason | null): string {
  const r = reasonLabel(reasonOf(status, reason))
  return r ? `${TONE[toneOfStatus(status)].label} · ${r}` : TONE[toneOfStatus(status)].label
}

// Current status of an ATM from its latest report.
export function currentTone(
  status: ReportStatus | null,
  reportedAt: string | null,
  lifecycle?: Lifecycle,
  now = Date.now(),
): Tone {
  if (lifecycle === 'suspected_removed' || !status || !reportedAt) return 'unknown'
  return now - new Date(reportedAt).getTime() > FRESH_MS ? 'unknown' : toneOfStatus(status)
}

// Small grey text under a status: "12 min ago", or why it's Unknown.
export function whenLabel(reportedAt: string | null, tone: Tone, now = Date.now()): string {
  if (!reportedAt) return 'No reports yet'
  if (tone !== 'unknown') return timeAgo(reportedAt, now)
  const hrs = (now - new Date(reportedAt).getTime()) / 3_600_000
  return hrs < 24 ? 'No reports today' : `Last report ${timeAgo(reportedAt, now)}`
}
