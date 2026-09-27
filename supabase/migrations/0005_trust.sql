-- Trust layer against fake entries:
--   1. User-added ATMs stay "unconfirmed" until someone else (different phone
--      AND different connection) reports on them or confirms them. Unconfirmed
--      ones older than 30 days are hidden.
--   2. "This ATM isn't here": 2 different people flag it -> unconfirmed ATMs
--      are hidden, others marked 'suspected_removed' ("Possibly removed").
--      A later working/no-cash report revives it (existing trigger).
--   3. Limits per connection, not just per phone, so clearing browser data
--      doesn't reset them. We store only a one-way hash of the IP address.

-- ---------------------------------------------------------------- helpers
-- Hash of the caller's IP (from the headers Supabase's API passes through).
create function request_ip_hash() returns text
language sql stable
as $$
  select encode(sha256(convert_to(ip, 'UTF8')), 'hex')
  from (
    select coalesce(
      h->>'cf-connecting-ip',
      btrim(split_part(h->>'x-forwarded-for', ',', 1)),
      h->>'x-real-ip'
    ) as ip
    from (select nullif(current_setting('request.headers', true), '')::json as h) s
  ) t
  where ip is not null and ip <> '';
$$;

-- ---------------------------------------------------------------- columns
alter table atms add column confirmed_at timestamptz;   -- user-added only
alter table atms add column added_ip text;               -- hashed
alter table reports add column ip text;                   -- hashed
create index reports_ip_time_idx on reports (ip, created_at desc) where ip is not null;
create index atms_added_ip_idx on atms (added_ip, created_at desc) where added_ip is not null;

create table atm_flags (
  id         bigint generated always as identity primary key,
  atm_id     uuid not null references atms(id) on delete cascade,
  device_id  uuid not null,
  ip         text,                                       -- hashed
  created_at timestamptz not null default now(),
  unique (atm_id, device_id)
);
create index atm_flags_ip_time_idx on atm_flags (ip, created_at desc) where ip is not null;
alter table atm_flags enable row level security;

-- An ATM is trusted if it came from OpenStreetMap/us, or a second person confirmed it.
create function atm_is_confirmed(a atms) returns boolean
language sql immutable
as $$ select a.source <> 'user' or a.confirmed_at is not null $$;

-- Hidden: removed, or added by a visitor and nobody confirmed it within 30 days.
create function atm_is_visible(a atms) returns boolean
language sql stable
as $$
  select a.lifecycle <> 'removed'
     and not (a.source = 'user' and a.confirmed_at is null and a.created_at < now() - interval '30 days')
$$;

-- Marks a user-added ATM confirmed if this person isn't the one who added it.
create function try_confirm(atm uuid, device uuid, ip text) returns boolean
language sql
as $$
  with c as (
    update atms a set confirmed_at = now()
    where a.id = try_confirm.atm and a.source = 'user' and a.confirmed_at is null
      and a.added_by is distinct from try_confirm.device
      and (try_confirm.ip is null or a.added_ip is distinct from try_confirm.ip)
    returning 1
  )
  select exists (select 1 from c);
$$;

-- ---------------------------------------------------------------- read RPCs (now return `confirmed`)
drop function nearby_atms(double precision, double precision, integer, integer);
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
  last_status report_status, last_reported_at timestamptz,
  confirmed boolean
)
language sql stable security definer
set search_path = public, extensions
as $$
  with p as (
    select st_setsrid(st_makepoint(user_lng, user_lat), 4326)::geography as pt
  )
  select a.id, a.bank, a.address, a.landmark, a.lat, a.lng, a.lifecycle,
         st_distance(a.location, p.pt) as distance_m,
         r.status, r.created_at,
         atm_is_confirmed(a)
  from p
  join atms a on st_dwithin(a.location, p.pt, least(radius_m, 50000))
  left join lateral (
    select status, created_at from reports
    where atm_id = a.id order by created_at desc limit 1
  ) r on true
  where atm_is_visible(a)
  order by distance_m
  limit least(max_results, 200);
$$;

drop function get_atm(uuid);
create function get_atm(atm uuid)
returns table (
  id uuid, bank text, address text, landmark text,
  lat double precision, lng double precision, lifecycle atm_lifecycle,
  last_status report_status, last_reported_at timestamptz,
  confirmed boolean
)
language sql stable security definer
set search_path = public
as $$
  select a.id, a.bank, a.address, a.landmark, a.lat, a.lng, a.lifecycle,
         r.status, r.created_at,
         atm_is_confirmed(a)
  from atms a
  left join lateral (
    select status, created_at from reports
    where atm_id = a.id order by created_at desc limit 1
  ) r on true
  where a.id = atm and atm_is_visible(a);
$$;

-- ---------------------------------------------------------------- write RPCs
-- Same as before, plus a per-connection limit, and a report from someone
-- else confirms a user-added ATM.
create or replace function submit_report(atm uuid, status report_status, device uuid)
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  created timestamptz;
  caller_ip text := request_ip_hash();
