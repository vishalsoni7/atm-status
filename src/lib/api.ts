import { createClient } from '@supabase/supabase-js'
import { getDeviceId } from './device'
import type { Atm, HistoryItem, NearbyAtm, ReportStatus } from './types'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
if (!url || !key) throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')

const supabase = createClient(url, key, { auth: { persistSession: false } })

export async function fetchNearby(lat: number, lng: number): Promise<NearbyAtm[]> {
  const { data, error } = await supabase.rpc('nearby_atms', { user_lat: lat, user_lng: lng, radius_m: 10000 }, { get: true })
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
