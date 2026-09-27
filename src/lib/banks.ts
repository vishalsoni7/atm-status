// Short name + brand-ish colour for the round badge beside each ATM.
// Order matters: more specific names first ("Central Bank of India" before "Bank of India").
const KNOWN: [RegExp, string, string][] = [
  [/state bank|\bsbi\b/i, 'SBI', '#1E4FA3'],
  [/central bank/i, 'CBI', '#C1272D'],
  [/bank of baroda|\bbob\b/i, 'BoB', '#E8641B'],
  [/bank of india/i, 'BOI', '#F28C28'],
  [/hdfc/i, 'HDFC', '#0B4A8B'],
  [/icici/i, 'ICICI', '#A3282E'],
  [/punjab national|\bpnb\b/i, 'PNB', '#9B1B3B'],
  [/axis/i, 'Axis', '#8E1B4C'],
  [/canara/i, 'CB', '#0077B6'],
  [/union bank/i, 'UBI', '#C8102E'],
  [/kotak/i, 'Kotak', '#D71F2B'],
  [/idbi/i, 'IDBI', '#00836C'],
  [/yes bank/i, 'YES', '#0055A5'],
  [/indusind/i, 'IIB', '#7A1F2B'],
  [/indicash|tata/i, 'Tata', '#1B3F8F'],
  [/india1/i, 'India1', '#F26522'],
]

const FILLER = new Set(['bank', 'of', 'the', 'ltd', 'limited'])

export function bankBadge(name: string): { short: string; color: string } {
  for (const [re, short, color] of KNOWN) if (re.test(name)) return { short, color }
  const words = name.split(/\s+/).filter((w) => w && !FILLER.has(w.toLowerCase()))
  const short = (words.length > 1 ? words.slice(0, 2).map((w) => w[0]) : [words[0]?.slice(0, 3) ?? '?']).join('').toUpperCase()
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return { short, color: `hsl(${hash % 360} 45% 42%)` }
}
