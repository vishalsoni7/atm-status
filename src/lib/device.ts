const KEY = 'atm-status:device-id'

// Anonymous per-install id. No login; used only for rate limits and trust scoring.
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
