import type { Tone } from './status'

// Colour classes per status. Every status also has an icon and a word,
// so it never relies on colour alone.
export const TONE_CLASS: Record<Tone, { solid: string; soft: string; ink: string; text: string }> = {
  ok: { solid: 'bg-ok', soft: 'bg-ok-soft', ink: 'text-ok-ink', text: 'text-ok' },
  down: { solid: 'bg-down', soft: 'bg-down-soft', ink: 'text-down-ink', text: 'text-down' },
  unknown: { solid: 'bg-unknown-pin', soft: 'bg-unknown-soft', ink: 'text-unknown-ink', text: 'text-unknown' },
}

// HTML for a Leaflet divIcon status pin.
const PIN_GLYPH: Record<Tone, string> = {
  ok: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg>',
  down: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  unknown: '<span style="color:#fff;font-size:14px;font-weight:700;line-height:1">?</span>',
}
const PIN_COLOR: Record<Tone, string> = { ok: '#1b6e45', down: '#b4410e', unknown: '#7a8087' }

export function pinHtml(tone: Tone): string {
  return `<div class="pin" style="background:${PIN_COLOR[tone]}">${PIN_GLYPH[tone]}</div>`
}
