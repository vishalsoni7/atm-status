// 'no_cash' is only on older reports; new ones use not_working + reason.
export type ReportStatus = 'working' | 'not_working' | 'no_cash'
export type ReportReason =
  | 'no_cash'
  | 'machine_off'
  | 'shutter_closed'
  | 'out_of_service'
  | 'card_not_accepted'
  | 'other'
export type Lifecycle = 'active' | 'suspected_removed' | 'removed'

export interface Atm {
  id: string
  bank: string
  address: string | null
  landmark: string | null
  lat: number
  lng: number
  lifecycle: Lifecycle
  last_status: ReportStatus | null
  last_reported_at: string | null
  // False for ATMs a visitor added that nobody else has confirmed yet.
  confirmed: boolean
}

export interface NearbyAtm extends Atm {
  distance_m: number
}

export interface HistoryItem {
  status: ReportStatus
  reason?: ReportReason | null
  created_at: string
}
