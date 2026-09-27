import type { Position } from './location'
import type { NearbyAtm } from './types'

// Close enough to be standing at the machine, allowing for GPS drift.
const AT_ATM_METERS = 60
// Ignore fixes vaguer than this; we'd be guessing which ATM they're at.
const MAX_ACCURACY_METERS = 100

// ATMs the person could be standing at, nearest first. Several ATMs often share
// a building, so this can be more than one.
export function atmsHere(pos: Position | null, atms: NearbyAtm[] | null): NearbyAtm[] {
  if (!pos || !atms || pos.accuracy > MAX_ACCURACY_METERS) return []
  return atms.filter((a) => a.distance_m <= AT_ATM_METERS && a.lifecycle !== 'removed').slice(0, 3)
}
