import { useEffect, useState } from 'react'

// Pilot city centre, used when location is denied or unavailable.
export const FALLBACK = { lat: 25.3463, lng: 74.6364, label: 'Bhilwara' }

export interface Position {
  lat: number
  lng: number
  // Metres, as reported by the device. Null for the city-centre fallback.
  accuracy: number | null
  approximate: boolean
}

export function usePosition(): Position | null {
  const [pos, setPos] = useState<Position | null>(() =>
    navigator.geolocation ? null : { ...FALLBACK, accuracy: null, approximate: true },
  )

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, approximate: false }),
      () => setPos({ ...FALLBACK, accuracy: null, approximate: true }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 30_000 },
    )
  }, [])

  return pos
}

export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`
}
