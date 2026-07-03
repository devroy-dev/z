// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TRADING FLOOR. Paper trading, crypto-first: ₹10,00,000
//  phantom, REAL prices (CoinGecko, 10-min cron), zero real value. The
//  differentiator is the cast: the economist reads your book at the close,
//  the oracle reads the charts daily. Every persona line is generated from
//  REAL portfolio/price numbers passed into the prompt — nothing invented.
//  GAME layer only — no deposits, no withdrawals, no redemption (the
//  economy layer is lawyer-gated and lives elsewhere, later).
// ════════════════════════════════════════════════════════════════════════
import type express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { resolveUser } from './zAccess.js';
import { logUsage } from './usage.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

const istToday = () => {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};
const istYesterday = () => {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000 - 24 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

// ── the floor's fixed list (symbol → CoinGecko id). If an id vanishes from
//    the API response we simply keep the last price and mark it stale —
//    a price is NEVER invented. ─────────────────────────────────────────────
export const COINS: { symbol: string; id: string; name: string }[] = [
  { symbol: 'BTC',  id: 'bitcoin',                  name: 'Bitcoin' },
  { symbol: 'ETH',  id: 'ethereum',                 name: 'Ethereum' },
  { symbol: 'SOL',  id: 'solana',                   name: 'Solana' },
  { symbol: 'BNB',  id: 'binancecoin',              name: 'BNB' },
  { symbol: 'XRP',  id: 'ripple',                   name: 'XRP' },
  { symbol: 'DOGE', id: 'dogecoin',                 name: 'Dogecoin' },
  { symbol: 'ADA',  id: 'cardano',                  name: 'Cardano' },
  { symbol: 'POL',  id: 'polygon-ecosystem-token',  name: 'Polygon' },
  { symbol: 'DOT',  id: 'polkadot',                 name: 'Polkadot' },
  { symbol: 'LINK', id: 'chainlink',                name: 'Chainlink' },
  { symbol: 'AVAX', id: 'avalanche-2',              name: 'Avalanche' },
  { symbol: 'SHIB', id: 'shiba-inu',                name: 'Shiba Inu' },
];

const STALE_AFTER_MIN = 30;

// ── price cron: one call, all ids, INR + 24h change ───────────────────────
export async function refreshPrices(): Promise<{ updated: number; missing: string[] }> {
  const ids = COINS.map((c) => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr&include_24hr_change=true`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`coingecko ${r.status}`);
  const data: any = await r.json();
  let updated = 0;
  const missing: string[] = [];
  const now = new Date().toISOString();
  for (const c of COINS) {
    const row = data?.[c.id];
    const price = Number(row?.inr);
    if (!row || !Number.isFinite(price) || price <= 0) { missing.push(c.symbol); continue; }
    const chg = Number(row.inr_24h_change);
    const { error } = await supabase.from('sim_prices').upsert({
      symbol: c.symbol, coingecko_id: c.id, name: c.name,
      price, changed_24h: Number.isFinite(chg) ? Math.round(chg * 100) / 100 : null,
      updated_at: now,
    });
    if (error) console.error('[sim] price upsert failed', c.symbol, error.message);
    else updated++;
  }
  if (missing.length) console.warn('[sim] no price returned for', missing.join(','), '— keeping last, marked stale');
  return { updated, missing };
}

type PriceRow = { symbol: string; name: string; price: number | null; changed_24h: number | null; updated_at: string | null };

async function priceMap(): Promise<Record<string, PriceRow>> {
  const { data } = await supabase.from('sim_prices').select('symbol, name, price, changed_24h, updated_at');
  const out: Record<string, PriceRow> = {};
  for (const p of (data ?? []) as PriceRow[]) out[p.symbol] = p;
  return out;
}

const isStale = (updatedAt: string | null) =>
  !updatedAt || Date.now() - new Date(updatedAt).getTime() > STALE_AFTER_MIN * 60 * 1000;

// ── market view ───────────────────────────────────────────────────────────
export async function marketView() {
  const prices = await priceMap();
  return COINS.map((c) => {
    const p = prices[c.symbol];
    return {
      symbol: c.symbol, name: c.name,
      price: p?.price ?? null, changed_24h: p?.changed_24h ?? null,
      updated_at: p?.updated_at ?? null, stale: isStale(p?.updated_at ?? null),
    };
  });
}

// ── portfolio view: cash + positions marked to market + day/total P&L ────
export async function portfolioView(userId: string) {
  await supabase.from('sim_portfolios').upsert({ user_id: userId }, { onConflict: 'user_id', ignoreDuplicates: true });
  const [{ data: pf }, { data: pos }, prices] = await Promise.all([
    supabase.from('sim_portfolios').select('cash, created_at').eq('user_id', userId).maybeSingle(),
    supabase.from('sim_positions').select('symbol, qty, avg_cost').eq('user_id', userId),
    priceMap(),
  ]);
  const cash = Number(pf?.cash ?? 1000000);
  const positions = ((pos ?? []) as any[]).map((p) => {
    const price = prices[p.symbol]?.price ?? null;
    const qty = Number(p.qty), avg = Number(p.avg_cost);
    const value = price != null ? qty * price : null;
    const pnl = value != null ? value - qty * avg : null;
    return {
      symbol: p.symbol, name: prices[p.symbol]?.name ?? p.symbol,
      qty, avg_cost: avg, price,
      changed_24h: prices[p.symbol]?.changed_24h ?? null,
      value: value != null ? Math.round(value * 100) / 100 : null,
      pnl: pnl != null ? Math.round(pnl * 100) / 100 : null,
      pnl_pct: pnl != null && avg > 0 ? Math.round((pnl / (qty * avg)) * 10000) / 100 : null,
      stale: isStale(prices[p.symbol]?.updated_at ?? null),
    };
  }).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  const holdings = positions.reduce((s, p) => s + (p.value ?? 0), 0);
  const total = Math.round((cash + holdings) * 100) / 100;
  const totalPnl = Math.round((total - 1000000) * 100) / 100;

  const { data: ysnap } = await supabase.from('sim_close_snapshots')
    .select('total_value').eq('user_id', userId).eq('day', istYesterday()).maybeSingle();
  const dayBase = ysnap ? Number(ysnap.total_value) : 1000000;
  const dayPnl = Math.round((total - dayBase) * 100) / 100;

  return {
    cash: Math.round(cash * 100) / 100, positions,
    total_value: total,
    total_pnl: totalPnl, total_pnl_pct: Math.round((totalPnl / 1000000) * 10000) / 100,
    day_pnl: dayPnl, day_pnl_pct: dayBase > 0 ? Math.round((dayPnl / dayBase) * 10000) / 100 : 0,
  };
}

// ── leaderboard: me + accepted friends, ranked by total value ────────────
export async function leaderboardFor(userId: string) {
  const { data: edges } = await supabase.from('friendships')
    .select('user_lo, user_hi, status')
    .or(`user_lo.eq.${userId},user_hi.eq.${userId}`);
  const friendIds = ((edges ?? []) as any[])
    .filter((e) => e.status === 'accepted')
    .map((e) => (e.user_lo === userId ? e.user_hi : e.user_lo));
  const ids = [...new Set([userId, ...friendIds])];

  const [{ data: pfs }, { data: poss }, prices, { data: users }] = await Promise.all([
    supabase.from('sim_portfolios').select('user_id, cash').in('user_id', ids),
    supabase.from('sim_positions').select('user_id, symbol, qty').in('user_id', ids),
    priceMap(),
    supabase.from('users').select('id, handle, display_name').in('id', ids),
  ]);
  const byUser: Record<string, { cash: number; holdings: number }> = {};
  for (const p of (pfs ?? []) as any[]) byUser[p.user_id] = { cash: Number(p.cash), holdings: 0 };
  for (const p of (poss ?? []) as any[]) {
    const price = prices[p.symbol]?.price;
    if (byUser[p.user_id] && price != null) byUser[p.user_id].holdings += Number(p.qty) * price;
  }
  const nameOf: Record<string, any> = {};
  for (const u of (users ?? []) as any[]) nameOf[u.id] = u;

  return Object.entries(byUser)
    .map(([id, v]) => ({
      user_id: id,
      handle: nameOf[id]?.handle ?? null,
      display_name: nameOf[id]?.display_name ?? null,
      you: id === userId,
      total_value: Math.round((v.cash + v.holdings) * 100) / 100,
      total_pnl_pct: Math.round(((v.cash + v.holdings - 1000000) / 1000000) * 10000) / 100,
    }))
    .sort((a, b) => b.total_value - a.total_value)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ── the economist: one dry line, real numbers only ────────────────────────
const ECONOMIST_SYS = `You are THE ECONOMIST of the Z house — clear-eyed, dry, a little wry, never a finance bro. You are reacting to a friend's PAPER-TRADING book (phantom money, real prices — a practice game). Write EXACTLY ONE line, under 30 words, lowercase-casual, personal and specific. Use ONLY the numbers given to you — never invent a number, price, or event. No emojis, no hashtags, no advice-disclaimers, no markdown.`;

async function economistLine(userId: string, context: string, fallback: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 100, system: ECONOMIST_SYS,
      messages: [{ role: 'user', content: context }],
    });
    logUsage({ userId, personaKey: 'the_economist', surface: 'other', model: MODEL, usage: (msg as any).usage });
    const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    return text ? text.slice(0, 240) : fallback;
  } catch (e: any) {
    console.error('[sim] economist line failed:', e?.message || e);
    return fallback;
  }
}

