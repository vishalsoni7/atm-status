// Short name + brand-ish colour for the round badge beside each ATM.
// Order matters: names that contain another bank's name ("Union Bank of India",
// "South Indian Bank") must come before the broad "Bank of India"/"Indian Bank".
const KNOWN: [RegExp, string, string][] = [
  [/state bank|\bsbi\b/i, 'SBI', '#1E4FA3'],
  [/central bank/i, 'CBI', '#C1272D'],
  [/bank of baroda|\bbob\b/i, 'BoB', '#E8641B'],
  [/bank of maharashtra/i, 'BoM', '#1F5AA6'],
  [/hdfc/i, 'HDFC', '#0B4A8B'],
  [/icici/i, 'ICICI', '#A3282E'],
  [/axis/i, 'Axis', '#8E1B4C'],
  [/punjab (&|and) sind/i, 'PSB', '#1C7C3C'],
  [/punjab national|\bpnb\b/i, 'PNB', '#9B1B3B'],
  [/canara/i, 'CB', '#0077B6'],
  [/union bank/i, 'UBI', '#C8102E'],
  [/indian overseas|\biob\b/i, 'IOB', '#1D5FA8'],
  [/\buco\b/i, 'UCO', '#1B4F9C'],
  [/kotak/i, 'Kotak', '#D71F2B'],
  [/idbi/i, 'IDBI', '#00836C'],
  [/idfc/i, 'IDFC', '#9C1D26'],
  [/yes bank/i, 'YES', '#0055A5'],
  [/indusind/i, 'IIB', '#7A1F2B'],
  [/federal bank/i, 'FB', '#1D3F8F'],
  [/south indian bank/i, 'SIB', '#B0232A'],
  [/karnataka bank/i, 'KBL', '#6A2C91'],
  [/karur vysya/i, 'KVB', '#2E7D32'],
  [/city union/i, 'CUB', '#A6192E'],
  [/tamilnad mercantile/i, 'TMB', '#1B5E20'],
  [/citi ?bank/i, 'Citi', '#0A5DA8'],
  [/\bau small|\bau bank/i, 'AU', '#6D2077'],
  [/indicash|tata/i, 'Tata', '#1B3F8F'],
  [/india ?1/i, 'India1', '#F26522'],
  [/hitachi/i, 'HMS', '#D0021B'],
  [/^atm$/i, 'ATM', '#6E6E73'],
  // Broad patterns last.
  [/bank of india/i, 'BOI', '#F28C28'],
  [/indian bank/i, 'IB', '#2A5CAA'],
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

// OpenStreetMap ATMs with no bank are stored as "ATM".
export const UNKNOWN_BANK = 'ATM'

export function displayBank(bank: string): string {
  return bank === UNKNOWN_BANK ? 'ATM (bank not known)' : bank
}

// Choices when adding an ATM or naming its bank, most common first.
export const BANK_CHOICES = [
  'State Bank of India',
  'HDFC Bank',
  'ICICI Bank',
  'Axis Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Canara Bank',
  'Union Bank of India',
  'Bank of India',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'IDBI Bank',
  'Yes Bank',
  'IDFC First Bank',
  'Central Bank of India',
  'Indian Bank',
  'Indian Overseas Bank',
  'UCO Bank',
  'Bank of Maharashtra',
  'Punjab & Sind Bank',
  'Federal Bank',
  'South Indian Bank',
  'Karnataka Bank',
  'Karur Vysya Bank',
  'City Union Bank',
  'Tamilnad Mercantile Bank',
  'AU Small Finance Bank',
  'Indicash',
  'India1',
  'Hitachi Money Spot',
]
