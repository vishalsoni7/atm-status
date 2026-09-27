// Turns a cleaned data/<city>-atms.csv into supabase/seed/<city>.sql.
// Paste the output into the Supabase SQL editor. Safe to re-run: OSM rows
// upsert on source_ref; survey rows (empty source_ref) get a stable ref.
//
//   node scripts/csv-to-sql.mjs bhilwara

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const slug = process.argv[2]
if (!slug) {
  console.error('Usage: node scripts/csv-to-sql.mjs <city-slug>')
  process.exit(1)
}

function parseCsv(text) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()))
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])))
}

const sql = (v) => (v ? `'${v.replaceAll("'", "''")}'` : 'null')

const rows = parseCsv(readFileSync(`data/${slug}-atms.csv`, 'utf8'))
const kept = rows.filter((r) => r.keep.toLowerCase() !== 'no')

const errors = []
const values = kept.map((r, i) => {
  const lat = Number(r.lat), lng = Number(r.lng)
  if (!r.bank) errors.push(`row ${i + 2}: missing bank`)
  if (!(lat > 6 && lat < 38 && lng > 68 && lng < 98)) errors.push(`row ${i + 2}: lat/lng outside India`)
  const ref = r.source_ref ||
    `survey:${createHash('sha1').update(`${r.bank}|${lat.toFixed(4)}|${lng.toFixed(4)}`).digest('hex').slice(0, 12)}`
  const source = ref.split(':')[0]
  return `  (${sql(r.bank)}, ${lat}, ${lng}, ${sql(r.address)}, ${sql(r.landmark)}, ${sql(source)}, ${sql(ref)})`
})

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const out = `-- Generated from data/${slug}-atms.csv on ${new Date().toISOString()}
-- ${kept.length} ATMs (${rows.length - kept.length} skipped with keep=no)
insert into atms (city_id, bank, lat, lng, address, landmark, source, source_ref)
select c.id, v.bank, v.lat, v.lng, v.address, v.landmark, v.source, v.source_ref
from (values
${values.join(',\n')}
) as v(bank, lat, lng, address, landmark, source, source_ref)
cross join (select id from cities where slug = ${sql(slug)}) c
on conflict (source_ref) do update set
  bank = excluded.bank, lat = excluded.lat, lng = excluded.lng,
  address = excluded.address, landmark = excluded.landmark;
`

writeFileSync(`supabase/seed/${slug}.sql`, out)
console.log(`Wrote ${kept.length} ATMs to supabase/seed/${slug}.sql`)
