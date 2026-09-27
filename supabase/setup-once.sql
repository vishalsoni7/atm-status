-- ATM Status: initial schema
-- Run in Supabase SQL editor (free tier) or via `supabase db push`.
-- Designed to scale past one city: every ATM belongs to a city, lookups are
-- by geography radius (GiST index), and all app access goes through RPC
-- functions so the client never depends on table layout.

create extension if not exists postgis with schema extensions;

create type atm_lifecycle as enum ('active', 'suspected_removed', 'removed');
create type report_status as enum ('working', 'not_working', 'no_cash');

-- ---------------------------------------------------------------- cities
create table cities (
  id         smallint generated always as identity primary key,
  slug       text not null unique,
  name       text not null,
  state      text not null,
  is_live    boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- atms
create table atms (
  id          uuid primary key default gen_random_uuid(),
  city_id     smallint not null references cities(id),
  bank        text not null,
  lat         double precision not null,
  lng         double precision not null,
  location    extensions.geography(Point, 4326) not null,
  address     text,
  landmark    text,
  lifecycle   atm_lifecycle not null default 'active',
  source      text not null default 'manual',   -- 'osm' | 'survey' | 'manual'
  source_ref  text unique,                       -- e.g. 'osm:node/123'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index atms_location_idx on atms using gist (location);
create index atms_city_idx on atms (city_id);

create function atms_set_location() returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.location := st_setsrid(st_makepoint(new.lng, new.lat), 4326)::geography;
  new.updated_at := now();
  return new;
end;
$$;

create trigger atms_set_location
before insert or update of lat, lng, bank, address, landmark, lifecycle on atms
for each row execute function atms_set_location();

-- ---------------------------------------------------------------- reports
create table reports (
  id         bigint generated always as identity primary key,
  atm_id     uuid not null references atms(id) on delete cascade,
  status     report_status not null,
  device_id  uuid not null,
  is_seed    boolean not null default false,  -- reports we made on site visits
  weight     real not null default 1,         -- Phase 2 trust layer
  created_at timestamptz not null default now()
);

create index reports_atm_time_idx on reports (atm_id, created_at desc);
create index reports_device_time_idx on reports (device_id, created_at desc);

-- ---------------------------------------------------------------- access
-- Tables are locked down; reads of atms/cities are public, everything that
-- touches reports goes through security-definer functions (device ids stay private).
alter table cities  enable row level security;
alter table atms    enable row level security;
alter table reports enable row level security;

create policy "cities are public" on cities for select using (true);
create policy "atms are public"   on atms   for select using (true);

-- ---------------------------------------------------------------- read RPCs
create function nearby_atms(
  user_lat double precision,
  user_lng double precision,
  radius_m integer default 5000,
  max_results integer default 50
)
returns table (
  id uuid, bank text, address text, landmark text,
  lat double precision, lng double precision, lifecycle atm_lifecycle,
  distance_m double precision,
  last_status report_status, last_reported_at timestamptz
)
language sql stable security definer
set search_path = public, extensions
as $$
  with p as (
    select st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography as pt
  )
  select a.id, a.bank, a.address, a.landmark, a.lat, a.lng, a.lifecycle,
         st_distance(a.location, p.pt) as distance_m,
         r.status, r.created_at
  from p
  join atms a on st_dwithin(a.location, p.pt, least(radius_m, 50000))
  left join lateral (
    select status, created_at from reports
    where atm_id = a.id order by created_at desc limit 1
  ) r on true
  where a.lifecycle <> 'removed'
  order by distance_m
  limit least(max_results, 200);
$$;

create function get_atm(atm uuid)
returns table (
  id uuid, bank text, address text, landmark text,
  lat double precision, lng double precision, lifecycle atm_lifecycle,
  last_status report_status, last_reported_at timestamptz
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.bank, a.address, a.landmark, a.lat, a.lng, a.lifecycle,
         r.status, r.created_at
  from atms a
  left join lateral (
    select status, created_at from reports
    where atm_id = a.id order by created_at desc limit 1
  ) r on true
  where a.id = atm;
$$;

create function atm_history(atm uuid, max_results integer default 20)
returns table (status report_status, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select status, created_at from reports
  where atm_id = atm
  order by created_at desc
  limit least(max_results, 100);
$$;

-- ---------------------------------------------------------------- write RPC
-- One-tap, no-login reporting with basic abuse limits:
--   * same device + same ATM: once per 10 minutes
--   * same device overall: 30 reports per hour
create function submit_report(atm uuid, status report_status, device uuid)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  created timestamptz;
begin
  if not exists (select 1 from atms a where a.id = atm and a.lifecycle <> 'removed') then
    raise exception 'unknown_atm' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from reports r
    where r.device_id = device and r.atm_id = atm
      and r.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  if (
    select count(*) from reports r
    where r.device_id = device and r.created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into reports (atm_id, status, device_id)
  values (atm, submit_report.status, device)
  returning created_at into created;

  return created;
end;
$$;

-- ---------------------------------------------------------------- removed ATMs
-- Flags ATMs that look gone: >= 3 "not working" reports from >= 2 devices in
-- the last 7 days and no "working"/"no cash" report in that window.
-- Only a human moves an ATM to 'removed' (after a visit / Street View check).
-- Schedule on Supabase (pg_cron, free) with:
--   select cron.schedule('flag-removed-atms', '0 3 * * *', 'select flag_suspected_removed()');
create function flag_suspected_removed() returns integer
language sql security definer
set search_path = public
as $$
  with flagged as (
    update atms a set lifecycle = 'suspected_removed'
    where a.lifecycle = 'active'
      and not exists (
        select 1 from reports r
        where r.atm_id = a.id and r.status <> 'not_working'
          and r.created_at > now() - interval '7 days'
      )
      and (
        select count(*) >= 3 and count(distinct device_id) >= 2
        from reports r
        where r.atm_id = a.id and r.status = 'not_working'
          and r.created_at > now() - interval '7 days'
      )
    returning 1
  )
  select count(*)::integer from flagged;
$$;

-- A fresh "working" report brings a suspected ATM back automatically.
create function reports_revive_atm() returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status <> 'not_working' then
    update atms set lifecycle = 'active'
    where id = new.atm_id and lifecycle = 'suspected_removed';
  end if;
  return new;
end;
$$;

create trigger reports_revive_atm
after insert on reports
for each row execute function reports_revive_atm();

revoke execute on function flag_suspected_removed() from public, anon, authenticated;

-- Explicit grants, so this works even with "Automatically expose new tables" off.
-- The app only calls these functions; it never touches the tables directly.
grant usage on schema public to anon, authenticated;
grant execute on function
  nearby_atms(double precision, double precision, integer, integer),
  get_atm(uuid),
  atm_history(uuid, integer),
  submit_report(uuid, report_status, uuid)
to anon, authenticated;

-- ---------------------------------------------------------------- pilot city
insert into cities (slug, name, state, is_live)
values ('bhilwara', 'Bhilwara', 'Rajasthan', true);
-- Generated from data/bhilwara-atms.csv on 2026-09-27T07:19:16.616Z
-- 5 ATMs (0 skipped with keep=no)
insert into atms (city_id, bank, lat, lng, address, landmark, source, source_ref)
select c.id, v.bank, v.lat, v.lng, v.address, v.landmark, v.source, v.source_ref
from (values
  ('HDFC Bank', 25.334426, 74.642367, null, null, 'osm', 'osm:node/2904828146'),
  ('State Bank of India', 25.334203, 74.642284, null, null, 'osm', 'osm:node/2904828147'),
  ('State Bank of India', 25.337936, 74.640867, null, null, 'osm', 'osm:node/2905658869'),
  ('Bank of Baroda', 25.344088, 74.639383, null, null, 'osm', 'osm:node/2907771949'),
  ('State Bank of India', 25.342921, 74.638248, 'Bhopal Ganj', null, 'osm', 'osm:way/286652661')
) as v(bank, lat, lng, address, landmark, source, source_ref)
cross join (select id from cities where slug = 'bhilwara') c
on conflict (source_ref) do update set
  bank = excluded.bank, lat = excluded.lat, lng = excluded.lng,
  address = excluded.address, landmark = excluded.landmark;
