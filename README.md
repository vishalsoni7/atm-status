# ATM Status

Tells people whether a nearby ATM is working before they go. Covers all of
India (ATM locations from OpenStreetMap); statuses come from people who
report at the ATM. Live at https://atmstatus.vercel.app

Runs on free tiers: Supabase (Postgres + PostGIS), MapTiler (map + search,
with an automatic OpenStreetMap backup), Vercel (hosting).

## Setup

1. Create a free project at https://supabase.com.
2. In the SQL editor, run the files in `supabase/migrations` **in order**:
   `0001` → `0002` → `0003` → `0004` → `0005` → `0007`.
   (`0006` is optional: it only raises the search-radius ceiling to 100 km.)
3. Load ATMs: paste each `supabase/seed/india/part-XX-of-05.sql` into the SQL
   editor and run it (one file at a time; the editor has a size limit).
   Safe to re-run.
4. Copy `.env.example` to `.env.local` and fill in the Supabase URL and
   publishable key, and a MapTiler key (maptiler.com → API Keys; restrict it
   to your site under "Allowed HTTP Origins").
5. `npm install && npm run dev`, then open http://localhost:5173

For the live site, the same three `VITE_*` values must be set in Vercel
(Project → Settings → Environment Variables).

## Refreshing ATM data

```sh
node scripts/fetch-osm-india.mjs   # OpenStreetMap → supabase/seed/india/*.sql
```

Existing ATMs are left untouched (so manual fixes survive); new ones are added.
People can also add missing ATMs in the app; review them in Supabase
(Table Editor → `recent_user_atms`). To hide a fake one, set its `lifecycle`
to `removed` in `atms`.

## Keeping the free database awake

Supabase's free plan pauses a project after 7 days without requests.
`.github/workflows/keep-alive.yml` makes one small read every 3 days once it
is pushed to GitHub. GitHub stops scheduled jobs in repositories with no
activity for 60 days, so push something now and then.

## Trust rules (database)

- Reports: one per phone per ATM every 10 minutes, plus per-connection limits
  (IP addresses are stored only as one-way hashes).
- The app only lets people report within ~150 m of the ATM.
- A status counts for 10 hours, then shows as Unknown.
- ATMs people add stay "Unconfirmed" until someone else confirms them;
  unconfirmed ones disappear after 30 days.
- "This ATM isn't here" from two different people hides it (or marks an
  OpenStreetMap ATM "Possibly removed" until someone reports it working).

## Layout

- `supabase/migrations`: schema, access rules and the functions the app calls
  (the app never reads tables directly)
- `scripts`: OpenStreetMap import
- `src/screens`: Map, ATM detail, Report, Thanks
- `src/components`: map, search, bottom sheets, status badges, footer
- `src/lib`: Supabase calls, location, map tiles and search (with backups),
  status rules, bank names
