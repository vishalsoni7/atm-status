import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DuplicateAtmError, OutsideIndiaError, RateLimitedError, addAtm } from '../lib/api'
import { getPreciseLocation, type Position } from '../lib/location'
import { BankPicker } from './BankPicker'
import { Icon, Spinner } from './Icon'

// Pins are only as good as the phone's fix; past this we ask them to get closer.
const GOOD_ACCURACY_M = 50

type Fix = { status: 'locating' } | { status: 'found'; pos: Position } | { status: 'failed' }

// Sheet body for adding a missing ATM at the person's current spot.
export function AddAtmForm({ onAdded }: { onAdded: () => void }) {
  const [fix, setFix] = useState<Fix>({ status: 'locating' })
  const [attempt, setAttempt] = useState(0)
  const [bank, setBank] = useState('')
  const [landmark, setLandmark] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getPreciseLocation().then(
      (pos) => live && setFix({ status: 'found', pos }),
      () => live && setFix({ status: 'failed' }),
    )
    return () => {
      live = false
    }
  }, [attempt])

  function relocate() {
    setFix({ status: 'locating' })
    setAttempt((n) => n + 1)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (fix.status !== 'found' || bank.length < 2) return
    setSending(true)
    setError(null)
    setDuplicateId(null)
    try {
      await addAtm(bank, fix.pos.lat, fix.pos.lng, landmark)
      onAdded()
    } catch (err) {
      if (err instanceof DuplicateAtmError) setDuplicateId(err.existingId)
      else
        setError(
          err instanceof RateLimitedError
            ? "You've added a lot of ATMs today. You can add more tomorrow."
            : err instanceof OutsideIndiaError
              ? 'ATM Status only covers ATMs in India for now.'
              : "Couldn't add the ATM. Check your internet connection and try again.",
        )
    } finally {
      setSending(false)
    }
  }

  const rough = fix.status === 'found' && fix.pos.accuracy > GOOD_ACCURACY_M
  const fixTone =
    fix.status === 'found' && !rough ? 'bg-ok-soft text-ok-ink' : fix.status === 'locating' ? 'bg-soft text-muted' : 'bg-down-soft text-down-ink'

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <p className="-mt-1 text-[15px] text-muted">Stand at the ATM. We'll pin it at your current location.</p>

      <div className={`flex flex-wrap items-center gap-2 rounded-[14px] px-3.5 py-3 text-sm font-semibold ${fixTone}`}>
        {fix.status === 'locating' ? (
          <>
            <Spinner size={18} />
            <span>Getting your exact location…</span>
          </>
        ) : fix.status === 'failed' ? (
          <>
            <Icon name="pinOff" size={18} />
            <span className="flex-1">Couldn't get your location. Turn on location (GPS) and allow it for this site.</span>
            <button type="button" className="font-bold text-primary" onClick={relocate}>Try again</button>
          </>
        ) : rough ? (
          <>
            <Icon name="pin" size={18} />
            <span className="flex-1">Location is rough (±{Math.round(fix.pos.accuracy)} m). Step outside or wait a moment.</span>
            <button type="button" className="font-bold text-primary" onClick={relocate}>Retry</button>
          </>
        ) : (
          <>
            <Icon name="pin" size={18} />
            <span>Location found (±{Math.round(fix.pos.accuracy)} m)</span>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-bold">Bank</h3>
        <BankPicker value={bank} onChange={setBank} />
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-[15px] font-bold">
          Landmark <span className="font-medium text-muted">(optional)</span>
        </span>
        <input
          type="text"
          placeholder="e.g. Next to the bus stand"
          maxLength={120}
          value={landmark}
          onChange={(e) => setLandmark(e.target.value)}
          className="h-12 rounded-[14px] border-[1.5px] border-chip px-3.5 text-base outline-none placeholder:text-faint focus:border-primary"
        />
      </label>

      {duplicateId && (
        <p className="text-sm text-down-ink">
          This ATM is already listed.{' '}
          <Link to={`/atm/${duplicateId}`} className="font-bold">View it</Link>
        </p>
      )}
      {error && <p className="text-sm text-down-ink">{error}</p>}

      <button
        type="submit"
        disabled={sending || fix.status !== 'found' || bank.length < 2}
        className="sticky bottom-0 flex h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[17px] font-bold text-white shadow-[0_-16px_0_8px_white,0_12px_0_8px_white] disabled:bg-disabled disabled:text-faint"
      >
        {sending ? <Spinner size={20} /> : bank.length < 2 ? 'Choose a bank' : <><Icon name="plus" size={20} stroke={2.6} /> Add ATM</>}
      </button>
    </form>
  )
}
