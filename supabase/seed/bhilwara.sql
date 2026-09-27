-- Generated from data/bhilwara-atms.csv on 2026-09-27T08:09:00.409Z
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
