-- Optional contact details (email or mobile) people choose to share.
-- Not verified. One row per device; saving again replaces it.
-- Private: no policies, so the app can only write through save_contact() and
-- erase through delete_contact(). Read it yourself in the Supabase Table Editor.

create table contacts (
  device_id  uuid primary key,
  email      text,
  phone      text,                -- stored as +91XXXXXXXXXX
  source     text not null,       -- where they signed up: 'home' | 'after_report'
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint contacts_has_one check (email is not null or phone is not null)
);

alter table contacts enable row level security;

create function save_contact(device uuid, contact text, source text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  raw   text := btrim(coalesce(contact, ''));
  digits text := regexp_replace(raw, '[\s\-()]', '', 'g');
  e text;
  p text;
begin
  if source not in ('home', 'after_report') then
    raise exception 'invalid_source' using errcode = '22023';
  end if;

  if raw ~* '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' and length(raw) <= 254 then
    e := lower(raw);
  elsif digits ~ '^(\+?91|0)?[6-9][0-9]{9}$' then
    -- Indian mobile numbers start 6-9; keep the last 10 digits with +91.
    p := '+91' || right(digits, 10);
  else
    raise exception 'invalid_contact' using errcode = '22023';
  end if;

  insert into contacts (device_id, email, phone, source)
  values (device, e, p, source)
  on conflict (device_id) do update
    set email = excluded.email, phone = excluded.phone,
        source = excluded.source, consent_at = now();

  return coalesce(e, p);
end;
$$;

-- Erases the row for this device. Not used by the app at the moment.
create function delete_contact(device uuid)
returns void
language sql security definer
set search_path = public
as $$
  delete from contacts where device_id = device;
$$;

grant execute on function save_contact(uuid, text, text), delete_contact(uuid) to anon, authenticated;