// broker's remark right after a trade — client calls POST /sim/remark
export async function brokerRemark(userId: string): Promise<string | null> {
  const { data: t } = await supabase.from('sim_trades')
    .select('symbol, side, qty, price, at').eq('user_id', userId)
    .order('at', { ascending: false }).limit(1).maybeSingle();
  if (!t) return null;
  const view = await portfolioView(userId);
  const pos = view.positions.find((p) => p.symbol === (t as any).symbol);
  const ctx = [
    `their trade just now: ${(t as any).side} ${(t as any).qty} ${(t as any).symbol} at ₹${(t as any).price}`,
    pos ? `their ${pos.symbol} position after: ${pos.qty} units, avg cost ₹${pos.avg_cost}, current P&L ${pos.pnl_pct ?? 0}%` : `they now hold no ${(t as any).symbol}`,
    `book: cash ₹${view.cash}, total value ₹${view.total_value}, overall ${view.total_pnl_pct}%`,
    `react to the trade in one line.`,
  ].join('\n');
  return economistLine(userId, ctx, `${(t as any).side} ${(t as any).symbol} noted. the book stands at ₹${view.total_value}.`);
}

// ── the oracle: theatrical daily chart reading (cached per IST day) ───────
const ORACLE_SYS = `You are THE ORACLE of the Z house reading today's crypto charts — theatrical, mystical, clearly entertainment (this is a paper-trading game). 3-4 short sentences. Weave in ONLY the real numbers given; never invent a price, coin, or event. Prophesy in vibes, not financial advice. No markdown, no emojis.`;

