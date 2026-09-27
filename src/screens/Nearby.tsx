import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppFooter } from '../components/AppFooter'
import { AtAtmPrompt } from '../components/AtAtmPrompt'
import { ContactCard } from '../components/ContactCard'
import { Icon, Spinner } from '../components/Icon'
import { Screen } from '../components/Screen'
import { BankBadge, StatusLine } from '../components/Status'
import { fetchNearby } from '../lib/api'
import { atmsHere } from '../lib/here'
import { FALLBACK, formatDistance, usePosition } from '../lib/location'
import type { NearbyAtm } from '../lib/types'

export function Nearby() {
  const pos = usePosition()
  const [atms, setAtms] = useState<NearbyAtm[] | null>(null)
  const [error, setError] = useState(false)

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

  const here = atmsHere(pos, atms)
  const working = atms?.filter((a) => a.last_status === 'working' && a.lifecycle === 'active').length ?? 0

  return (
    <Screen title="ATMs Nearby" largeTitle onRefresh={load}>
      <p className="subhead">
        <Icon name={pos?.approximate ? 'pin' : 'location'} size={15} stroke={2.2} />
        {pos?.approximate ? `Around central ${FALLBACK.label}` : 'Sorted by distance from you'}
      </p>

      {here.length > 0 && <AtAtmPrompt key={here.map((a) => a.id).join()} atms={here} onReported={load} />}

      {pos?.approximate && (
        <div className="banner">
          Location is off, so distances are from the city centre. Allow location in your browser settings to see what's closest to you.
        </div>
      )}

      {error && !atms ? (
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
          <h3>No ATMs within 10 km</h3>
          <p>We're adding ATMs city by city. Bhilwara is first.</p>
        </div>
      ) : (
        <>
          <h3 className="group-header">
            {atms.length} ATMs{working > 0 && `, ${working} reported working`}
          </h3>
          <ul className="group">
            {atms.map((atm) => (
              <li key={atm.id}>
                <Link to={`/atm/${atm.id}`} className="cell cell-atm">
                  <BankBadge bank={atm.bank} />
                  <div className="cell-body">
                    <div className="cell-top">
                      <span className="cell-title">{atm.bank}</span>
                      <span className="cell-meta">{formatDistance(atm.distance_m)}</span>
                    </div>
                    <span className="cell-sub">{atm.landmark || atm.address || 'Address not added yet'}</span>
                    <StatusLine status={atm.last_status} reportedAt={atm.last_reported_at} lifecycle={atm.lifecycle} />
                  </div>
                  <span className="cell-chevron"><Icon name="chevronRight" size={16} stroke={2.6} /></span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="refresh-hint">Pull down to refresh.</p>
          <ContactCard source="home" />
        </>
      )}
      <AppFooter />
    </Screen>
  )
}
