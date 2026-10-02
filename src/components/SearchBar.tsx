import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { atmName, bankBadge } from '../lib/banks'
import { SUGGEST_MIN_CHARS, canSuggest, searchPlace, suggestPlaces, type Place } from '../lib/geocode'
import { formatDistance } from '../lib/location'
import type { Tone } from '../lib/status'
import type { NearbyAtm } from '../lib/types'
import { Icon, Spinner } from './Icon'
import { BankTile } from './Status'

// Wait for a pause in typing before asking for place suggestions (saves quota).
const SUGGEST_DELAY_MS = 300
// ATMs already on screen match from 2 letters ("SB", "HD"); they cost nothing.
const ATM_MIN_CHARS = 2
const MAX_ATMS = 3

type SearchAtm = NearbyAtm & { tone: Tone }
type Item = { kind: 'atm'; atm: SearchAtm } | { kind: 'place'; place: Place }

interface Props {
  place: Place | null
  near: { lat: number; lng: number } | null
  // ATMs currently listed; matching ones are suggested first.
  atms: SearchAtm[]
  // Tallest the suggestion list may get before it scrolls.
  listMaxHeight: number
  onPlace: (p: Place | null) => void
  onAtm: (id: string) => void
}

function matchAtms(atms: SearchAtm[], query: string): SearchAtm[] {
  const q = query.trim().toLowerCase()
  if (q.length < ATM_MIN_CHARS) return []
  return atms
    .filter((a) =>
      [atmName(a.bank), a.bank, bankBadge(a.bank).short, a.landmark, a.address].some((f) => f?.toLowerCase().includes(q)),
    )
    .slice(0, MAX_ATMS)
}

// Area search with live suggestions. Enter still jumps to the best place match.
export function SearchBar({ place, near, atms, listMaxHeight, onPlace, onAtm }: Props) {
  const listId = useId()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [places, setPlaces] = useState<Place[]>([])
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(-1)
  // The text of the place just picked, so picking doesn't trigger a new lookup.
  const [picked, setPicked] = useState<string | null>(null)
  // Latest map centre for suggestions, without re-searching when the map moves.
  const nearRef = useRef(near)
  useEffect(() => {
    nearRef.current = near
  }, [near])

  useEffect(() => {
    const q = query.trim()
    if (!canSuggest() || q.length < SUGGEST_MIN_CHARS || q === picked) return
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      setSuggesting(true)
      suggestPlaces(q, nearRef.current, ctrl.signal)
        .then(
          (list) => {
            setPlaces(list)
            setActive(-1)
          },
          () => {}, // Aborted, offline or service down: Enter still works.
        )
        .finally(() => !ctrl.signal.aborted && setSuggesting(false))
    }, SUGGEST_DELAY_MS)
    return () => {
      clearTimeout(t)
      ctrl.abort()
      setSuggesting(false)
    }
  }, [query, picked])

  const atmMatches = useMemo(() => (picked === query ? [] : matchAtms(atms, query)), [atms, query, picked])
  const items: Item[] = [
    ...atmMatches.map((atm) => ({ kind: 'atm' as const, atm })),
    ...(query.trim().length >= SUGGEST_MIN_CHARS && picked !== query ? places : []).map((p) => ({ kind: 'place' as const, place: p })),
  ]
  const showList = focused && items.length > 0

  function reset() {
    setPlaces([])
    setActive(-1)
    setMessage(null)
  }

  function choose(item: Item) {
    if (item.kind === 'atm') {
      reset()
      onAtm(item.atm.id)
      return
    }
    setPicked(item.place.label)
    setQuery(item.place.label)
    reset()
    setFocused(false)
    onPlace(item.place)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (showList && active >= 0 && items[active]) return choose(items[active])
    const q = query.trim()
    if (!q) return
    setFocused(false)
    setSearching(true)
    setMessage(null)
    try {
      const hit = await searchPlace(q, near)
      if (hit) choose({ kind: 'place', place: hit })
      else setMessage(`Couldn't find "${q}". Try a nearby area or city name.`)
    } catch {
      setMessage("Search isn't working right now. Check your connection and try again.")
    } finally {
      setSearching(false)
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!showList) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setFocused(false)
    }
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <form
        role="search"
        onSubmit={submit}
        className="flex h-[52px] items-center gap-2.5 rounded-2xl bg-surface px-4 shadow-[0_4px_16px_rgba(21,24,27,0.10)]"
      >
        <span className="text-muted">{searching || suggesting ? <Spinner size={20} /> : <Icon name="search" size={20} stroke={2} />}</span>
        <label htmlFor="area" className="sr-only">Search an area or bank</label>
        <input
          id="area"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Search an area or bank"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(e) => {
            setPicked(null)
            setQuery(e.target.value)
            setActive(-1)
            setFocused(true)
            if (e.target.value.trim().length < SUGGEST_MIN_CHARS) setPlaces([])
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
        />
        {(place || query) && (
          <button
            type="button"
            onClick={() => {
              setPicked(null)
              setQuery('')
              reset()
              onPlace(null)
            }}
            aria-label={place ? 'Clear search and show ATMs near me' : 'Clear search'}
            className="flex size-8 items-center justify-center rounded-full bg-soft text-ink"
          >
            <Icon name="xmark" size={16} />
          </button>
        )}
      </form>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Suggestions"
          className="scroll-y absolute inset-x-0 top-[58px] z-10 rounded-2xl bg-surface py-0.5 shadow-[0_8px_24px_rgba(21,24,27,0.16)]"
          style={{ maxHeight: listMaxHeight }}
        >
          {items.map((item, i) => (
            <li
              key={item.kind === 'atm' ? `atm-${item.atm.id}` : `place-${item.place.label}-${item.place.lat}-${item.place.lng}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: fires before the input's blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault()
                choose(item)
              }}
              className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 ${i === active ? 'bg-soft' : 'active:bg-soft'} ${
                item.kind === 'place' && i > 0 && items[i - 1].kind === 'atm' ? 'border-t border-hair' : ''
              }`}
            >
              {item.kind === 'atm' ? (
                <>
                  <BankTile bank={item.atm.bank} tone={item.atm.tone} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] leading-5 font-semibold">{atmName(item.atm.bank)}</span>
                    <span className="truncate text-[13px] text-muted">
                      {[item.atm.landmark || item.atm.address, formatDistance(item.atm.distance_m)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center text-muted"><Icon name="pin" size={18} /></span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] leading-5 font-semibold">{item.place.label}</span>
                    {item.place.detail && <span className="truncate text-[13px] leading-[18px] text-muted">{item.place.detail}</span>}
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="rounded-xl bg-surface px-3 py-2 text-[13px] text-down-ink shadow">{message}</p>}
    </div>
  )
}
