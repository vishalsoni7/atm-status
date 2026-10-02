import L from 'leaflet'
import { useEffect, useRef } from 'react'
import { AttributionControl, MapContainer, Marker, useMap } from 'react-leaflet'
import { atmName } from '../lib/banks'
import { CheckedTileLayer } from '../lib/checkedTiles'
import { TONE, type Tone } from '../lib/status'
import { tilesFailing, useTileProvider } from '../lib/tiles'
import { pinHtml } from '../lib/toneStyle'

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
      className="absolute inset-0 isolate"
    >
      <AttributionControl position="bottomright" prefix={false} />
      <Tiles />
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

// Base map that never stays blank: if MapTiler tiles keep failing, every map
// in the app switches to the OpenStreetMap backup.
function Tiles() {
  const provider = useTileProvider()
  const map = useMap()
  const stats = useRef({ ok: 0, failed: 0 })

  useEffect(() => {
    const options: L.TileLayerOptions = {
      attribution: provider.attribution,
      tileSize: provider.tileSize,
      zoomOffset: provider.zoomOffset,
      maxZoom: provider.maxZoom,
      className: provider.className,
    }
    const backup = provider.id === 'osm'
    // MapTiler tiles are fetched so a refusal is detected (see CheckedTileLayer).
    const layer = backup ? L.tileLayer(provider.url, options) : new CheckedTileLayer(provider.url, options)
    if (!backup) {
      layer.on('tileload', () => {
        stats.current.ok++
      })
      layer.on('tileerror', () => {
        const s = stats.current
        s.failed++
        // A few failures, more than successes = the service is refusing us.
        if (s.failed >= 3 && s.failed > s.ok) tilesFailing()
      })
    }
    layer.addTo(map)
    return () => {
      layer.remove()
    }
  }, [map, provider])

  return provider.logo ? <MapLogo src={provider.logo} /> : null
}

// MapTiler logo in the bottom-left corner (required on their free plan).
function MapLogo({ src }: { src: string }) {
  const map = useMap()
  useEffect(() => {
    const control = new L.Control({ position: 'bottomleft' })
    control.onAdd = () => {
      const a = L.DomUtil.create('a', 'map-logo')
      a.href = 'https://www.maptiler.com'
      a.target = '_blank'
      a.rel = 'noreferrer'
      a.innerHTML = `<img src="${src}" alt="MapTiler" width="67" height="20">`
      return a
    }
    control.addTo(map)
    return () => {
      control.remove()
    }
  }, [map, src])
  return null
}
