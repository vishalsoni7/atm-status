import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RateLimitedError, submitReport } from '../lib/api'
import { atmName } from '../lib/banks'
import type { NearbyAtm } from '../lib/types'
import { Icon, Spinner } from './Icon'
import { BankBadge } from './Status'

const DISMISSED_KEY = 'atm-status:at-atm-dismissed'

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

// Card at the top of the list when you're standing at an ATM. "Working" sends
// in one tap; "Not working" opens the report screen to pick a reason.
// With several ATMs in range, it first asks which one.
export function AtAtmPrompt({ atms, onReported }: { atms: NearbyAtm[]; onReported: () => void }) {
  const navigate = useNavigate()
  const [chosenId, setChosenId] = useState<string | null>(atms.length === 1 ? atms[0].id : null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(() => atms.every((a) => readDismissed().includes(a.id)))

  if (dismissed) return null
  const atm = atms.find((a) => a.id === chosenId) ?? null

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...readDismissed(), ...atms.map((a) => a.id)]))
    } catch {
      // Private mode: it just hides for now.
    }
    setDismissed(true)
  }

  async function working(a: NearbyAtm) {
    navigator.vibrate?.(10)
    setSending(true)
    setMessage(null)
    try {
      await submitReport(a.id, 'working')
      setDone(true)
      onReported()
    } catch (err) {
      setMessage(
        err instanceof RateLimitedError
          ? 'You reported this ATM a few minutes ago. Thanks!'
          : "Couldn't send your report. Check your internet connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  const close = (
    <button onClick={dismiss} aria-label="Not now" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-ink">
      <Icon name="xmark" size={16} />
    </button>
  )

  if (!atm) {
    return (
      <section className="flex flex-col gap-3 rounded-[18px] bg-info-soft p-4" aria-label="Which ATM are you at?">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-info-ink">You're at an ATM</h2>
            <p className="text-sm text-info-ink">Which one? Tap it to report its status.</p>
          </div>
          {close}
        </div>
        {atms.map((a) => (
          <button key={a.id} onClick={() => setChosenId(a.id)} className="flex items-center gap-3 rounded-[14px] bg-white p-2.5 text-left font-semibold">
            <BankBadge bank={a.bank} size={32} />
            <span className="flex-1">{atmName(a.bank)}</span>
            <Icon name="chevronRight" size={18} />
          </button>
        ))}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-[18px] bg-info-soft p-4" aria-label={`You're at ${atmName(atm.bank)}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h2 className="text-lg font-bold text-info-ink">You're at {atmName(atm.bank)}</h2>
          <p className="text-sm text-info-ink">{done ? 'Thanks! Everyone nearby can see your update.' : 'Is it working right now?'}</p>
        </div>
        {!done && close}
      </div>
      {!done && (
        <div className="flex gap-2.5">
          <button
            onClick={() => working(atm)}
            disabled={sending}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-ok font-bold text-white disabled:opacity-70"
          >
            {sending ? <Spinner size={18} /> : <Icon name="check" size={18} stroke={3} />} Working
          </button>
          <button
            onClick={() => navigate(`/atm/${atm.id}/report?answer=no`)}
            disabled={sending}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[14px] bg-down font-bold text-white"
          >
            <Icon name="xmark" size={18} stroke={3} /> Not working
          </button>
        </div>
      )}
      {message && <p className="text-sm text-info-ink">{message}</p>}
    </section>
  )
}
