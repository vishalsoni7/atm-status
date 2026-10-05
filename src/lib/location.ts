import { useEffect, useState } from 'react'

// How far around the user we look for ATMs. The database caps this (see 0006).
export const SEARCH_RADIUS_M = 20_000

// India, for when we don't know where the user is yet.
export const INDIA_VIEW = { center: { lat: 22.5, lng: 79 }, zoom: 5 }

export interface Position {
  lat: number
  lng: number
  accuracy: number // metres, as reported by the device
}

export type LocationState =
  | { status: 'locating' }
  | { status: 'found'; pos: Position }
  | { status: 'denied' } // the person (or browser) said no
  | { status: 'unavailable' } // no GPS fix, timeout, or no geolocation support

// Ignore GPS jitter smaller than this when following the person.
const MOVE_THRESHOLD_M = 10

// Where the person is. With `follow`, keeps updating while the screen is open
// (precise GPS, like a maps app's blue dot), so walking up to an ATM is noticed
// without reopening the app.
export function usePosition({ follow = false }: { follow?: boolean } = {}): {
  location: LocationState
  retry: () => void
  refreshing: boolean
} {
  const [location, setLocation] = useState<LocationState>(() =>
    navigator.geolocation ? { status: 'locating' } : { status: 'unavailable' },
  )
  const [attempt, setAttempt] = useState(0)
  // A fresh fix was asked for and hasn't arrived yet.
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return
    const geo = navigator.geolocation
    let watchId: number | null = null

    const found = (p: GeolocationPosition) => {
      setRefreshing(false)
      const next = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }
      // Skip tiny jitter so the screen doesn't redraw constantly.
      setLocation((prev) =>
        prev.status === 'found' &&
        distanceM(prev.pos, next) < MOVE_THRESHOLD_M &&
        Math.abs(prev.pos.accuracy - next.accuracy) < MOVE_THRESHOLD_M
          ? prev
          : { status: 'found', pos: next },
      )
    }
    const failed = (err: GeolocationPositionError) => {
      setRefreshing(false)
      // A failed refresh keeps the position we already have.
      setLocation((prev) =>
        prev.status === 'found' ? prev : { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' },
      )
    }

    // First look: quick, and a fix from the last 30 s is fine.
    // "Check again" / "show my location": a fresh, precise fix (they may have moved).
    geo.getCurrentPosition(
      found,
      failed,
      attempt === 0
        ? { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30_000 }
        : { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    )
    if (follow) {
      watchId = geo.watchPosition(found, (err) => err.code === err.PERMISSION_DENIED && failed(err), {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 30_000,
      })
    }

    // Coming back to the app (phones pause location in the background): refresh.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        geo.getCurrentPosition(found, () => {}, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 })
      }
    }
    if (follow) document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (watchId !== null) geo.clearWatch(watchId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [attempt, follow])

  // Keeps showing the current position while the fresh one arrives.
  const retry = () => {
    setRefreshing(true)
    setLocation((prev) => (prev.status === 'found' ? prev : { status: 'locating' }))
    setAttempt((n) => n + 1)
  }
  return { location, retry, refreshing }
}

// A fresh, as-precise-as-possible fix, for pinning a new ATM where the person stands.
export function getPreciseLocation(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unavailable'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    )
  })
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}

// Straight-line distance in metres.
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

// "about 5 min walk" at a relaxed ~80 m per minute.
export function walkLabel(m: number): string {
  const mins = Math.max(1, Math.round(m / 80))
  return mins > 90 ? 'too far to walk' : `about ${mins} min walk`
}

// Reports must come from someone at the ATM.
export const REPORT_RADIUS_M = 150

// Allow for GPS drift, but not so much that a vague fix counts as "here".
export function isCloseEnough(distance: number, accuracy: number): boolean {
  return distance - Math.min(accuracy, 100) <= REPORT_RADIUS_M
}
