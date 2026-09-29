export interface Place {
  lat: number
  lng: number
  label: string
}

// Area search with OpenStreetMap's free Nominatim service, limited to India.
// Their usage policy allows light use like this (one search per submit, no autocomplete).
export async function searchPlace(query: string): Promise<Place | null> {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&q=' + encodeURIComponent(query)
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
  if (!res.ok) throw new Error(`search failed: ${res.status}`)
  const [hit] = (await res.json()) as { lat: string; lon: string; name?: string; display_name: string }[]
  if (!hit) return null
  return { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.name || hit.display_name.split(',')[0] }
}
