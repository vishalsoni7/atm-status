import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Icon, Spinner } from '../components/Icon'
import { RateLimitedError, fetchAtm, submitReport } from '../lib/api'
import { atmName } from '../lib/banks'
import { REPORT_RADIUS_M, directionsUrl, distanceM, formatDistance, isCloseEnough, usePosition } from '../lib/location'
import { useBack } from '../lib/nav'
import { REASONS } from '../lib/status'
import type { Atm, ReportReason } from '../lib/types'

type Answer = 'yes' | 'no'

// Always opens; shows the question only when the person is at the ATM.
export function ReportScreen() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const goBack = useBack()
  const { location, retry } = usePosition()
  const [atm, setAtm] = useState<Atm | null | undefined>(undefined)

  useEffect(() => {
    fetchAtm(id).then(setAtm, () => setAtm(null))
  }, [id])

  const close = () => goBack(`/atm/${id}`)
  const subtitle = atm ? [atmName(atm.bank), atm.landmark || atm.address].filter(Boolean).join(' · ') : ''

  let body: ReactNode
  if (atm === undefined || location.status === 'locating') {
    body = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted">
        <Spinner size={28} />
        <p className="text-[15px]">Checking your location…</p>
      </div>
    )
  } else if (atm === null) {
    body = <Centered title="This ATM isn't listed any more" text="It may have been removed." />
  } else if (location.status !== 'found') {
    body = <NoLocation onRetry={retry} onNotNow={close} />
  } else {
    const dist = distanceM(location.pos, atm)
    body = isCloseEnough(dist, location.pos.accuracy) ? (
      <ReportForm atm={atm} initial={params.get('answer') === 'no' ? 'no' : null} />
    ) : (
      <TooFar atm={atm} distance={dist} onRetry={retry} />
    )
  }

  return (
    <div className="scroll-y absolute inset-0 flex flex-col bg-white px-5 pt-[calc(var(--safe-top)+12px)] pb-[calc(var(--safe-bottom)+32px)]">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-muted">{subtitle}</p>
        <button onClick={close} aria-label="Close" className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-soft text-ink">
          <Icon name="xmark" size={20} />
        </button>
      </div>
      {body}
    </div>
  )
}

