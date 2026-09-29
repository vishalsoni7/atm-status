-- Optional reason on "Not working" reports (new report screen).
-- Existing rows are untouched; old 'no_cash' statuses are shown as
-- "Not working · No cash" by the app.

alter table reports add column reason text
  check (reason in ('no_cash', 'machine_off', 'shutter_closed', 'out_of_service', 'card_not_accepted', 'other'));

-- New 4-argument version. `reason` has no default on purpose: the older app
-- calls the 3-argument version, and two candidates with defaults would be
-- ambiguous for the API.
create function submit_report(atm uuid, status report_status, device uuid, reason text)
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
  -- A reason only makes sense for "not working".
  if submit_report.reason is not null and submit_report.status <> 'not_working' then
    raise exception 'invalid_input' using errcode = '22023';
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

  insert into reports (atm_id, status, device_id, ip, reason)
  values (atm, submit_report.status, device, caller_ip, submit_report.reason)
  returning created_at into created;

  perform try_confirm(atm, device, caller_ip);
  return created;
end;
$$;

-- History now includes the reason.
drop function atm_history(uuid, integer);
create function atm_history(atm uuid, max_results integer default 20)
returns table (status report_status, reason text, created_at timestamptz)
language sql stable security definer
set search_path = public
as $$
  select status, reason, created_at from reports
  where atm_id = atm
  order by created_at desc
  limit least(max_results, 100);
$$;

grant execute on function
  submit_report(uuid, report_status, uuid, text),
  atm_history(uuid, integer)
to anon, authenticated;
