import { useSyncExternalStore } from 'react'

// Remembers on this device that contact details were saved, so the card stops
// showing. The real record lives in Supabase.
const KEY = 'atm-status:contact-saved'

const listeners = new Set<() => void>()
let cached: boolean | undefined

function read(): boolean {
  if (cached === undefined) {
    try {
      cached = localStorage.getItem(KEY) === '1'
    } catch {
      cached = false
    }
  }
  return cached
}

export function markContactSaved() {
  cached = true
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // Private mode: the card may show again next visit, which is fine.
  }
  listeners.forEach((l) => l())
}

export function useContactSaved(): boolean {
  return useSyncExternalStore((l) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }, read)
}
