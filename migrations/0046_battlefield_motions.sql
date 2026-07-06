-- ════════════════════════════════════════════════════════════════════════
--  0046_battlefield_motions — the motion BANK. One home for seed + generated
--  + custom motions, tiered (light = amateur/normal, heavy = serious/pro),
--  toggleable active, so the picker and the duel engine read one source.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.battlefield_motions (
  id         uuid primary key default gen_random_uuid(),
  motion     text not null unique,
  domain     text not null,
  tier       text not null default 'heavy' check (tier in ('light','heavy')),
  source     text not null default 'seed'  check (source in ('seed','generated','custom')),
  active     boolean not null default true,
  created_by uuid references z.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists bf_motions_domain on z.battlefield_motions(domain, tier, active);
