import L from 'leaflet'
import { useEffect } from 'react'
import { AttributionControl, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
import { atmName } from '../lib/banks'
import { TONE, type Tone } from '../lib/status'
import { pinHtml } from '../lib/toneStyle'

// OpenStreetMap's own tiles: free and keyless for light use, with attribution
// (tile usage policy: osm.wiki/Tile_usage_policy). Toned down in CSS to look
// light and low-detail. At scale, switch to a keyed provider (MapTiler, Stadia).
const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const pinIcons = new Map<string, L.DivIcon>()
function pinIcon(tone: Tone, size = 34): L.DivIcon {
  const key = `${tone}:${size}`
  let icon = pinIcons.get(key)
  if (!icon) {
    // The teardrop's tip sits half a diagonal below its centre.
    const tip = size / 2 + (size / 2) * Math.SQRT2
    icon = L.divIcon({ html: pinHtml(tone), className: '', iconSize: [size, size], iconAnchor: [size / 2, tip] })
    pinIcons.set(key, icon)
  }
  return icon
}

const meIcon = L.divIcon({ html: '<div class="me-dot"></div>', className: '', iconSize: [56, 56], iconAnchor: [28, 28] })

export interface MapAtm {
  id: string
  bank: string
  lat: number
  lng: number
  tone: Tone
}

interface Props {
  view: { center: { lat: number; lng: number }; zoom: number }
  // Changes whenever the view should be re-applied (e.g. "show my location").
  viewKey: string
  // Pixels hidden under the bottom sheet, so the centre lands in the visible part.
  bottomInset?: number
  me?: { lat: number; lng: number } | null
  atms: MapAtm[]
  onSelect?: (id: string) => void
  interactive?: boolean
  pinSize?: number
}

export function AtmMap({ view, viewKey, bottomInset = 0, me, atms, onSelect, interactive = true, pinSize }: Props) {
  return (
    <MapContainer
      center={[view.center.lat, view.center.lng]}
      zoom={view.zoom}
      zoomControl={false}
      dragging={interactive}
      touchZoom={interactive}
      scrollWheelZoom={interactive}
      doubleClickZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      attributionControl={false}
      className="absolute inset-0"
    >
      <AttributionControl position="bottomright" prefix={false} />
      <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
      <ApplyView view={view} viewKey={viewKey} bottomInset={bottomInset} />
      {me && <Marker position={[me.lat, me.lng]} icon={meIcon} interactive={false} keyboard={false} />}
      {atms.map((a) => (
        <Marker
          key={a.id}
          position={[a.lat, a.lng]}
          icon={pinIcon(a.tone, pinSize)}
          title={`${atmName(a.bank)}, ${TONE[a.tone].label.toLowerCase()}`}
          alt={`${atmName(a.bank)}, ${TONE[a.tone].label.toLowerCase()}`}
          interactive={!!onSelect}
          keyboard={!!onSelect}
          eventHandlers={onSelect ? { click: () => onSelect(a.id) } : undefined}
        />
      ))}
    </MapContainer>
  )
}

function ApplyView({ view, viewKey, bottomInset }: { view: Props['view']; viewKey: string; bottomInset: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([view.center.lat, view.center.lng], view.zoom, { animate: false })
    if (bottomInset) map.panBy([0, bottomInset / 2], { animate: false })
    // Only when the requested view changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey])
  return null
}
