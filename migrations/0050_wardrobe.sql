-- ════════════════════════════════════════════════════════════════════════
--  0050_wardrobe — THE STYLIST'S WARDROBE: the pieces the client owns, each
--  filed with her read of it. Photos live in the private 'wardrobe' storage
--  bucket (engine-created on first upload, coach-ingest pattern); this table
--  is the index her counsel compounds on. One row per piece.
--  (Numbering note: 0050 previously carried money_file, retired with zip54h;
--   this file is its successor on the ladder. drop table if exists z.money_file;
--   remains optional cleanup.)
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.wardrobe_pieces (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  storage_path text not null,
  kind         text,
  colors       text,
  tags         text,
  her_read     text,
  created_at   timestamptz not null default now()
);
create index if not exists wardrobe_pieces_user_idx on z.wardrobe_pieces (user_id, created_at desc);
alter table z.wardrobe_pieces enable row level security;
