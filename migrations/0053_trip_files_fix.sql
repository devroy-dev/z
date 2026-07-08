-- [zip73] fix: onConflict needs a plain-column unique index, not a functional one.
-- The lower(destination) expression index can't be targeted by upsert onConflict.
drop index if exists z.trip_files_user_dest_idx;
create unique index if not exists trip_files_user_dest_idx
  on z.trip_files (user_id, destination);
