import { isDown, markDown } from './fallback'

export interface Place {
  lat: number
  lng: number
  label: string
  // Where it is, for suggestion lists: "Bhilwara Tehsil, Rajasthan".
  detail?: string
}

type LatLng = { lat: number; lng: number }

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined

// Local areas first (about 50 km around the map), then anywhere in India,
// so "Azad Nagar" finds the one in your town but "Jaipur" still finds Jaipur.
const LOCAL_BOX_DEG = 0.5

export const SUGGEST_MIN_CHARS = 3
// MapTiler's maximum per request; more results don't cost more quota.
const SUGGEST_LIMIT = 10
// Fewer nearby matches than this: also show matches from the rest of India.
const LOCAL_ENOUGH = 5

class ServiceError extends Error {
  status: number
  constructor(status: number) {
    super(`search failed: ${status}`)
    this.status = status
  }
}

function maptilerUsable(): boolean {
  return Boolean(MAPTILER_KEY) && !isDown('search')
}

// Quota used up, key not allowed here, or server trouble: use the backup for a while.
// Network errors (offline) don't count; nothing would work then anyway.
function noteFailure(err: unknown) {
  if (err instanceof ServiceError && (err.status === 401 || err.status === 403 || err.status === 429 || err.status >= 500)) {
    markDown('search')
  }
}

// Best match for a typed area (Enter). Falls back to OpenStreetMap's free search.
export async function searchPlace(query: string, near?: LatLng | null): Promise<Place | null> {
  if (maptilerUsable()) {
    try {
      if (near) {
        const local = await maptilerList(query, { ...nearParams(near), bbox: localBox(near), limit: '1' })
        if (local[0]) return local[0]
      }
      return (await maptilerList(query, { ...(near ? nearParams(near) : {}), limit: '1' }))[0] ?? null
    } catch (err) {
      noteFailure(err)
      if (!(err instanceof ServiceError)) throw err
    }
  }
  return searchNominatim(query)
}

// Live suggestions while typing. Only with MapTiler: the free backup service
// doesn't allow search-as-you-type, so suggestions pause if MapTiler is down.
export function canSuggest(): boolean {
  return maptilerUsable()
}

// Remember recent answers (typing back and forth shouldn't cost requests).
const cache = new Map<string, Place[]>()
const CACHE_SIZE = 60

export async function suggestPlaces(query: string, near: LatLng | null, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim().toLowerCase()
  if (!maptilerUsable() || q.length < SUGGEST_MIN_CHARS) return []
  // ~10 km grid, so moving the map a little reuses answers.
  const cacheKey = `${q}|${near ? `${near.lat.toFixed(1)},${near.lng.toFixed(1)}` : ''}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  try {
    const base = { autocomplete: 'true', limit: String(SUGGEST_LIMIT), ...(near ? nearParams(near) : {}) }
    let results = near ? await maptilerList(q, { ...base, bbox: localBox(near) }, signal) : []
    // Few local matches: add places from the rest of India.
    if (results.length < LOCAL_ENOUGH) {
      const wide = await maptilerList(q, base, signal)
      const seen = new Set(results.map((r) => `${r.label}|${r.detail}`))
      results = [...results, ...wide.filter((r) => !seen.has(`${r.label}|${r.detail}`))]
    }
    results = results.slice(0, SUGGEST_LIMIT)
    cache.set(cacheKey, results)
    if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
    return results
  } catch (err) {
    noteFailure(err)
    throw err
  }
}

function nearParams(near: LatLng) {
  return { proximity: `${near.lng},${near.lat}` }
}

function localBox(near: LatLng): string {
  return [near.lng - LOCAL_BOX_DEG, near.lat - LOCAL_BOX_DEG, near.lng + LOCAL_BOX_DEG, near.lat + LOCAL_BOX_DEG].join(',')
}

interface Feature {
  center: [number, number]
  text: string
  place_name: string
}

async function maptilerList(query: string, extra: Record<string, string>, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ key: MAPTILER_KEY!, country: 'in', language: 'en', ...extra })
  const res = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`, { signal })
  if (!res.ok) throw new ServiceError(res.status)
  const { features } = (await res.json()) as { features: Feature[] }
  return features.map((f) => ({
    lng: f.center[0],
    lat: f.center[1],
    label: f.text,
    // "Azad Nagar, 311 001 Bhilwara Tehsil, Rajasthan, India" -> "Bhilwara Tehsil, Rajasthan"
    detail: f.place_name
      .split(',')
      .slice(1)
      .map((p) => p.trim().replace(/^\d{3} ?\d{3} /, ''))
      .filter((p) => p && p !== 'India')
      .join(', '),
  }))
}

// Backup: OpenStreetMap's free Nominatim (one search per Enter; no type-ahead).
async function searchNominatim(query: string): Promise<Place | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&q=' + encodeURIComponent(query)
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new ServiceError(res.status)
  const [hit] = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[]
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.name || hit.display_name.split(',')[0] } : null
}
