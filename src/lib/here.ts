import { distanceM, type Position } from './location'
import type { NearbyAtm } from './types'

// Close enough to be standing at the machine.
const AT_ATM_METERS = 60
// GPS error we give the benefit of the doubt for (a rough fix can still show
// the card if they're plausibly at the ATM).
const ACCURACY_ALLOWANCE_M = 75
// Vaguer than this and we'd be guessing which ATM they're at.
const MAX_ACCURACY_METERS = 150

// ATMs the person could be standing at, nearest first, measured from their
// live position (the list may have been loaded from somewhere else). Several
// ATMs often share a building, so this can be more than one.
export function atmsHere(pos: Position | null, atms: NearbyAtm[] | null): NearbyAtm[] {
  if (!pos || !atms || pos.accuracy > MAX_ACCURACY_METERS) return []
  const slack = Math.min(pos.accuracy, ACCURACY_ALLOWANCE_M)
  return atms
    .filter((a) => a.lifecycle !== 'removed')
    .map((a) => ({ ...a, distance_m: distanceM(pos, a) }))
    .filter((a) => a.distance_m - slack <= AT_ATM_METERS)
    .sort((x, y) => x.distance_m - y.distance_m)
    .slice(0, 3)
}
