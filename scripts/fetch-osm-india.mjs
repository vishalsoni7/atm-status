// Pulls every ATM in India from OpenStreetMap (Overpass API, free) and writes
// ready-to-run SQL in chunks small enough to paste into the Supabase SQL editor.
//
//   node scripts/fetch-osm-india.mjs
//   node scripts/fetch-osm-india.mjs saved.json   (use an Overpass download you already have)
//
// Re-run any time to pick up new OSM data: existing ATMs are left untouched
// (so your manual fixes survive), new ones are added.

import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'

const CHUNK = 4000
const OUT_DIR = 'supabase/seed/india'

const query = `
[out:json][timeout:900];
area["ISO3166-1"="IN"][admin_level=2]->.in;
(
  nwr["amenity"="atm"](area.in);
  nwr["amenity"="bank"]["atm"="yes"](area.in);
);
out center tags;`

// Free public Overpass servers; the main one is often busy, so fall through.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

// Canonical bank names. Merged banks map to the bank that now runs their ATMs.
// Order matters: names that contain another bank's name ("Union Bank of India",
// "South Indian Bank") must come before the broad "Bank of India"/"Indian Bank".
const BANKS = [
  [/state bank|\bsbi\b/i, 'State Bank of India'],
  [/central bank/i, 'Central Bank of India'],
  [/bank of baroda|\bbob\b|vijaya|dena bank/i, 'Bank of Baroda'],
  [/bank of maharashtra/i, 'Bank of Maharashtra'],
  [/hdfc/i, 'HDFC Bank'],
  [/icici/i, 'ICICI Bank'],
  [/axis/i, 'Axis Bank'],
  [/punjab national|\bpnb\b|oriental bank|\bobc\b|united bank of india/i, 'Punjab National Bank'],
  [/punjab (&|and) sind/i, 'Punjab & Sind Bank'],
  [/canara|syndicate/i, 'Canara Bank'],
  [/union bank|corporation bank|andhra bank/i, 'Union Bank of India'],
  [/indian overseas|\biob\b/i, 'Indian Overseas Bank'],
  [/\buco\b/i, 'UCO Bank'],
  [/kotak/i, 'Kotak Mahindra Bank'],
  [/indusind/i, 'IndusInd Bank'],
  [/\bidbi\b/i, 'IDBI Bank'],
  [/idfc/i, 'IDFC First Bank'],
  [/yes bank/i, 'Yes Bank'],
  [/federal bank/i, 'Federal Bank'],
  [/south indian bank/i, 'South Indian Bank'],
  [/karnataka bank/i, 'Karnataka Bank'],
  [/karur vysya/i, 'Karur Vysya Bank'],
  [/city union/i, 'City Union Bank'],
  [/tamilnad mercantile/i, 'Tamilnad Mercantile Bank'],
  [/citi ?bank/i, 'Citibank'],
  [/indicash|tata comm/i, 'Indicash'],
  [/india ?1/i, 'India1'],
  [/hitachi/i, 'Hitachi Money Spot'],
  // Broad patterns last.
  [/bank of india|\bboi\b/i, 'Bank of India'],
  [/indian bank|allahabad bank/i, 'Indian Bank'],
]

function bankName(tags) {
  const raw = (tags.operator ?? tags.brand ?? tags.name ?? '').trim()
  if (!raw) return 'ATM'
  for (const [re, name] of BANKS) if (re.test(raw)) return name
  // Unknown bank: tidy "Some Bank ATM" -> "Some Bank".
  return raw.replace(/\s+atm$/i, '').trim() || 'ATM'
}

const saved = process.argv[2]
let elements = saved ? JSON.parse(readFileSync(saved, 'utf8')).elements : undefined
for (const url of elements ? [] : SERVERS) {
  try {
    console.log(`Fetching from ${new URL(url).host} (can take a few minutes)...`)
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'atm-status-seed/0.1 (side project; India ATM import)',
      },
      body: 'data=' + encodeURIComponent(query),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    ;({ elements } = await res.json())
    break
  } catch (err) {
    console.warn(`${new URL(url).host} failed (${err.message}), trying next server...`)
  }
}
if (!elements) {
  console.error('All Overpass servers failed. Try again in a few minutes.')
  process.exit(1)
}

const sql = (v) => (v ? `'${String(v).replaceAll("'", "''")}'` : 'null')

const rows = elements
  .map((el) => {
    const t = el.tags ?? {}
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (lat == null || lng == null) return null
    const address = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] ?? t['addr:place'], t['addr:city']]
      .filter(Boolean)
      .join(', ')
    return `(${sql(bankName(t))}, ${lat.toFixed(6)}, ${lng.toFixed(6)}, ${sql(address)}, 'osm', ${sql(`osm:${el.type}/${el.id}`)})`
  })
  .filter(Boolean)

mkdirSync(OUT_DIR, { recursive: true })
for (const f of readdirSync(OUT_DIR)) rmSync(`${OUT_DIR}/${f}`)

const parts = Math.ceil(rows.length / CHUNK)
for (let i = 0; i < parts; i++) {
  const chunk = rows.slice(i * CHUNK, (i + 1) * CHUNK)
  const file = `${OUT_DIR}/part-${String(i + 1).padStart(2, '0')}-of-${String(parts).padStart(2, '0')}.sql`
  writeFileSync(
    file,
    `-- ATMs in India from OpenStreetMap (© OpenStreetMap contributors, ODbL). Part ${i + 1} of ${parts}.\n` +
      `-- Safe to re-run: ATMs already in the table are skipped.\n` +
      `insert into atms (bank, lat, lng, address, source, source_ref) values\n` +
      chunk.join(',\n') +
      `\non conflict (source_ref) do nothing;\n`,
  )
}
console.log(`Wrote ${rows.length} ATMs into ${parts} files in ${OUT_DIR}/`)
