import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AtmMap } from '../components/AtmMap'
import { BankPicker } from '../components/BankPicker'
import { Icon, Spinner } from '../components/Icon'
import { Sheet, Toast } from '../components/Sheet'
import { StatusIcon } from '../components/Status'
import {
  AlreadyNamedError,
  RateLimitedError,
  confirmAtm,
  fetchAtm,
  fetchHistory,
  flagMissing,
  setAtmBank,
} from '../lib/api'
import { UNKNOWN_BANK, atmName } from '../lib/banks'
import { directionsUrl, distanceM, formatDistance, usePosition, walkLabel } from '../lib/location'
import { useBack } from '../lib/nav'
import { useToast } from '../lib/toast'
import { FRESH_HOURS, TONE, currentTone, reasonLabel, reasonOf, reportLabel, toneOfStatus, type Tone } from '../lib/status'
import { timeAgo } from '../lib/time'
import { TONE_CLASS } from '../lib/toneStyle'
import type { Atm, HistoryItem } from '../lib/types'

const HOUR_MS = 60 * 60 * 1000

export function DetailScreen() {
  const { id = '' } = useParams()
  const goBack = useBack()
  const { location } = usePosition()
  const me = location.status === 'found' ? location.pos : null
  const [atm, setAtm] = useState<Atm | null | undefined>(undefined)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [error, setError] = useState(false)
  const [naming, setNaming] = useState(false)
  const [flagging, setFlagging] = useState(false)
  const [toast, showToast] = useToast()
  // When the data was fetched; "N reports in the last hour" is relative to this.
  const [loadedAt, setLoadedAt] = useState(0)

  const load = useCallback(
    () =>
      Promise.all([fetchAtm(id), fetchHistory(id)]).then(
        ([a, h]) => {
          setAtm(a)
          setHistory(h)
          setError(false)
          setLoadedAt(Date.now())
        },
        () => setError(true),
      ),
    [id],
  )
  useEffect(() => {
    load()
  }, [load])

  const closeNaming = useCallback(() => setNaming(false), [])
  const closeFlagging = useCallback(() => setFlagging(false), [])
  const back = (
    <button
      type="button"
      onClick={() => goBack('/')}
      aria-label="Back to map"
      className="absolute top-[calc(var(--safe-top)+12px)] left-4 z-[500] flex size-11 items-center justify-center rounded-[14px] bg-surface text-ink shadow-[0_4px_12px_rgba(21,24,27,0.14)]"
    >
      <Icon name="chevronLeft" size={22} />
    </button>
  )

  if (error && !atm) {
    return <Message back={back} title="Can't load this ATM" text="Check your internet connection, then try again." action={<button onClick={load} className="font-bold text-primary">Try again</button>} />
  }
  if (atm === undefined) {
    return <Message back={back} title="" icon={<Spinner size={28} />} />
  }
  if (atm === null) {
    return <Message back={back} title="This ATM isn't listed any more" text="It may have been removed. Go back to see ATMs near you." />
  }

  const tone = currentTone(atm.last_status, atm.last_reported_at, atm.lifecycle)
  const now = loadedAt
  const lastHour = history.filter((h) => now - new Date(h.created_at).getTime() <= HOUR_MS).length
  const latest = history[0]
  const dist = me ? distanceM(me, atm) : null
  const place = [atm.address, atm.landmark && `near ${atm.landmark}`].filter(Boolean).join(', ')

  return (
    <div className="scroll-y absolute inset-0 bg-ground">
      <div className="relative h-[220px] shrink-0 overflow-hidden bg-mapbg" aria-hidden="true">
        <AtmMap
          view={{ center: atm, zoom: 16 }}
          viewKey={atm.id}
          bottomInset={40}
          atms={[{ ...atm, tone }]}
          interactive={false}
          pinSize={38}
        />
      </div>
      {back}

      <div className="relative z-[400] -mt-5 flex min-h-[calc(100%-200px)] flex-col gap-5 rounded-t-[24px] bg-surface px-5 pt-6 pb-[calc(var(--safe-bottom)+28px)]">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[30px] leading-tight font-bold tracking-[-0.015em]">{atmName(atm.bank)}</h1>
          <p className="text-[15px] text-muted">{place || 'Address not added yet'}</p>
          {dist !== null && (
            <p className="text-sm font-semibold text-muted">
              {formatDistance(dist)} · {walkLabel(dist)}
            </p>
          )}
        </div>

        {atm.confirmed === false && <ConfirmCard atmId={atm.id} onConfirmed={() => { showToast('Confirmed. Thanks!'); load() }} />}

        <StatusCard atm={atm} tone={tone} latest={latest} lastHour={lastHour} />

        <div className="flex gap-2.5">
          <a
            href={directionsUrl(atm.lat, atm.lng)}
            target="_blank"
            rel="noreferrer"
            className="flex h-[52px] flex-1 basis-0 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-chip bg-surface text-base font-bold text-ink"
          >
            <Icon name="navigate" size={18} /> Directions
          </a>
          <Link
            to={`/atm/${atm.id}/report`}
            className="flex h-[52px] flex-1 basis-0 items-center justify-center gap-2 rounded-[14px] bg-primary text-base font-bold text-white active:bg-primary-dark"
          >
            <Icon name="pencil" size={18} /> Report status
          </Link>
        </div>

        {atm.bank === UNKNOWN_BANK && (
          <button
            type="button"
            onClick={() => setNaming(true)}
            className="flex items-center gap-3 rounded-[18px] bg-ground p-4 text-left"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-primary">
              <Icon name="question" size={20} stroke={2.6} />
            </span>
            <span className="flex flex-col">
              <strong className="font-bold text-primary">Which bank runs this ATM?</strong>
              <span className="text-[13px] text-muted">If you know, tap to add it for everyone.</span>
            </span>
          </button>
        )}

        <section className="flex flex-col">
          <h2 className="mb-1.5 text-[13px] font-bold tracking-[0.06em] text-muted uppercase">Recent reports</h2>
          {history.length === 0 ? (
            <p className="border-t border-hair py-3.5 text-[15px] text-muted">No reports yet. Be the first to report.</p>
          ) : (
            <ul>
              {history.slice(0, 10).map((h, i) => (
                <li key={i} className="flex h-12 items-center gap-3 border-t border-hair">
                  <span className={`size-2.5 shrink-0 rounded-full ${TONE_CLASS[toneOfStatus(h.status)].solid}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{reportLabel(h.status, h.reason)}</span>
                  <span className="shrink-0 text-[13px] text-faint">{timeAgo(h.created_at, now)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[13px] text-muted">Reports are anonymous. You can report each ATM once every 10 minutes.</p>
        </section>

        <button type="button" onClick={() => setFlagging(true)} className="mx-auto py-2 text-[15px] font-semibold text-down">
          This ATM isn't here
        </button>
      </div>

      <Sheet open={naming} title="Which bank is it?" onClose={closeNaming}>
        <NameBankForm
          atmId={atm.id}
          onSaved={() => {
            setNaming(false)
            showToast('Bank saved')
            load()
          }}
        />
      </Sheet>
      <Sheet open={flagging} title="Is this ATM missing?" onClose={closeFlagging}>
        <FlagMissingForm
          atmId={atm.id}
          onDone={(hidden) => {
            setFlagging(false)
            showToast(hidden ? 'Removed. Thanks!' : 'Thanks for telling us')
            load()
          }}
          onCancel={closeFlagging}
        />
      </Sheet>
      {toast && <Toast text={toast} />}
    </div>
  )
}

function StatusCard({ atm, tone, latest, lastHour }: { atm: Atm; tone: Tone; latest?: HistoryItem; lastHour: number }) {
  const c = TONE_CLASS[tone]
  const hourNote = lastHour > 0 ? ` · ${lastHour} ${lastHour === 1 ? 'report' : 'reports'} in the last hour` : ''
  let title: string = TONE[tone].label
  let note: string

  if (atm.lifecycle === 'suspected_removed') {
    title = 'Possibly removed'
    note = 'People said this ATM isn’t here. If you see it working, report it.'
  } else if (!atm.last_status || !atm.last_reported_at) {
    note = 'No reports yet. Used this ATM? Report its status.'
  } else if (tone === 'unknown') {
    note = `No reports in the last ${FRESH_HOURS} hours. Last: ${reportLabel(atm.last_status, latest?.reason)}, ${timeAgo(atm.last_reported_at)}.`
  } else if (tone === 'ok') {
    note = `Confirmed ${timeAgo(atm.last_reported_at)}${hourNote}`
  } else {
    const reason = reasonLabel(reasonOf(atm.last_status, latest?.reason))
    note = `${reason ? `${reason} · ` : ''}Reported ${timeAgo(atm.last_reported_at)}${hourNote}`
  }

  return (
    <section className={`flex items-center gap-3.5 rounded-[18px] p-[18px] ${c.soft}`}>
      <StatusIcon tone={tone} size={48} />
      <div className="flex flex-col gap-[3px]">
        <h2 className={`text-xl font-bold ${c.ink}`}>{title}</h2>
        <p className={`text-sm ${c.ink}`}>{note}</p>
      </div>
    </section>
  )
}

function Message({ back, title, text, action, icon }: { back: ReactNode; title: string; text?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ground px-8 text-center">
      {back}
      {icon && <span className="text-faint">{icon}</span>}
      {title && <h1 className="font-display text-2xl font-bold">{title}</h1>}
      {text && <p className="text-[15px] text-muted">{text}</p>}
      {action}
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
    <section className="flex flex-col gap-3 rounded-[18px] border-[1.5px] border-down/40 bg-surface p-4">
      <div>
        <h2 className="text-base font-bold text-down-ink">Not confirmed yet</h2>
        <p className="text-sm text-muted">A visitor added this ATM. If you can see it here, confirm it so others can trust it.</p>
      </div>
      <button
        type="button"
        onClick={confirm}
        disabled={sending}
        className="flex h-12 items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-chip font-bold text-ink"
      >
        {sending ? <Spinner size={18} /> : <><Icon name="check" size={18} stroke={2.6} /> Yes, it's here</>}
      </button>
      {message && <p className="text-[13px] text-muted">{message}</p>}
    </section>
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
          ? 'Someone already added the bank for this ATM.'
          : "Couldn't save. Check your internet connection and try again.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="-mt-1 text-[15px] text-muted">Pick the bank shown on the ATM.</p>
      <BankPicker value={bank} onChange={setBank} />
      {error && <p className="text-sm text-down-ink">{error}</p>}
      <button
        type="button"
        onClick={save}
        disabled={sending || bank.length < 2}
        className="sticky bottom-0 flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-white shadow-[0_-16px_0_8px_var(--color-surface),0_12px_0_8px_var(--color-surface)] disabled:bg-disabled disabled:text-faint"
      >
        {sending ? <Spinner size={20} /> : bank.length < 2 ? 'Choose a bank' : 'Save bank'}
      </button>
    </div>
  )
}

function FlagMissingForm({ atmId, onDone, onCancel }: { atmId: string; onDone: (hidden: boolean) => void; onCancel: () => void }) {
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
    <div className="flex flex-col gap-3">
      <p className="-mt-1 text-[15px] text-muted">
        Use this if the ATM has been removed, or was never at this spot. When two people say it isn't here, we hide it.
      </p>
      {error && <p className="text-sm text-down-ink">{error}</p>}
      <button type="button" onClick={flag} disabled={sending} className="flex h-14 items-center justify-center rounded-2xl bg-down text-[17px] font-bold text-white">
        {sending ? <Spinner size={20} /> : "It isn't here"}
      </button>
      <button type="button" onClick={onCancel} className="h-12 text-base font-bold text-primary">
        Cancel
      </button>
    </div>
  )
}
