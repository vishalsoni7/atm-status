import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppFooter } from '../components/AppFooter'
import { AddAtmForm } from '../components/AddAtmSheet'
import { AtAtmPrompt } from '../components/AtAtmPrompt'
import { ContactCard } from '../components/ContactCard'
import { Icon, Spinner } from '../components/Icon'
import { Screen } from '../components/Screen'
import { Hud, Sheet } from '../components/Sheet'
import { BankBadge, StatusLine } from '../components/Status'
import { fetchNearby } from '../lib/api'
import { displayBank } from '../lib/banks'
import { atmsHere } from '../lib/here'
import { SEARCH_RADIUS_M, formatDistance, usePosition } from '../lib/location'
import type { NearbyAtm } from '../lib/types'

// The server returns at most this many ATMs, nearest first.
const MAX_RESULTS = 50
const RADIUS_KM = SEARCH_RADIUS_M / 1000

export function Nearby() {
  const { location, retry } = usePosition()
  const pos = location.status === 'found' ? location.pos : null
  const [atms, setAtms] = useState<NearbyAtm[] | null>(null)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [hud, setHud] = useState<string | null>(null)

  const load = useCallback(
    () =>
      pos
        ? fetchNearby(pos.lat, pos.lng).then(
            (a) => {
              setAtms(a)
              setError(false)
            },
            () => setError(true),
          )
        : Promise.resolve(),
    [pos],
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!hud) return
    const t = setTimeout(() => setHud(null), 1600)
    return () => clearTimeout(t)
  }, [hud])

  const closeAdd = useCallback(() => setAdding(false), [])
  const addRow = (
    <button className="add-atm-row" onClick={() => setAdding(true)}>
      <span className="add-atm-icon"><Icon name="plus" size={18} stroke={2.6} /></span>
      <span>
        <strong>Add a missing ATM</strong>
        <small>Standing at an ATM that isn't listed? Add it here.</small>
      </span>
    </button>
  )

  const here = atmsHere(pos, atms)
  const working = atms?.filter((a) => a.last_status === 'working' && a.lifecycle === 'active').length ?? 0

  return (
    <Screen
      title="ATMs Nearby"
      largeTitle
      onRefresh={load}
      overlay={
        <>
          <Sheet open={adding} title="Add a missing ATM" onClose={closeAdd}>
            <AddAtmForm
              onAdded={() => {
                setAdding(false)
                setHud('ATM added')
                load()
              }}
            />
          </Sheet>
          {hud && <Hud text={hud} />}
        </>
      }
    >
      {pos && (
        <p className="subhead">
          <Icon name="location" size={15} stroke={2.2} />
          Within {RADIUS_KM} km of you, nearest first
        </p>
      )}

      {here.length > 0 && <AtAtmPrompt key={here.map((a) => a.id).join()} atms={here} onReported={load} />}

      {location.status === 'locating' ? (
        <div className="loading">
          <Spinner size={26} />
          <p>Finding your location…</p>
        </div>
      ) : location.status === 'denied' ? (
        <div className="empty">
          <span className="empty-icon"><Icon name="location" size={34} stroke={1.8} /></span>
          <h3>Allow location to see ATMs near you</h3>
          <p>ATM Status uses your location only to find the nearest ATMs. Turn it on in your browser or phone settings, then try again.</p>
          <button className="pill-btn" onClick={retry}>Try again</button>
        </div>
      ) : location.status === 'unavailable' ? (
        <div className="empty">
          <span className="empty-icon"><Icon name="location" size={34} stroke={1.8} /></span>
          <h3>Couldn't find your location</h3>
          <p>Make sure location (GPS) is on, then try again.</p>
          <button className="pill-btn" onClick={retry}>Try again</button>
        </div>
      ) : error && !atms ? (
        <div className="empty">
          <span className="empty-icon"><Icon name="wifiOff" size={34} stroke={1.8} /></span>
          <h3>Can't load ATMs</h3>
          <p>Check your internet connection, then try again.</p>
          <button className="pill-btn" onClick={load}>Try again</button>
        </div>
      ) : !atms ? (
        <div className="loading"><Spinner size={26} /></div>
      ) : atms.length === 0 ? (
        <div className="empty">
          <span className="empty-icon"><Icon name="pin" size={34} stroke={1.8} /></span>
          <h3>No ATMs found within {RADIUS_KM} km</h3>
          <p>Our ATM list comes from OpenStreetMap and may be missing ATMs in your area.</p>
          <div className="empty-action">{addRow}</div>
        </div>
      ) : (
        <>
          <h3 className="group-header">
            {atms.length >= MAX_RESULTS ? `Nearest ${atms.length} ATMs` : `${atms.length} ATM${atms.length === 1 ? '' : 's'}`}
            {working > 0 && `, ${working} reported working`}
          </h3>
          <ul className="group">
            {atms.map((atm) => (
              <li key={atm.id}>
                <Link to={`/atm/${atm.id}`} className="cell cell-atm">
                  <BankBadge bank={atm.bank} />
                  <div className="cell-body">
                    <div className="cell-top">
                      <span className="cell-title">{displayBank(atm.bank)}</span>
                      <span className="cell-meta">{formatDistance(atm.distance_m)}</span>
                    </div>
                    <span className="cell-sub">{atm.landmark || atm.address || 'Address not added yet'}</span>
                    <StatusLine status={atm.last_status} reportedAt={atm.last_reported_at} lifecycle={atm.lifecycle} confirmed={atm.confirmed !== false} />
                  </div>
                  <span className="cell-chevron"><Icon name="chevronRight" size={16} stroke={2.6} /></span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="add-atm-after">{addRow}</div>
          <p className="refresh-hint">Pull down to refresh.</p>
          <ContactCard source="home" />
        </>
      )}
      <AppFooter />
    </Screen>
  )
}
