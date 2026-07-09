-- 0055 — THE TRIP GROWS A BODY AND A CLOCK: states, parsed dates, itinerary,
-- checklist, saved finds. Additive: the [[TRIP]] pipeline keeps writing the
-- original four columns untouched.
alter table z.trip_files add column if not exists status text not null default 'dreaming';
alter table z.trip_files add column if not exists start_date date;
alter table z.trip_files add column if not exists end_date date;
alter table z.trip_files add column if not exists itinerary jsonb;
alter table z.trip_files add column if not exists checklist jsonb;
alter table z.trip_files add column if not exists budget text;
alter table z.trip_files add column if not exists shop_cards jsonb;
create index if not exists trip_files_clock_idx on z.trip_files (user_id, start_date) where start_date is not null;
