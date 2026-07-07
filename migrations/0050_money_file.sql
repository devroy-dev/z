-- ════════════════════════════════════════════════════════════════════════
--  0050_money_file — MONEY TALK: the Money Man's file on the client's money.
--  Single row per user. Free-text by design (currency-agnostic, world launch);
--  the room renders it, the loop injects it every turn. He informs from this
--  file with facts and tradeoffs — the decisions stay the person's, always.
-- ════════════════════════════════════════════════════════════════════════
create table if not exists z.money_file (
  user_id        uuid primary key,
  savings        text,
  invested       text,
  monthly_budget text,
  goals          text,
  holdings       text,
  risk           text,
  notes          text,
  updated_at     timestamptz not null default now()
);
alter table z.money_file enable row level security;