begin
  if not exists (select 1 from atms a where a.id = atm and atm_is_visible(a)) then
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

  -- Generous: many phones share one mobile-network IP in India.
  if caller_ip is not null and (
    select count(*) from reports r
    where r.ip = caller_ip and r.created_at > now() - interval '1 hour'
  ) >= 200 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into reports (atm_id, status, device_id, ip)
  values (atm, submit_report.status, device, caller_ip)
  returning created_at into created;

  perform try_confirm(atm, device, caller_ip);
  return created;
end;
$$;

-- Adds a per-connection limit and records the (hashed) connection.
create or replace function add_atm(
  device uuid, bank text,
  lat double precision, lng double precision,
  landmark text default null
)
returns uuid
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  b text := btrim(coalesce(bank, ''));
  l text := nullif(btrim(coalesce(landmark, '')), '');
  caller_ip text := request_ip_hash();
  existing uuid;
  created uuid;
begin
  if length(b) < 2 or length(b) > 80 or length(coalesce(l, '')) > 120 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if add_atm.lat not between 6 and 37.5 or add_atm.lng not between 68 and 97.5 then
    raise exception 'outside_india' using errcode = '22023';
  end if;

  if (
    select count(*) from atms a
    where a.added_by = add_atm.device and a.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if caller_ip is not null and (
    select count(*) from atms a
    where a.added_ip = caller_ip and a.created_at > now() - interval '1 day'
  ) >= 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select a.id into existing from atms a
  where atm_is_visible(a)
    and lower(a.bank) = lower(b)
    and st_dwithin(a.location, st_setsrid(st_makepoint(add_atm.lng, add_atm.lat), 4326)::geography, 30)
  limit 1;
  if existing is not null then
    raise exception 'duplicate:%', existing using errcode = 'P0001';
  end if;

  insert into atms (bank, lat, lng, landmark, source, added_by, added_ip)
  values (b, add_atm.lat, add_atm.lng, l, 'user', add_atm.device, caller_ip)
  returning id into created;
  return created;
end;
$$;

-- "Yes, it's here" on an unconfirmed ATM.
create function confirm_atm(device uuid, atm uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  a atms;
begin
  select * into a from atms where id = confirm_atm.atm and atm_is_visible(atms);
  if not found then
    raise exception 'unknown_atm' using errcode = 'P0002';
  end if;
  if atm_is_confirmed(a) then
    return 'already_confirmed';
  end if;
  if try_confirm(confirm_atm.atm, confirm_atm.device, request_ip_hash()) then
    return 'confirmed';
  end if;
  return 'needs_someone_else';  -- the person who added it can't confirm it
end;
$$;

-- "This ATM isn't here". Two different people (and connections) since the
-- last positive report are enough to act.
create function flag_missing(device uuid, atm uuid)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  a atms;
  caller_ip text := request_ip_hash();
  since timestamptz;
  people integer;
begin
  select * into a from atms where id = flag_missing.atm and atm_is_visible(atms);
  if not found then
    raise exception 'unknown_atm' using errcode = 'P0002';
  end if;

  if caller_ip is not null and (
    select count(*) from atm_flags f where f.ip = caller_ip and f.created_at > now() - interval '1 day'
  ) >= 50 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into atm_flags (atm_id, device_id, ip)
  values (flag_missing.atm, flag_missing.device, caller_ip)
  on conflict (atm_id, device_id) do update set created_at = now(), ip = excluded.ip;

  -- Only flags after the latest "it's there" signal count.
  select greatest(
    coalesce(max(r.created_at), '-infinity'),
    coalesce(a.confirmed_at, '-infinity')
  ) into since
  from reports r where r.atm_id = flag_missing.atm and r.status <> 'not_working';

  select count(distinct coalesce(f.ip, f.device_id::text)) into people
  from atm_flags f
  where f.atm_id = flag_missing.atm and f.created_at > since;

  if people >= 2 then
    update atms set lifecycle = (case when atm_is_confirmed(a) then 'suspected_removed' else 'removed' end)::atm_lifecycle
    where id = flag_missing.atm;
    return 'hidden';
  end if;
  return 'flagged';
end;
$$;

grant execute on function
  nearby_atms(double precision, double precision, integer, integer),
  get_atm(uuid),
  confirm_atm(uuid, uuid),
  flag_missing(uuid, uuid)
to anon, authenticated;

-- Internal helpers are not callable from the app.
revoke execute on function request_ip_hash(), try_confirm(uuid, uuid, text),
  atm_is_confirmed(atms), atm_is_visible(atms) from public, anon, authenticated;

-- ---------------------------------------------------------------- your review list
-- Table Editor -> recent_user_atms: ATMs visitors added in the last 14 days.
-- To remove a fake one: in `atms`, set its lifecycle to 'removed'.
create view recent_user_atms with (security_invoker = true) as
select a.id, a.bank, a.landmark, a.lat, a.lng, a.created_at,
       a.confirmed_at is not null as confirmed, a.lifecycle,
       (select count(*) from atm_flags f where f.atm_id = a.id) as missing_flags,
       'https://www.google.com/maps?q=' || a.lat || ',' || a.lng as map_link
from atms a
where a.source = 'user' and a.created_at > now() - interval '14 days'
order by a.created_at desc;
revoke all on recent_user_atms from anon, authenticated;
