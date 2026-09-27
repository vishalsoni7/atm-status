import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ContactCard } from '../components/ContactCard'
import { Icon, Spinner } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Hud, Sheet } from '../components/Sheet'
import { BankBadge, StatusIcon } from '../components/Status'
import { RateLimitedError, fetchAtm, fetchHistory, submitReport } from '../lib/api'
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

  return (
    <Screen
      title={atm.bank}
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
          {hud && <Hud text={hud} />}
        </>
      }
    >
      <div className="hero">
        <BankBadge bank={atm.bank} size={76} />
        <h1>{atm.bank}</h1>
        <p>{[atm.address, atm.landmark && `near ${atm.landmark}`].filter(Boolean).join(', ') || 'Address not added yet'}</p>
      </div>

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

      <section className={`status-card tone-bg-${stale ? 'unknown' : tone}`}>
        <StatusIcon tone={stale ? 'unknown' : tone} size={48} />
        <div>
          <h2>
            {atm.lifecycle === 'suspected_removed'
              ? 'Possibly removed'
              : atm.last_status
                ? STATUS[atm.last_status].long
                : 'No reports yet'}
          </h2>
          <p>
            {atm.lifecycle === 'suspected_removed'
              ? 'Only “not working” reports for a week. Tap Report if you see it working.'
              : !atm.last_reported_at
                ? 'Used this ATM? Tap Report so others know.'
                : stale
                  ? `Last report ${timeAgo(atm.last_reported_at)}. It may have changed since.`
                  : `Reported ${timeAgo(atm.last_reported_at)}`}
          </p>
        </div>
      </section>

      {justReported && <ContactCard source="after_report" />}

      <h3 className="group-header">Recent reports</h3>
      {history.length === 0 ? (
        <div className="group group-empty">No reports yet</div>
      ) : (
        <ul className="group">
          {history.map((h, i) => (
            <li key={i} className="cell cell-history">
              <StatusIcon tone={h.status} size={28} />
              <span className="cell-title">{STATUS[h.status].long}</span>
              <span className="cell-meta">{timeAgo(h.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="group-footer">Reports are anonymous. You can report each ATM once every 10 minutes.</p>
    </Screen>
  )
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
      <p className="sheet-sub">{atm.bank}{atm.address ? `, ${atm.address}` : ''}</p>
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
