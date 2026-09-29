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

export function usePosition(): { location: LocationState; retry: () => void } {
  const [location, setLocation] = useState<LocationState>(() =>
    navigator.geolocation ? { status: 'locating' } : { status: 'unavailable' },
  )
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setLocation({
          status: 'found',
          pos: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy },
        }),
      (err) => setLocation({ status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 30_000 },
    )
  }, [attempt])

  const retry = () => {
    setLocation({ status: 'locating' })
    setAttempt((n) => n + 1)
  }
  return { location, retry }
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
