-- Allow searches up to 100 km (was capped at 50 km). For testing; the app
-- asks for 100 km while we test with sparse data. Still returns at most
-- `max_results` (50 by default) nearest ATMs, so large radii stay cheap to send.
create or replace function nearby_atms(
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
  join atms a on st_dwithin(a.location, p.pt, least(radius_m, 100000))
  left join lateral (
    select status, created_at from reports
    where atm_id = a.id order by created_at desc limit 1
  ) r on true
  where atm_is_visible(a)
  order by distance_m
  limit least(max_results, 200);
$$;
