-- 0054 — THE STYLIST ACTS: outfits are filed work product, gaps are a stored
-- report, wear is tracked. The wardrobe stops being a photo album.
create table if not exists z.outfits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  name        text not null,
  piece_ids   uuid[] not null default '{}',
  occasion    text,
  her_read    text,
  wear_date   date,
  created_at  timestamptz not null default now()
);
create index if not exists outfits_user_idx on z.outfits (user_id, created_at desc);
alter table z.outfits enable row level security;

create table if not exists z.wardrobe_gaps (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  what        text not null,
  why         text,
  priority    int not null default 3,
  shop_cards  jsonb,
  status      text not null default 'open',   -- open | bought | dismissed
  created_at  timestamptz not null default now()
);
create index if not exists wardrobe_gaps_user_idx on z.wardrobe_gaps (user_id, status, priority);
alter table z.wardrobe_gaps enable row level security;

alter table z.wardrobe_pieces add column if not exists wear_count int not null default 0;
alter table z.wardrobe_pieces add column if not exists last_worn timestamptz;