function ReportForm({ atm, initial }: { atm: Atm; initial: Answer | null }) {
  const navigate = useNavigate()
  const [answer, setAnswer] = useState<Answer | null>(initial)
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!answer) return
    setSending(true)
    setError(null)
    try {
      await submitReport(atm.id, answer === 'yes' ? 'working' : 'not_working', answer === 'no' ? reason : null)
      navigate(`/atm/${atm.id}/thanks`, { replace: true })
    } catch (err) {
      setError(
        err instanceof RateLimitedError
          ? 'You reported this ATM a few minutes ago. You can report it again after 10 minutes.'
          : "Couldn't send your report. Check your internet connection and try again.",
      )
      setSending(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-7 pt-7">
      <h1 className="font-display text-[32px] leading-[1.12] font-bold tracking-[-0.015em] text-balance">Is this ATM working right now?</h1>

      <div role="group" aria-label="ATM status" className="flex flex-col gap-3">
        <Choice tone="ok" selected={answer === 'yes'} onClick={() => setAnswer('yes')} label="Yes, it's working" />
        <Choice tone="down" selected={answer === 'no'} onClick={() => setAnswer('no')} label="No, it's not working" />
      </div>

      {answer === 'no' && (
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">
            What's wrong? <span className="font-medium text-muted">(optional)</span>
          </h2>
          <div role="group" aria-label="Reason" className="flex flex-wrap gap-2">
            {REASONS.map((r) => {
              const on = reason === r.id
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(on ? null : r.id)}
                  className={`h-11 rounded-full border-[1.5px] px-4 text-[15px] font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-chip bg-white text-ink'}`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {error && <p className="text-center text-sm text-down-ink">{error}</p>}
        <p className="text-center text-[13px] text-muted">Reports are anonymous. Please report only when you're at the ATM.</p>
        <button
          type="button"
          onClick={submit}
          disabled={!answer || sending}
          className="flex h-14 items-center justify-center rounded-2xl bg-primary text-[17px] font-bold text-white active:bg-primary-dark disabled:bg-disabled disabled:text-faint"
        >
          {sending ? <Spinner size={22} /> : answer ? 'Submit report' : 'Choose an answer'}
        </button>
      </div>
    </div>
  )
}

function Choice({
  tone,
  selected,
  onClick,
  label,
  disabled,
}: {
  tone: 'ok' | 'down'
  selected?: boolean
  onClick?: () => void
  label: string
  disabled?: boolean
}) {
  const on = tone === 'ok' ? 'border-ok bg-ok-soft' : 'border-down bg-down-soft'
  const dot = disabled ? 'bg-[#C9CEC8]' : tone === 'ok' ? 'bg-ok' : 'bg-down'
  return (
    <button
      type="button"
      aria-pressed={disabled ? undefined : !!selected}
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[76px] items-center gap-4 rounded-[18px] border-2 px-[18px] text-left ${
        disabled ? 'border-line bg-[#F4F5F3] text-faint' : selected ? on : 'border-line bg-white'
      }`}
    >
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full text-white ${dot}`} aria-hidden="true">
        <Icon name={tone === 'ok' ? 'check' : 'xmark'} size={tone === 'ok' ? 22 : 20} stroke={tone === 'ok' ? 3 : 3.2} />
      </span>
      <span className="text-lg font-bold">{label}</span>
    </button>
  )
}

function TooFar({ atm, distance, onRetry }: { atm: Atm; distance: number; onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col gap-6 pt-6">
      <h1 className="font-display text-[32px] leading-[1.12] font-bold tracking-[-0.015em] text-balance">Is this ATM working right now?</h1>

      <div className="flex items-start gap-3.5 rounded-[18px] bg-info-soft p-[18px]">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white" aria-hidden="true">
          <Icon name="pin" size={22} />
        </span>
        <div className="flex flex-col gap-1 text-info-ink">
          <p className="text-lg font-bold">You're {formatDistance(distance)} away</p>
          <p className="text-sm leading-[1.45]">
            Get within {REPORT_RADIUS_M} m of this ATM to report. This keeps reports accurate for everyone.
          </p>
        </div>
      </div>

      <div role="group" aria-label="ATM status" className="flex flex-col gap-3">
        <Choice tone="ok" label="Yes, it's working" disabled />
        <Choice tone="down" label="No, it's not working" disabled />
      </div>

      <div className="mt-auto flex flex-col gap-2.5">
        <a
          href={directionsUrl(atm.lat, atm.lng)}
          target="_blank"
          rel="noreferrer"
          className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-white"
        >
          <Icon name="navigate" size={18} /> Get directions
        </a>
        <button type="button" onClick={onRetry} className="h-12 text-base font-bold text-primary">
          I'm here now, check again
        </button>
      </div>
    </div>
  )
}

function NoLocation({ onRetry, onNotNow }: { onRetry: () => void; onNotNow: () => void }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center justify-center gap-[18px] text-center">
        <span className="flex size-28 items-center justify-center rounded-full bg-info-soft text-primary" aria-hidden="true">
          <Icon name="pinOff" size={48} stroke={1.8} />
        </span>
        <h1 className="font-display text-[30px] leading-[1.15] font-bold tracking-[-0.015em] text-balance">Turn on location to report</h1>
        <p className="max-w-[310px] text-base leading-normal text-muted text-pretty">
          We only use it to check you're at the ATM. Your location isn't saved or shared.
        </p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={onRetry} className="h-14 rounded-2xl bg-primary text-[17px] font-bold text-white">
          Try again
        </button>
        <button type="button" onClick={onNotNow} className="h-12 text-base font-bold text-primary">
          Not now
        </button>
      </div>
    </div>
  )
}

function Centered({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-[15px] text-muted">{text}</p>
    </div>
  )
}
