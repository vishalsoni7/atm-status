-- All-India ATMs: an ATM no longer has to belong to a pilot city.
-- The app finds ATMs by distance from the user, so city is optional metadata.
alter table atms alter column city_id drop not null;