export async function oracleReading(): Promise<string | null> {
  const day = istToday();
  const { data: hit } = await supabase.from('sim_oracle').select('body').eq('day', day).maybeSingle();
  if (hit?.body) return hit.body;
  const market = await marketView();
  const live = market.filter((m) => m.price != null);
  if (!live.length) return null;
  const ctx = `today's board (INR, 24h change): ` + live.map((m) => `${m.symbol} ₹${m.price} (${m.changed_24h ?? 0}%)`).join(', ') + `. give today's reading of the charts.`;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 220, system: ORACLE_SYS,
      messages: [{ role: 'user', content: ctx }],
    });
    logUsage({ userId: 'sim-oracle', personaKey: 'the_oracle', surface: 'other', model: MODEL, usage: (msg as any).usage });
    const body = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim().slice(0, 800);
    if (!body) return null;
    await supabase.from('sim_oracle').insert({ day, body });
    return body;
  } catch (e: any) {
    console.error('[sim] oracle failed:', e?.message || e);
    return null;
  }
}

// ── the daily close (23:00 IST): snapshot every book, ping active players
//    through the existing ping infra in the economist's voice ──────────────
export async function runDailyClose(onlyUserId?: string): Promise<{ snapped: number; pinged: number }> {
  const day = istToday();
  let q = supabase.from('sim_portfolios').select('user_id');
  if (onlyUserId) q = q.eq('user_id', onlyUserId);
  const { data: pfs } = await q;
  let snapped = 0, pinged = 0;
  for (const pf of (pfs ?? []) as any[]) {
    const uid = pf.user_id as string;
    try {
      // idempotence: one close per user per IST day
      const { data: already } = await supabase.from('sim_close_snapshots')
        .select('user_id').eq('user_id', uid).eq('day', day).maybeSingle();
      if (already && !onlyUserId) continue;

      const view = await portfolioView(uid);
      await supabase.from('sim_close_snapshots').upsert({ user_id: uid, day, total_value: view.total_value });
      snapped++;

      // ping only players who actually play: holding something, or traded today
      const { data: todayTrades } = await supabase.from('sim_trades')
        .select('id').eq('user_id', uid).gte('at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).limit(1);
      if (!view.positions.length && !(todayTrades ?? []).length) continue;

      const best = [...view.positions].sort((a, b) => (b.pnl_pct ?? -1e9) - (a.pnl_pct ?? -1e9))[0];
      const worst = [...view.positions].sort((a, b) => (a.pnl_pct ?? 1e9) - (b.pnl_pct ?? 1e9))[0];
      const ctx = [
        `the day has closed on their paper book.`,
        `closed the day at ₹${view.total_value} (day: ${view.day_pnl >= 0 ? '+' : ''}${view.day_pnl_pct}%, overall: ${view.total_pnl >= 0 ? '+' : ''}${view.total_pnl_pct}%), cash ₹${view.cash}`,
        best ? `best position: ${best.symbol} at ${best.pnl_pct ?? 0}%` : '',
        worst && worst !== best ? `worst position: ${worst.symbol} at ${worst.pnl_pct ?? 0}%` : '',
        `write the one-line closing bell note.`,
      ].filter(Boolean).join('\n');
      const fallback = `your book closed ${view.day_pnl >= 0 ? '+' : ''}${view.day_pnl_pct}% today — ₹${view.total_value} on the ledger.`;
      const body = await economistLine(uid, ctx, fallback);

      await supabase.from('scheduled_pings').insert({
        user_id: uid, persona_key: 'the_economist', kind: 'sim_close',
        body, due_at: new Date().toISOString(),
      });
      pinged++;
    } catch (e: any) { console.error('[sim] close failed for', uid, e?.message || e); }
  }
  return { snapped, pinged };
}

// ── schedulers: prices every 10 min (+ on boot), close at 23 IST ──────────
export function startSimScheduler() {
  const priceTick = async () => {
    try { const r = await refreshPrices(); console.log('[sim] prices updated:', r.updated, r.missing.length ? `missing: ${r.missing.join(',')}` : ''); }
    catch (e: any) { console.error('[sim] price refresh failed (keeping last):', e?.message || e); }
  };
  priceTick();
  setInterval(priceTick, 10 * 60 * 1000);

  const RUN_HOUR_IST = 23;
  const closeTick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour !== RUN_HOUR_IST) return;
    try { const r = await runDailyClose(); if (r.snapped) console.log('[sim] close:', r); }
    catch (e: any) { console.error('[sim] daily close failed:', e?.message || e); }
  };
  setInterval(closeTick, 55 * 60 * 1000);
  console.log('[sim] floor open — prices every 10 min, close at', RUN_HOUR_IST, 'IST');
}

