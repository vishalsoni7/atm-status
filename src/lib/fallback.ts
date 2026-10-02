// Remembers that a paid-tier service (MapTiler map tiles or search) stopped
// working, so we switch to the free backup instead of showing a blank map,
// and don't keep hammering a service that's out of quota. Tries again later.
const RETRY_AFTER_MS = 6 * 60 * 60 * 1000

export type Service = 'tiles' | 'search'

const key = (s: Service) => `atm-status:${s}-down-until`

export function isDown(s: Service, now = Date.now()): boolean {
  try {
    return Number(localStorage.getItem(key(s)) ?? 0) > now
  } catch {
    return false
  }
}

export function markDown(s: Service) {
  try {
    localStorage.setItem(key(s), String(Date.now() + RETRY_AFTER_MS))
  } catch {
    // Private mode: we still switch for this visit.
  }
}
