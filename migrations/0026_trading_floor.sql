-- 0026: THE TRADING FLOOR — paper trading, crypto-first. Phantom ₹10,00,000,
-- real (delayed-ok) prices, zero real value. GAME layer only: no deposits, no
-- withdrawals, no redemption (per OPUS_BUILD_SIM_GAMES.md split — economy is
-- lawyer-gated and NOT here).
--
-- Design notes:
--   • user_id is uuid → z.users(id), following the 0024 type ruling (core is uuid).
--   • Trades execute inside z.sim_trade() — a single plpgsql function that locks
--     the portfolio row, validates against the SERVER price, and moves cash +
--     position atomically. The engine calls it via rpc; there is no path where
--     cash and position can diverge.
--   • RLS enabled everywhere; owner-read policies use the auth.uid()::text cast
--     (auth_user_id is TEXT — the 0002 lesson, restated in 0024).
--   • sim_close_snapshots gives the daily-close ping its "closed +2.1%" number:
--     day P&L = today's total vs yesterday's snapshot.

-- ── prices (server-owned; a cron upserts, nobody else writes) ─────────────
create table if not exists z.sim_prices (
  symbol        text primary key,            -- 'BTC', 'ETH', ...
  coingecko_id  text not null,               -- 'bitcoin', 'ethereum', ...
  name          text not null,
  price         numeric,                     -- INR; null until first fetch
  changed_24h   numeric,                     -- percent
  updated_at    timestamptz                  -- null/old ⇒ stale, never invented
);

-- ── portfolios: one row per player, phantom cash ──────────────────────────
create table if not exists z.sim_portfolios (
  user_id     uuid primary key references z.users(id) on delete cascade,
  cash        numeric not null default 1000000,   -- ₹10,00,000 phantom
  created_at  timestamptz not null default now()
);

-- ── positions: one row per (user, symbol) ─────────────────────────────────
create table if not exists z.sim_positions (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references z.users(id) on delete cascade,
  symbol    text not null references z.sim_prices(symbol),
  qty       numeric not null check (qty > 0),
  avg_cost  numeric not null check (avg_cost >= 0),
  unique (user_id, symbol)
);
create index if not exists sim_positions_user_idx on z.sim_positions (user_id);

-- ── trade ledger ──────────────────────────────────────────────────────────
create table if not exists z.sim_trades (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references z.users(id) on delete cascade,
  symbol   text not null,
  side     text not null check (side in ('buy','sell')),
  qty      numeric not null check (qty > 0),
  price    numeric not null,                 -- server price at execution
  at       timestamptz not null default now()
);
create index if not exists sim_trades_user_idx on z.sim_trades (user_id, at desc);

-- ── daily close snapshots (IST day) ───────────────────────────────────────
create table if not exists z.sim_close_snapshots (
  user_id      uuid not null references z.users(id) on delete cascade,
  day          date not null,
  total_value  numeric not null,
  primary key (user_id, day)
);

-- ── the oracle's daily chart reading (cached like bulletins) ──────────────
create table if not exists z.sim_oracle (
  day   date primary key,
  body  text not null
);

-- ── RLS: engine (service role) bypasses; owners may read their own ────────
alter table z.sim_prices          enable row level security;
alter table z.sim_portfolios      enable row level security;
alter table z.sim_positions       enable row level security;
alter table z.sim_trades          enable row level security;
alter table z.sim_close_snapshots enable row level security;
alter table z.sim_oracle          enable row level security;

do $$ begin
  create policy sim_prices_read on z.sim_prices for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy sim_portfolios_owner on z.sim_portfolios for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy sim_positions_owner on z.sim_positions for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy sim_trades_owner on z.sim_trades for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy sim_snapshots_owner on z.sim_close_snapshots for select
    using (user_id = (select id from z.users where auth_user_id = auth.uid()::text));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy sim_oracle_read on z.sim_oracle for select using (true);
exception when duplicate_object then null; end $$;

-- ── the atomic trade ──────────────────────────────────────────────────────
-- Locks the portfolio row, validates against the price the SERVER holds
-- (never a client price), moves cash and position in one transaction,
-- writes the ledger row, returns the executed trade + fresh cash.
create or replace function z.sim_trade(p_user uuid, p_symbol text, p_side text, p_qty numeric)
returns jsonb
language plpgsql
security definer
set search_path = z
as $$
declare
  v_price   numeric;
  v_updated timestamptz;
  v_cash    numeric;
  v_pos     z.sim_positions%rowtype;
  v_cost    numeric;
  v_trade   uuid;
begin
  if p_side not in ('buy','sell') then
    raise exception 'side must be buy or sell';
  end if;
  if p_qty is null or p_qty <= 0 or p_qty > 1e15 then
    raise exception 'qty must be a positive number';
  end if;

  select price, updated_at into v_price, v_updated
    from z.sim_prices where symbol = p_symbol;
  if not found or v_price is null then
    raise exception 'no price for %', p_symbol;
  end if;

  -- portfolio exists + lock it for the whole trade
  insert into z.sim_portfolios (user_id) values (p_user)
    on conflict (user_id) do nothing;
  select cash into v_cash from z.sim_portfolios
    where user_id = p_user for update;

  v_cost := round(p_qty * v_price, 2);
  if v_cost < 1 then
    raise exception 'trade too small (under ₹1)';
  end if;

  if p_side = 'buy' then
    if v_cost > v_cash then
      raise exception 'not enough cash: need ₹%, have ₹%', v_cost, round(v_cash, 2);
    end if;
    update z.sim_portfolios set cash = cash - v_cost where user_id = p_user;
    insert into z.sim_positions (user_id, symbol, qty, avg_cost)
      values (p_user, p_symbol, p_qty, v_price)
      on conflict (user_id, symbol) do update
        set avg_cost = round(
              (z.sim_positions.avg_cost * z.sim_positions.qty + excluded.qty * excluded.avg_cost)
              / (z.sim_positions.qty + excluded.qty), 8),
            qty = z.sim_positions.qty + excluded.qty;
  else
    select * into v_pos from z.sim_positions
      where user_id = p_user and symbol = p_symbol for update;
    if not found or v_pos.qty < p_qty then
      raise exception 'not enough % to sell', p_symbol;
    end if;
    update z.sim_portfolios set cash = cash + v_cost where user_id = p_user;
    if v_pos.qty - p_qty <= 1e-9 then
      delete from z.sim_positions where id = v_pos.id;
    else
      update z.sim_positions set qty = qty - p_qty where id = v_pos.id;
    end if;
  end if;

  insert into z.sim_trades (user_id, symbol, side, qty, price)
    values (p_user, p_symbol, p_side, p_qty, v_price)
    returning id into v_trade;

  select cash into v_cash from z.sim_portfolios where user_id = p_user;

  return jsonb_build_object(
    'id', v_trade, 'symbol', p_symbol, 'side', p_side,
    'qty', p_qty, 'price', v_price, 'cost', v_cost,
    'cash', round(v_cash, 2),
    'price_age_sec', floor(extract(epoch from (now() - v_updated)))
  );
end
$$;

revoke all on function z.sim_trade(uuid, text, text, numeric) from public;
grant execute on function z.sim_trade(uuid, text, text, numeric) to service_role;
