-- 0054b — PIN GAPS TO TRIPS. The packing list feeds misses into wardrobe_gaps
-- (0054); this links each such gap to the trip that produced it, so trip-gaps can
-- be grouped as their own thing (per-trip cards) and the standing wardrobe audit
-- stays clean. Standing gaps keep trip_id NULL. Additive, no backfill.
alter table z.wardrobe_gaps add column if not exists trip_id uuid;
create index if not exists wardrobe_gaps_trip_idx on z.wardrobe_gaps (trip_id) where trip_id is not null;
