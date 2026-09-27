import type { IconName } from '../components/Icon'
import type { Lifecycle, ReportStatus } from './types'

export const STATUS: Record<ReportStatus, { label: string; long: string; icon: IconName }> = {
  working: { label: 'Working', long: 'Working', icon: 'check' },
  no_cash: { label: 'No cash', long: 'Working, but no cash', icon: 'banknote' },
  not_working: { label: 'Not working', long: 'Not working', icon: 'xmark' },
}

export type Tone = ReportStatus | 'unknown'

export function toneOf(status: ReportStatus | null, lifecycle?: Lifecycle): Tone {
  return lifecycle === 'suspected_removed' || !status ? 'unknown' : status
}
