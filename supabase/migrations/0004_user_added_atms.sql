-- People can add ATMs that are missing, and name the bank of "ATM" entries
-- (OpenStreetMap ATMs with no bank). Both are anonymous, like reports.
-- To remove a bad entry: set its lifecycle to 'removed' in the Table Editor.

alter table atms add column added_by uuid;      -- device that added it (source = 'user')
alter table atms add column bank_set_by uuid;   -- device that named an unknown bank

create index atms_added_by_idx on atms (added_by, created_at desc) where added_by is not null;

-- Adds an ATM at the given spot (the phone's location, taken at the ATM).
-- Refuses near-duplicates: the same bank already listed within 30 m.
create function add_atm(
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
  existing uuid;
  created uuid;
begin
  if length(b) < 2 or length(b) > 80 or length(coalesce(l, '')) > 120 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  -- Roughly India's bounding box.
  if add_atm.lat not between 6 and 37.5 or add_atm.lng not between 68 and 97.5 then
    raise exception 'outside_india' using errcode = '22023';
  end if;

  if (
    select count(*) from atms a
    where a.added_by = add_atm.device and a.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  select a.id into existing from atms a
  where a.lifecycle <> 'removed'
    and lower(a.bank) = lower(b)
    and st_dwithin(a.location, st_setsrid(st_makepoint(add_atm.lng, add_atm.lat), 4326)::geography, 30)
  limit 1;
  if existing is not null then
    raise exception 'duplicate:%', existing using errcode = 'P0001';
  end if;

  insert into atms (bank, lat, lng, landmark, source, added_by)
  values (b, add_atm.lat, add_atm.lng, l, 'user', add_atm.device)
  returning id into created;
  return created;
end;
$$;

-- Names the bank of an ATM listed only as "ATM". First answer wins.
create function set_atm_bank(device uuid, atm uuid, bank text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  b text := btrim(coalesce(bank, ''));
begin
  if length(b) < 2 or length(b) > 80 then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update atms a set bank = b, bank_set_by = set_atm_bank.device
  where a.id = set_atm_bank.atm and a.bank = 'ATM';
  if not found then
    raise exception 'already_named' using errcode = 'P0001';
  end if;
end;
$$;

grant execute on function
  add_atm(uuid, text, double precision, double precision, text),
  set_atm_bank(uuid, uuid, text)
to anon, authenticated;
