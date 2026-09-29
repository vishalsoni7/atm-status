import { bankBadge } from '../lib/banks'
import { TONE, type Tone } from '../lib/status'
import { TONE_CLASS } from '../lib/toneStyle'
import { Icon } from './Icon'

// "● Working" pill used in the list.
export function StatusPill({ tone }: { tone: Tone }) {
  const c = TONE_CLASS[tone]
  return (
    <span className={`inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold ${c.soft} ${c.text}`}>
      <span className={`size-[7px] rounded-full ${tone === 'unknown' ? 'bg-unknown' : c.solid}`} aria-hidden="true" />
      {TONE[tone].label}
    </span>
  )
}

// Round icon: ✓ / ✕ / ?
export function StatusIcon({ tone, size = 48 }: { tone: Tone; size?: number }) {
  const bg = tone === 'unknown' ? 'bg-unknown-pin' : TONE_CLASS[tone].solid
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full text-white ${bg}`} style={{ width: size, height: size }} aria-hidden="true">
      <Icon name={TONE[tone].icon} size={Math.round(size * 0.5)} stroke={3} />
    </span>
  )
}

// Square tile with the bank's short name, tinted by status (list rows).
export function BankTile({ bank, tone }: { bank: string; tone: Tone }) {
  const { short } = bankBadge(bank)
  const c = TONE_CLASS[tone]
  return (
    <span
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-bold ${c.soft} ${c.text} ${short.length > 4 ? 'text-[10px]' : 'text-xs'}`}
      aria-hidden="true"
    >
      {short}
    </span>
  )
}

// Round bank-coloured badge (bank picker).
export function BankBadge({ bank, size = 28 }: { bank: string; size?: number }) {
  const { short, color } = bankBadge(bank)
  const fontSize = size * (short.length <= 3 ? 0.34 : short.length === 4 ? 0.28 : 0.23)
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: color, fontSize }}
      aria-hidden="true"
    >
      {short}
    </span>
  )
}
