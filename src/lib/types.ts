export type ReportStatus = 'working' | 'not_working' | 'no_cash'
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
}

export interface NearbyAtm extends Atm {
  distance_m: number
}

export interface HistoryItem {
  status: ReportStatus
  created_at: string
}
