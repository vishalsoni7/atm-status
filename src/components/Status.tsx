import { bankBadge } from '../lib/banks'
import { isStale, timeAgo } from '../lib/time'
import { STATUS, type Tone } from '../lib/status'
import type { Lifecycle, ReportStatus } from '../lib/types'
import { Icon, type IconName } from './Icon'

interface Props {
  status: ReportStatus | null
  reportedAt: string | null
  lifecycle?: Lifecycle
}

// One-line status for list rows: coloured dot, label, age.
export function StatusLine({ status, reportedAt, lifecycle, confirmed = true }: Props & { confirmed?: boolean }) {
  if (!confirmed) {
    return (
      <span className="status status-unknown">
        <span className="pill-unconfirmed">Unconfirmed</span>
        {status && reportedAt ? `${STATUS[status].label} ${timeAgo(reportedAt)}` : 'Added by a visitor'}
      </span>
    )
  }
  if (lifecycle === 'suspected_removed') return <span className="status status-unknown">Possibly removed</span>
  if (!status || !reportedAt) return <span className="status status-unknown">No reports yet</span>
  const stale = isStale(reportedAt)
  return (
    <span className={`status status-${stale ? 'unknown' : status}`}>
      <span className={`status-dot tone-${status}`} />
      {STATUS[status].label}
      <span className="status-age">{timeAgo(reportedAt)}</span>
    </span>
  )
}

export function StatusIcon({ tone, size = 28, faded }: { tone: Tone; size?: number; faded?: boolean }) {
  const icon: IconName = tone === 'unknown' ? 'question' : STATUS[tone].icon
  return (
    <span className={`status-icon tone-${tone}${faded ? ' status-icon-faded' : ''}`} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.58)} stroke={2.6} />
    </span>
  )
}

export function BankBadge({ bank, size = 44 }: { bank: string; size?: number }) {
  const { short, color } = bankBadge(bank)
  const fontSize = size * (short.length <= 3 ? 0.34 : short.length === 4 ? 0.28 : 0.23)
  return (
    <span className="badge" style={{ width: size, height: size, background: color, fontSize }} aria-hidden="true">
      {short}
    </span>
  )
}
