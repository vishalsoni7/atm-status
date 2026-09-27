import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BankPicker } from '../components/BankPicker'
import { ContactCard } from '../components/ContactCard'
import { Icon, Spinner } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Hud, Sheet } from '../components/Sheet'
import { BankBadge, StatusIcon } from '../components/Status'
import {
  AlreadyNamedError,
  RateLimitedError,
  confirmAtm,
  fetchAtm,
  fetchHistory,
  flagMissing,
  setAtmBank,
  submitReport,
} from '../lib/api'
import { UNKNOWN_BANK, displayBank } from '../lib/banks'
import { directionsUrl } from '../lib/location'
import { useBack } from '../lib/nav'
import { STATUS, toneOf } from '../lib/status'
import { isStale, timeAgo } from '../lib/time'
import type { Atm, HistoryItem, ReportStatus } from '../lib/types'

const BACK = { label: 'ATMs Nearby', to: '/' }

export function Detail() {
  const { id = '' } = useParams()
  const reporting = useLocation().pathname.endsWith('/report')
  const goBack = useBack()
  const [atm, setAtm] = useState<Atm | null | undefined>(undefined)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState(false)
  const [hud, setHud] = useState<string | null>(null)
  const [justReported, setJustReported] = useState(false)
  const [naming, setNaming] = useState(false)
  const [flagging, setFlagging] = useState(false)

  const load = useCallback(
    () =>
      Promise.all([fetchAtm(id), fetchHistory(id)]).then(
        ([a, h]) => {
          setAtm(a)
          setHistory(h)
          setError(false)
        },
        () => setError(true),
      ),
    [id],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!hud) return
    const t = setTimeout(() => setHud(null), 1600)
    return () => clearTimeout(t)
  }, [hud])

  const closeSheet = useCallback(() => goBack(`/atm/${id}`), [goBack, id])
  const closeNaming = useCallback(() => setNaming(false), [])
  const closeFlagging = useCallback(() => setFlagging(false), [])

  if (error && !atm) {
    return (
      <Screen title="ATM" back={BACK}>
        <div className="empty">
          <span className="empty-icon"><Icon name="wifiOff" size={34} stroke={1.8} /></span>
          <h3>Can't load this ATM</h3>
          <p>Check your internet connection, then try again.</p>
          <button className="pill-btn" onClick={load}>Try again</button>
        </div>
      </Screen>
    )
  }
  if (atm === undefined) {
    return <Screen title="ATM" back={BACK}><div className="loading"><Spinner size={26} /></div></Screen>
  }
  if (atm === null) {
    return (
      <Screen title="ATM" back={BACK}>
        <div className="empty">
          <h3>This ATM isn't listed any more</h3>
          <p>It may have been removed. Go back to see ATMs near you.</p>
        </div>
      </Screen>
    )
  }

  const tone = toneOf(atm.last_status, atm.lifecycle)
  const stale = atm.last_reported_at ? isStale(atm.last_reported_at) : false
  const card = statusCard(atm, stale)

  return (
    <Screen
      title={displayBank(atm.bank)}
      back={BACK}
      revealAt={120}
      onRefresh={load}
      overlay={
        <>
          <Sheet open={reporting} title="Is it working?" onClose={closeSheet}>
            <ReportOptions
              atm={atm}
              onSent={() => {
                closeSheet()
                setHud('Report sent')
                setJustReported(true)
                load()
              }}
            />
          </Sheet>
          <Sheet open={naming} title="Which bank is it?" onClose={closeNaming}>
            <NameBankForm
              atmId={atm.id}
              onSaved={() => {
                setNaming(false)
                setHud('Bank saved')
                load()
              }}
            />
          </Sheet>
          <Sheet open={flagging} title="Is this ATM missing?" onClose={closeFlagging}>
            <FlagMissingForm
              atmId={atm.id}
              onDone={(hidden) => {
                setFlagging(false)
                setHud(hidden ? 'Removed. Thanks!' : 'Thanks for telling us')
                load()
              }}
              onCancel={closeFlagging}
            />
          </Sheet>
          {hud && <Hud text={hud} />}
        </>
      }
    >
      <div className="hero">
        <BankBadge bank={atm.bank} size={76} />
        <h1>{displayBank(atm.bank)}</h1>
        <p>{[atm.address, atm.landmark && `near ${atm.landmark}`].filter(Boolean).join(', ') || 'Address not added yet'}</p>
      </div>

      {atm.confirmed === false && <ConfirmCard atmId={atm.id} onConfirmed={() => { setHud('Confirmed. Thanks!'); load() }} />}

      {atm.bank === UNKNOWN_BANK && (
        <button className="add-atm-row name-bank-row" onClick={() => setNaming(true)}>
          <span className="add-atm-icon"><Icon name="question" size={18} stroke={2.6} /></span>
          <span>
            <strong>Which bank runs this ATM?</strong>
            <small>If you know, tap to add it for everyone.</small>
          </span>
        </button>
      )}

      <div className="actions">
        <a className="action" href={directionsUrl(atm.lat, atm.lng)} target="_blank" rel="noreferrer">
          <Icon name="directions" size={24} />
          Directions
        </a>
        <Link className="action" to={`/atm/${atm.id}/report`}>
          <Icon name="flag" size={24} />
          Report
        </Link>
      </div>

      {/* Old reports keep their icon but faded and without colour, so it reads as "last known", not "now". */}
      <section className={`status-card${stale ? '' : ` tone-bg-${tone}`}`}>
        <StatusIcon tone={tone} size={48} faded={stale} />
        <div>
          <h2>{card.heading}</h2>
          <p>{card.note}</p>
        </div>
      </section>

      {justReported && <ContactCard source="after_report" />}

      {/* One report is already shown in the card above; list history only once there's more. */}
      {history.length > 1 && (
        <>
          <h3 className="group-header">Recent reports</h3>
          <ul className="group">
            {history.map((h, i) => (
              <li key={i} className="cell cell-history">
                <StatusIcon tone={h.status} size={28} />
                <span className="cell-title">{STATUS[h.status].long}</span>
                <span className="cell-meta">{timeAgo(h.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="group-footer">Reports are anonymous. You can report each ATM once every 10 minutes.</p>

      <button className="missing-btn" onClick={() => setFlagging(true)}>This ATM isn't here</button>
    </Screen>
  )
}

function statusCard(atm: Atm, stale: boolean): { heading: string; note: string } {
  if (atm.lifecycle === 'suspected_removed') {
    return {
      heading: 'Possibly removed',
      note: 'Only “not working” reports for a week. Tap Report if you see it working.',
    }
  }
  if (!atm.last_status || !atm.last_reported_at) {
    return { heading: 'No reports yet', note: 'Used this ATM? Tap Report so others know.' }
  }
  const { label, long } = STATUS[atm.last_status]
  const ago = timeAgo(atm.last_reported_at)
  return stale
    ? { heading: `Last reported ${label.toLowerCase()}`, note: `${ago}. It may have changed since.` }
    : { heading: long, note: `Reported ${ago}` }
}

const OPTIONS: { status: ReportStatus; hint: string }[] = [
  { status: 'working', hint: 'Screen on and giving cash' },
  { status: 'no_cash', hint: 'Screen on, but no cash came out' },
  { status: 'not_working', hint: 'Off, closed or showing an error' },
]

function ReportOptions({ atm, onSent }: { atm: Atm; onSent: () => void }) {
  const [sending, setSending] = useState<ReportStatus | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function send(status: ReportStatus) {
    navigator.vibrate?.(10)
    setSending(status)
    setMessage(null)
    try {
      await submitReport(atm.id, status)
      onSent()
    } catch (err) {
      setMessage(
        err instanceof RateLimitedError
          ? 'You reported this ATM a few minutes ago. You can report it again after 10 minutes.'
          : "Couldn't send your report. Check your internet connection and try again.",
      )
    } finally {
      setSending(null)
    }
  }

  return (
    <div className="sheet-body">
      <p className="sheet-sub">{displayBank(atm.bank)}{atm.address ? `, ${atm.address}` : ''}</p>
      <div className="group">
        {OPTIONS.map((o) => (
          <button
            key={o.status}
            className="cell cell-option"
            disabled={sending !== null}
            onClick={() => send(o.status)}
          >
            <StatusIcon tone={o.status} size={36} />
            <span className="cell-body">
              <span className="cell-title">{STATUS[o.status].long}</span>
              <span className="cell-sub">{o.hint}</span>
            </span>
            {sending === o.status && <Spinner />}
          </button>
        ))}
      </div>
      {message && <p className="sheet-message">{message}</p>}
    </div>
  )
}

function NameBankForm({ atmId, onSaved }: { atmId: string; onSaved: () => void }) {
  const [bank, setBank] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSending(true)
    setError(null)
    try {
      await setAtmBank(atmId, bank)
      onSaved()
    } catch (err) {
      setError(
        err instanceof AlreadyNamedError
          ? 'Someone already added the bank for this ATM. Pull down to refresh.'
          : "Couldn't save. Check your internet connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="sheet-body">
      <p className="sheet-sub">Pick the bank shown on the ATM.</p>
      <BankPicker value={bank} onChange={setBank} />
      {error && <p className="sheet-message">{error}</p>}
      <button className="primary-btn" onClick={save} disabled={sending || bank.length < 2}>
        {sending ? <Spinner size={20} /> : 'Save bank'}
      </button>
    </div>
  )
}

// Shown on ATMs a visitor added: a second person confirms they're real.
function ConfirmCard({ atmId, onConfirmed }: { atmId: string; onConfirmed: () => void }) {
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function confirm() {
    setSending(true)
    setMessage(null)
    try {
      const result = await confirmAtm(atmId)
      if (result === 'needs_someone_else') setMessage('Thanks! Someone else needs to confirm the ATM you added.')
      else onConfirmed()
    } catch {
      setMessage("Couldn't confirm. Check your internet connection and try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="confirm-card">
      <div>
        <h3>Not confirmed yet</h3>
        <p>A visitor added this ATM. If you can see it here, confirm it so others can trust it.</p>
      </div>
      <button className="confirm-btn" onClick={confirm} disabled={sending}>
        {sending ? <Spinner size={18} /> : <><Icon name="check" size={18} stroke={2.6} /> Yes, it's here</>}
      </button>
      {message && <p className="confirm-message">{message}</p>}
    </section>
  )
}

function FlagMissingForm({
  atmId,
  onDone,
  onCancel,
}: {
  atmId: string
  onDone: (hidden: boolean) => void
  onCancel: () => void
}) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function flag() {
    setSending(true)
    setError(null)
    try {
      onDone((await flagMissing(atmId)) === 'hidden')
    } catch (err) {
      setError(
        err instanceof RateLimitedError
          ? "You've reported a lot of missing ATMs today. Try again tomorrow."
          : "Couldn't send. Check your internet connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="sheet-body">
      <p className="sheet-sub">
        Use this if the ATM has been removed, or was never at this spot. When two people say it isn't here, we hide it.
      </p>
      {error && <p className="sheet-message">{error}</p>}
      <button className="primary-btn danger-btn" onClick={flag} disabled={sending}>
        {sending ? <Spinner size={20} /> : "It isn't here"}
      </button>
      <button className="secondary-btn" onClick={onCancel}>Cancel</button>
    </div>
  )
}