// ── routes ────────────────────────────────────────────────────────────────
export function installSimRoutes(app: express.Express, authUser: (req: express.Request) => Promise<string | null>) {
  const guard = async (req: express.Request, res: express.Response): Promise<string | null> => {
    const authId = await authUser(req);
    if (!authId) { res.status(401).json({ error: 'unauthorized' }); return null; }
    const user = await resolveUser(authId);
    return user.id;
  };

  app.get('/sim/market', async (req, res) => {
    try {
      if (!(await guard(req, res))) return;
      res.json({ coins: await marketView(), disclaimer: 'phantom money · real prices · zero real value' });
    } catch (e: any) { res.status(500).json({ error: 'market failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/sim/portfolio', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json(await portfolioView(uid));
    } catch (e: any) { res.status(500).json({ error: 'portfolio failed: ' + (e?.message || String(e)) }); }
  });

  app.post('/sim/trade', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      const symbol = String((req.body ?? {}).symbol || '').toUpperCase().trim();
      const side = String((req.body ?? {}).side || '').toLowerCase().trim();
      const qty = Number((req.body ?? {}).qty);
      if (!COINS.some((c) => c.symbol === symbol)) return res.status(400).json({ error: 'unknown symbol' });
      if (side !== 'buy' && side !== 'sell') return res.status(400).json({ error: 'side must be buy or sell' });
      if (!Number.isFinite(qty) || qty <= 0) return res.status(400).json({ error: 'qty must be a positive number' });
      const { data, error } = await supabase.rpc('sim_trade', { p_user: uid, p_symbol: symbol, p_side: side, p_qty: qty });
      if (error) return res.status(400).json({ error: error.message });
      res.json({ trade: data });
    } catch (e: any) { res.status(500).json({ error: 'trade failed: ' + (e?.message || String(e)) }); }
  });

  app.post('/sim/remark', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      const line = await brokerRemark(uid);
      if (!line) return res.status(404).json({ error: 'no trades yet' });
      res.json({ persona: 'the_economist', line });
    } catch (e: any) { res.status(500).json({ error: 'remark failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/sim/leaderboard', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json({ board: await leaderboardFor(uid) });
    } catch (e: any) { res.status(500).json({ error: 'leaderboard failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/sim/oracle', async (req, res) => {
    try {
      if (!(await guard(req, res))) return;
      const body = await oracleReading();
      if (!body) return res.status(503).json({ error: 'the oracle has no reading yet (no prices)' });
      res.json({ persona: 'the_oracle', body, day: istToday() });
    } catch (e: any) { res.status(500).json({ error: 'oracle failed: ' + (e?.message || String(e)) }); }
  });

  // dev triggers (curl-verifiable, like /dev/morning-brief)
  app.post('/dev/sim-prices', async (_req, res) => {
    try { res.json(await refreshPrices()); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
  app.post('/dev/sim-close', async (req, res) => {
    try { res.json(await runDailyClose(req.body?.userId || undefined)); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
}
