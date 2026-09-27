// Pulls ATMs for a city from OpenStreetMap (Overpass API, free) into a CSV
// you clean by hand before loading.
//
//   node scripts/fetch-osm.mjs bhilwara
//
// Add a city by adding its bounding box below (south, west, north, east).
// Get one from https://boundingbox.klokantech.com (CSV format, swap order).

import { writeFileSync, existsSync } from 'node:fs'

const CITIES = {
  bhilwara: [25.29, 74.57, 25.40, 74.70],
  ajmer: [26.40, 74.58, 26.52, 74.70],
  kota: [25.08, 75.78, 25.24, 75.92],
  jaipur: [26.77, 75.65, 27.03, 75.93],
}

const slug = process.argv[2]
const bbox = CITIES[slug]
if (!bbox) {
  console.error(`Usage: node scripts/fetch-osm.mjs <${Object.keys(CITIES).join('|')}>`)
  process.exit(1)
}

const out = `data/${slug}-atms.csv`
if (existsSync(out) && !process.argv.includes('--force')) {
  console.error(`${out} exists (it may have your manual edits). Re-run with --force to overwrite.`)
  process.exit(1)
}

const b = bbox.join(',')
const query = `
[out:json][timeout:90];
(
  nwr["amenity"="atm"](${b});
  nwr["amenity"="bank"]["atm"="yes"](${b});
);
out center tags;`

// Free public Overpass servers; the main one is often busy, so fall through.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]

let elements
for (const url of SERVERS) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'atm-status-seed/0.1 (side project; one-off city import)',
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


const rows = elements.map((el) => {
  const t = el.tags ?? {}
  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  const address = [t['addr:housenumber'], t['addr:street'], t['addr:suburb'] ?? t['addr:place']]
    .filter(Boolean)
    .join(', ')
  return {
    source_ref: `osm:${el.type}/${el.id}`,
    bank: t.operator ?? t.brand ?? t.name ?? '',
    lat: lat.toFixed(6),
    lng: lng.toFixed(6),
    address,
    landmark: t.description ?? '',
    keep: 'yes',
    notes: t.amenity === 'bank' ? 'bank branch with atm=yes' : '',
  }
})

const cols = ['source_ref', 'bank', 'lat', 'lng', 'address', 'landmark', 'keep', 'notes']
const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replaceAll('"', '""')}"` : v)
const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')

writeFileSync(out, csv + '\n')
console.log(`Wrote ${rows.length} ATMs to ${out}`)
console.log('Next: fix bank names, fill address/landmark, set keep=no for bad rows,')
console.log('add ATMs you find on the ground (leave source_ref empty), then run:')
console.log(`  node scripts/csv-to-sql.mjs ${slug}`)
