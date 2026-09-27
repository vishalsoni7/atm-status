import { useState } from 'react'
import { RateLimitedError, submitReport } from '../lib/api'
import { STATUS } from '../lib/status'
import type { NearbyAtm, ReportStatus } from '../lib/types'
import { Icon, Spinner } from './Icon'
import { BankBadge, StatusIcon } from './Status'

const DISMISSED_KEY = 'atm-status:at-atm-dismissed'

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]')
  } catch {
    return []
  }
}

const ORDER: ReportStatus[] = ['working', 'no_cash', 'not_working']
const SHORT: Record<ReportStatus, string> = { working: 'Working', no_cash: 'No cash', not_working: 'Not working' }

// One-tap report card shown at the top of the list when you're at an ATM.
// With several ATMs in range, it first asks which one.
export function AtAtmPrompt({ atms, onReported }: { atms: NearbyAtm[]; onReported: () => void }) {
  const [chosenId, setChosenId] = useState<string | null>(atms.length === 1 ? atms[0].id : null)
  const [sending, setSending] = useState<ReportStatus | null>(null)
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

  if (!atm) {
    return (
      <section className="here-card" aria-label="Which ATM are you at?">
        <div className="here-head">
          <div className="here-title">
            <h3>You're at an ATM</h3>
            <p>Which one? Tap it to report its status.</p>
          </div>
          <button className="here-dismiss" onClick={dismiss} aria-label="Not now">
            <Icon name="xmark" size={12} stroke={3} />
          </button>
        </div>
        <div className="here-choices">
          {atms.map((a) => (
            <button key={a.id} className="here-choice" onClick={() => setChosenId(a.id)}>
              <BankBadge bank={a.bank} size={32} />
              <span className="here-choice-name">{a.bank}</span>
              <Icon name="chevronRight" size={14} stroke={2.6} />
            </button>
          ))}
        </div>
      </section>
    )
  }

  async function send(atm: NearbyAtm, status: ReportStatus) {
    navigator.vibrate?.(10)
    setSending(status)
    setMessage(null)
    try {
      await submitReport(atm.id, status)
      setDone(true)
      onReported()
    } catch (err) {
      setMessage(
        err instanceof RateLimitedError
          ? 'You reported this ATM a few minutes ago. Thanks!'
          : "Couldn't send your report. Check your internet connection and try again.",
      )
    } finally {
      setSending(null)
    }
  }

  const place = atm.landmark ? `near ${atm.landmark}` : atm.address
  return (
    <section className="here-card" aria-label={`You're at ${atm.bank}`}>
      <div className="here-head">
        <BankBadge bank={atm.bank} size={40} />
        <div className="here-title">
          <h3>You're at {atm.bank}</h3>
          <p>{place || 'Right next to you'}</p>
        </div>
        {!done && (
          <button className="here-dismiss" onClick={dismiss} aria-label="Not now">
            <Icon name="xmark" size={12} stroke={3} />
          </button>
        )}
      </div>

      {done ? (
        <p className="here-done" role="status">
          <StatusIcon tone="working" size={22} />
          Thanks! Your report helps people nearby.
        </p>
      ) : (
        <>
          <p className="here-question">Is it working?</p>
          <div className="here-options">
            {ORDER.map((s) => (
              <button
                key={s}
                className={`here-btn here-${s}`}
                disabled={sending !== null}
                onClick={() => send(atm, s)}
                aria-label={STATUS[s].long}
              >
                {sending === s ? <Spinner size={22} /> : <Icon name={STATUS[s].icon} size={22} stroke={2.4} />}
                {SHORT[s]}
              </button>
            ))}
          </div>
          {message && <p className="here-message">{message}</p>}
        </>
      )}
    </section>
  )
}
