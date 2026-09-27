# ATM Status

Tells people whether a nearby ATM is working before they go. Pilot city: Bhilwara.

Everything runs on free tiers: Supabase (Postgres + PostGIS), OpenStreetMap
(seed data), Google Maps links (directions), and any static host
(Cloudflare Pages / Netlify / Vercel).

## Setup

1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/migrations/0001_init.sql`.
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key.
4. `npm install && npm run dev`

## Seeding a city

```sh
node scripts/fetch-osm.mjs bhilwara      # OSM → data/bhilwara-atms.csv
# edit the CSV: fix bank names, add address/landmark, keep=no for bad rows,
# add ATMs found on the ground (leave source_ref empty)
node scripts/csv-to-sql.mjs bhilwara     # → supabase/seed/bhilwara.sql
```

Paste the generated SQL into the Supabase SQL editor. Re-running it is safe
because rows are updated by `source_ref`.

To record your own site-visit reports, run this in the SQL editor:

```sql
insert into reports (atm_id, status, device_id, is_seed)
values ('<atm id>', 'working', '00000000-0000-0000-0000-000000000000', true);
```

## New city

1. Add a row to `cities`.
2. Add its bounding box to `scripts/fetch-osm.mjs`.
3. Seed it as above. The app needs no changes: it only asks for ATMs near the user.

## Removed ATMs

`flag_suspected_removed()` marks an ATM "possibly removed" when, in the last
7 days, it has only "not working" reports (3 or more, from at least 2
devices). A later "working" report restores it automatically. Only set
`lifecycle = 'removed'` by hand after checking in person. To run the check
daily on Supabase:

```sql
select cron.schedule('flag-removed-atms', '0 3 * * *', 'select flag_suspected_removed()');
```

## Layout

- `supabase/migrations`: schema, access rules, RPC functions (the only API the app uses)
- `scripts`: seed pipeline
- `src/screens`: Nearby, Detail, Report
- `src/lib`: Supabase calls, anonymous device id, location, time formatting
