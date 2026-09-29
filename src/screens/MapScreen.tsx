import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AddAtmForm } from '../components/AddAtmSheet'
import { AppFooter } from '../components/AppFooter'
import { AtAtmPrompt } from '../components/AtAtmPrompt'
import { AtmMap } from '../components/AtmMap'
import { ContactCard } from '../components/ContactCard'
import { Icon, Spinner } from '../components/Icon'
import { Sheet, Toast } from '../components/Sheet'
import { BankTile, StatusPill } from '../components/Status'
import { fetchNearby } from '../lib/api'
import { atmName } from '../lib/banks'
import { searchPlace, type Place } from '../lib/geocode'
import { atmsHere } from '../lib/here'
import { INDIA_VIEW, SEARCH_RADIUS_M, formatDistance, usePosition } from '../lib/location'
import { currentTone, whenLabel, type Tone } from '../lib/status'
import { useToast } from '../lib/toast'
import type { NearbyAtm } from '../lib/types'

type Filter = 'all' | 'ok' | 'down'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'Working' },
  { id: 'down', label: 'Not working' },
]

// Bottom sheet: resting height from the design, and how close to the top it opens.
const SHEET_PEEK = 404
const SHEET_TOP_GAP = 120

export function MapScreen() {
  const navigate = useNavigate()
  const { location, retry } = usePosition()
  const me = location.status === 'found' ? location.pos : null
  const [params, setParams] = useSearchParams()
  const filter = (['ok', 'down'].includes(params.get('filter') ?? '') ? params.get('filter') : 'all') as Filter

  const [place, setPlace] = useState<Place | null>(null)
  const center = place ?? me
  const [atms, setAtms] = useState<NearbyAtm[] | null>(null)
  const [error, setError] = useState(false)
  const [adding, setAdding] = useState(false)
  const [toast, showToast] = useToast()
  const [recenter, setRecenter] = useState(0)

  const load = useCallback(
    () =>
      center
        ? fetchNearby(center.lat, center.lng).then(
            (a) => {
              setAtms(a)
              setError(false)
            },
            () => setError(true),
          )
        : Promise.resolve(),
    [center],
  )
  useEffect(() => {
    load()
  }, [load])

  // Screen height, to size the sheet.
  const rootRef = useRef<HTMLDivElement>(null)
  const [screenH, setScreenH] = useState(800)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setScreenH(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const peek = Math.min(SHEET_PEEK, Math.round(screenH * 0.5))
  const full = Math.max(peek, screenH - SHEET_TOP_GAP)
  const [expanded, setExpanded] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const dragStart = useRef<{ y: number; h: number } | null>(null)
  const sheetH = drag ?? (expanded ? full : peek)

  function onPointerDown(e: PointerEvent) {
    dragStart.current = { y: e.clientY, h: sheetH }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragStart.current) return
    const h = dragStart.current.h + (dragStart.current.y - e.clientY)
    if (Math.abs(h - dragStart.current.h) > 4) setDrag(Math.max(160, Math.min(full, h)))
  }
  function onPointerUp() {
    if (!dragStart.current) return
    const moved = drag !== null
    const h = drag ?? sheetH
    dragStart.current = null
    setDrag(null)
    // A tap toggles; a drag snaps to whichever height is closer.
    setExpanded(moved ? h > (peek + full) / 2 : !expanded)
  }

  const withTone = useMemo(
    () => (atms ?? []).map((a) => ({ ...a, tone: currentTone(a.last_status, a.last_reported_at, a.lifecycle) as Tone })),
    [atms],
  )
  const shown = filter === 'all' ? withTone : withTone.filter((a) => a.tone === filter)
  const here = place ? [] : atmsHere(me, atms)

  const view = center ? { center, zoom: 15 } : INDIA_VIEW
  const viewKey = `${center?.lat},${center?.lng},${recenter}`

  function showMine() {
    setPlace(null)
    if (location.status !== 'found') retry()
    setRecenter((n) => n + 1)
  }

  const closeAdd = useCallback(() => setAdding(false), [])
  const radiusKm = SEARCH_RADIUS_M / 1000

  return (
    <div ref={rootRef} className="map-screen absolute inset-0 bg-mapbg" style={{ '--sheet-h': `${sheetH}px` } as React.CSSProperties}>
      <AtmMap
        view={view}
        viewKey={viewKey}
        bottomInset={peek - 60}
        me={me}
        atms={shown}
        onSelect={(id) => navigate(`/atm/${id}`)}
      />

      <div className="absolute inset-x-4 top-[calc(var(--safe-top)+12px)] z-[500] flex flex-col gap-2.5">
        <SearchBar place={place} onPlace={setPlace} />
        <div role="group" aria-label="Filter ATMs" className="flex gap-2">
          {FILTERS.map((f) => {
            const on = f.id === filter
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={on}
                onClick={() => setParams(f.id === 'all' ? {} : { filter: f.id }, { replace: true })}
                className={`h-10 rounded-full border px-4 text-sm font-semibold shadow-[0_2px_8px_rgba(21,24,27,0.08)] ${on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <button
        type="button"
        hidden={sheetH > peek + 80}
        onClick={showMine}
        aria-label="Show my location"
        className="absolute right-4 z-[500] flex size-12 items-center justify-center rounded-[14px] bg-white text-primary shadow-[0_4px_12px_rgba(21,24,27,0.14)] transition-[bottom] duration-300"
        style={{ bottom: sheetH + 16 }}
      >
        <Icon name="crosshair" size={22} stroke={2} />
      </button>

      <section
        aria-label="Nearby ATMs"
        className={`absolute inset-x-0 bottom-0 z-[600] flex flex-col rounded-t-[24px] bg-white px-5 shadow-[0_-6px_24px_rgba(21,24,27,0.10)] ${drag === null ? 'transition-[height] duration-300 ease-out' : ''}`}
        style={{ height: sheetH }}
      >
        <div
          className="shrink-0 cursor-grab touch-none select-none pt-2.5"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="mx-auto h-[5px] w-10 rounded-full bg-chip" aria-hidden="true" />
          <div className="flex items-end justify-between gap-3 pt-3.5 pb-2">
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="font-display text-2xl font-bold tracking-[-0.01em]">Nearby ATMs</h1>
              <p className="truncate text-[13px] text-muted">
                {place ? `Around ${place.label}` : 'Status reported by people near you'}
              </p>
            </div>
            {atms && (
              <p className="shrink-0 text-[13px] font-semibold text-muted">
                {shown.length} {shown.length === 1 ? 'ATM' : 'ATMs'}
              </p>
            )}
          </div>
        </div>

        <div className="scroll-y -mx-5 flex-1 px-5 pb-[calc(var(--safe-bottom)+24px)]">
          {here.length > 0 && (
            <div className="mb-3">
              <AtAtmPrompt key={here.map((a) => a.id).join()} atms={here} onReported={load} />
            </div>
          )}

          {!center && location.status === 'locating' ? (
            <Empty icon={<Spinner size={28} />} title="Finding your location…" />
          ) : !center ? (
            <Empty
              icon={<Icon name="pinOff" size={30} />}
              title={location.status === 'denied' ? 'Allow location to see ATMs near you' : "Couldn't find your location"}
              text={
                location.status === 'denied'
                  ? 'Turn it on in your browser or phone settings, or search for an area above.'
                  : 'Make sure location (GPS) is on, or search for an area above.'
              }
              action={<PrimarySmall onClick={retry}>Try again</PrimarySmall>}
            />
          ) : error && !atms ? (
            <Empty
              icon={<Icon name="wifiOff" size={30} />}
              title="Can't load ATMs"
              text="Check your internet connection, then try again."
              action={<PrimarySmall onClick={load}>Try again</PrimarySmall>}
            />
          ) : !atms ? (
            <Empty icon={<Spinner size={28} />} title="Loading ATMs…" />
          ) : shown.length === 0 ? (
            <Empty
              icon={<Icon name="pin" size={30} />}
              title={atms.length === 0 ? `No ATMs within ${radiusKm} km` : `No ${filter === 'ok' ? 'working' : 'not working'} ATMs right now`}
              text={
                atms.length === 0
                  ? 'Our ATM list comes from OpenStreetMap and may be missing ATMs here.'
                  : 'Try "All" to see every ATM nearby.'
              }
            />
          ) : (
            <ul>
              {shown.map((a) => (
                <li key={a.id}>
                  <Link to={`/atm/${a.id}`} className="flex min-h-[72px] items-center gap-3.5 border-t border-hair py-2.5 text-ink active:bg-ground">
                    <BankTile bank={a.bank} tone={a.tone} />
                    <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      <span className="truncate text-base font-semibold">{atmName(a.bank)}</span>
                      <span className="truncate text-[13px] text-muted">
                        {a.confirmed === false && <span className="font-semibold text-down-ink">Unconfirmed · </span>}
                        {[a.landmark || a.address, formatDistance(a.distance_m)].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusPill tone={a.tone} />
                      <span className="text-xs text-faint">{whenLabel(a.last_reported_at, a.tone)}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {center && (
            <div className="mt-2 flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-chip p-4 text-left"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-soft text-primary">
                  <Icon name="plus" size={20} stroke={2.6} />
                </span>
                <span className="flex flex-col">
                  <strong className="font-bold text-primary">Add a missing ATM</strong>
                  <span className="text-[13px] text-muted">Standing at an ATM that isn't listed? Add it here.</span>
                </span>
              </button>
              <ContactCard source="home" />
              <AppFooter />
            </div>
          )}
        </div>
      </section>

      <Sheet open={adding} title="Add a missing ATM" onClose={closeAdd}>
        <AddAtmForm
          onAdded={() => {
            setAdding(false)
            showToast('ATM added')
            load()
          }}
        />
      </Sheet>
      {toast && <Toast text={toast} />}
    </div>
  )
}

function SearchBar({ place, onPlace }: { place: Place | null; onPlace: (p: Place | null) => void }) {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearching(true)
    setMessage(null)
    try {
      const hit = await searchPlace(q)
      if (hit) onPlace(hit)
      else setMessage(`Couldn't find "${q}". Try a nearby area or city name.`)
    } catch {
      setMessage("Search isn't working right now. Check your connection and try again.")
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form
        role="search"
        onSubmit={submit}
        className="flex h-[52px] items-center gap-2.5 rounded-2xl bg-white px-4 shadow-[0_4px_16px_rgba(21,24,27,0.10)]"
      >
        <span className="text-muted">{searching ? <Spinner size={20} /> : <Icon name="search" size={20} stroke={2} />}</span>
        <label htmlFor="area" className="sr-only">Search an area</label>
        <input
          id="area"
          type="search"
          enterKeyHint="search"
          placeholder="Search an area"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
        {place && (
          <button
            type="button"
            onClick={() => {
              onPlace(null)
              setQuery('')
            }}
            aria-label="Clear search and show ATMs near me"
            className="flex size-8 items-center justify-center rounded-full bg-soft text-ink"
          >
            <Icon name="xmark" size={16} />
          </button>
        )}
      </form>
      {message && <p className="rounded-xl bg-white px-3 py-2 text-[13px] text-down-ink shadow">{message}</p>}
    </div>
  )
}

function Empty({ icon, title, text, action }: { icon: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 border-t border-hair px-4 py-8 text-center">
      <span className="mb-1 text-faint">{icon}</span>
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="max-w-[300px] text-sm text-muted">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

function PrimarySmall({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="h-11 rounded-[14px] bg-primary px-5 font-bold text-white">
      {children}
    </button>
  )
}
