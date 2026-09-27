import { createClient } from '@supabase/supabase-js'
import { getDeviceId } from './device'
import { SEARCH_RADIUS_M } from './location'
import type { Atm, HistoryItem, NearbyAtm, ReportStatus } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')

const supabase = createClient(url, key, { auth: { persistSession: false } })

export async function fetchNearby(lat: number, lng: number): Promise<NearbyAtm[]> {
  const { data, error } = await supabase.rpc('nearby_atms', { user_lat: lat, user_lng: lng, radius_m: SEARCH_RADIUS_M }, { get: true })
  if (error) throw error
  return data
}

export async function fetchAtm(id: string): Promise<Atm | null> {
  const { data, error } = await supabase.rpc('get_atm', { atm: id }, { get: true })
  if (error) throw error
  return data[0] ?? null
}

export async function fetchHistory(id: string): Promise<HistoryItem[]> {
  const { data, error } = await supabase.rpc('atm_history', { atm: id }, { get: true })
  if (error) throw error
  return data
}

export class RateLimitedError extends Error {}

export async function submitReport(atmId: string, status: ReportStatus): Promise<void> {
  const { error } = await supabase.rpc('submit_report', { atm: atmId, status, device: getDeviceId() })
  if (error?.message === 'rate_limited') throw new RateLimitedError()
  if (error) throw error
}

export class InvalidContactError extends Error {}

export type ContactSource = 'home' | 'after_report'

// Returns the cleaned-up value that was saved (lowercased email or +91 number).
export async function saveContact(contact: string, source: ContactSource): Promise<string> {
  const { data, error } = await supabase.rpc('save_contact', { device: getDeviceId(), contact, source })
  if (error?.message === 'invalid_contact') throw new InvalidContactError()
  if (error) throw error
  return data
}

export class DuplicateAtmError extends Error {
  existingId: string
  constructor(existingId: string) {
    super('duplicate')
    this.existingId = existingId
  }
}
export class OutsideIndiaError extends Error {}

// Adds a missing ATM at the given spot. Returns the new ATM's id.
export async function addAtm(bank: string, lat: number, lng: number, landmark: string): Promise<string> {
  const { data, error } = await supabase.rpc('add_atm', { device: getDeviceId(), bank, lat, lng, landmark })
  const dup = error?.message.match(/^duplicate:(.+)$/)
  if (dup) throw new DuplicateAtmError(dup[1])
  if (error?.message === 'rate_limited') throw new RateLimitedError()
  if (error?.message === 'outside_india') throw new OutsideIndiaError()
  if (error) throw error
  return data
}

export class AlreadyNamedError extends Error {}

// Names the bank of an ATM listed only as "ATM".
export async function setAtmBank(atmId: string, bank: string): Promise<void> {
  const { error } = await supabase.rpc('set_atm_bank', { device: getDeviceId(), atm: atmId, bank })
  if (error?.message === 'already_named') throw new AlreadyNamedError()
  if (error) throw error
}

export type ConfirmResult = 'confirmed' | 'already_confirmed' | 'needs_someone_else'

// "Yes, it's here" on an ATM a visitor added.
export async function confirmAtm(atmId: string): Promise<ConfirmResult> {
  const { data, error } = await supabase.rpc('confirm_atm', { device: getDeviceId(), atm: atmId })
  if (error) throw error
  return data
}

// "This ATM isn't here". Returns 'hidden' once enough people agree.
export async function flagMissing(atmId: string): Promise<'flagged' | 'hidden'> {
  const { data, error } = await supabase.rpc('flag_missing', { device: getDeviceId(), atm: atmId })
  if (error?.message === 'rate_limited') throw new RateLimitedError()
  if (error) throw error
  return data
}
