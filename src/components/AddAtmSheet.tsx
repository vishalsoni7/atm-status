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

  return (
    <form className="sheet-body add-atm" onSubmit={submit}>
      <p className="sheet-sub">Stand at the ATM. We'll pin it at your current location.</p>

      <div className={`fix fix-${fix.status === 'found' && fix.pos.accuracy > GOOD_ACCURACY_M ? 'rough' : fix.status}`}>
        {fix.status === 'locating' ? (
          <>
            <Spinner size={18} />
            <span>Getting your exact location…</span>
          </>
        ) : fix.status === 'failed' ? (
          <>
            <Icon name="location" size={18} stroke={2.2} />
            <span>Couldn't get your location. Turn on location (GPS) and allow it for this site.</span>
            <button type="button" className="link-btn" onClick={relocate}>Try again</button>
          </>
        ) : fix.pos.accuracy > GOOD_ACCURACY_M ? (
          <>
            <Icon name="location" size={18} stroke={2.2} />
            <span>Location is rough (±{Math.round(fix.pos.accuracy)} m). Step outside or wait a moment for a better fix.</span>
            <button type="button" className="link-btn" onClick={relocate}>Retry</button>
          </>
        ) : (
          <>
            <Icon name="location" size={18} stroke={2.2} />
            <span>Location found (±{Math.round(fix.pos.accuracy)} m)</span>
          </>
        )}
      </div>

      <h3 className="group-header">Bank</h3>
      <BankPicker value={bank} onChange={setBank} />

      <h3 className="group-header">Landmark (optional)</h3>
      <input
        className="text-field"
        type="text"
        placeholder="e.g. Next to the bus stand"
        maxLength={120}
        value={landmark}
        onChange={(e) => setLandmark(e.target.value)}
      />

      {duplicateId && (
        <p className="sheet-message">
          This ATM is already listed.{' '}
          <Link to={`/atm/${duplicateId}`} replace>View it</Link>
        </p>
      )}
      {error && <p className="sheet-message">{error}</p>}

      <button className="primary-btn" type="submit" disabled={sending || fix.status !== 'found' || bank.length < 2}>
        {sending ? <Spinner size={20} /> : <><Icon name="plus" size={20} stroke={2.6} /> Add ATM</>}
      </button>
    </form>
  )
}
