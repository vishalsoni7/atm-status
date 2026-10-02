import { useSyncExternalStore } from 'react'
import { isDown, markDown } from './fallback'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined
// MapTiler's full-colour "streets-v2" (and its dark twin): familiar, with
// landmarks people use to find an ATM ("near Rathi Hospital").
const MAPTILER_STYLE = { light: 'streets-v2', dark: 'streets-v2-dark' }

type Scheme = 'light' | 'dark'

export interface TileProvider {
  id: string // changes with provider and theme, so the map reloads its tiles
  url: string
  attribution: string
  tileSize: number
  zoomOffset: number
  maxZoom: number
  className?: string
  // MapTiler's free plan asks for its logo on the map.
  logo: string | null
}

function maptiler(scheme: Scheme): TileProvider {
  return {
    id: `maptiler-${scheme}`,
    // 512px tiles shown at half zoom: same picture, a quarter of the requests
    // (stretches the free monthly quota). {r} = sharper tiles on retina screens.
    url: `https://api.maptiler.com/maps/${MAPTILER_STYLE[scheme]}/{z}/{x}/{y}{r}.png?key=${MAPTILER_KEY}`,
    // Short form fits phones; both link to the full copyright pages.
    attribution:
      '<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noreferrer">&copy; MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap</a>',
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 20,
    logo: scheme === 'dark' ? '/maptiler-logo-dark.svg' : '/maptiler-logo.svg',
  }
}

// Backup: OpenStreetMap's volunteer servers. Fine for light/occasional use;
// toned down (and darkened in dark mode) in CSS.
const OSM: TileProvider = {
  id: 'osm',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
  tileSize: 256,
  zoomOffset: 0,
  maxZoom: 19,
  className: 'tiles-osm',
  logo: null,
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()
let usingBackup = !MAPTILER_KEY || isDown('tiles')
let current = pick()

function pick(): TileProvider {
  return usingBackup ? OSM : maptiler(darkQuery.matches ? 'dark' : 'light')
}

function update() {
  current = pick()
  listeners.forEach((l) => l())
}

// The phone switched between light and dark while the app is open.
darkQuery.addEventListener('change', update)

// Called by the map when MapTiler tiles keep failing (quota, outage, or an
// origin the key doesn't allow, e.g. the future mobile apps).
export function tilesFailing() {
  // Offline: every provider fails; cached tiles still show. Don't switch.
  if (usingBackup || !navigator.onLine) return
  markDown('tiles')
  usingBackup = true
  update()
}

export function useTileProvider(): TileProvider {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => current,
  )
}
