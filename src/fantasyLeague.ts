// ════════════════════════════════════════════════════════════════════════
//  yourZ — FANTASY FOOTBALL. The house league on REAL EPL data via the FPL
//  public API (free, keyless): player pool, gameweek deadlines, and per-
//  player gameweek points — professionally computed, never invented by us.
//  Rules of the house league: pick 5 + a captain (2x) under a 40.0 budget,
//  ≤1 GK, ≤2 from one club, locked at the FPL deadline. Your latest squad
//  rolls forward until you change it. The wannabe hustler runs the trash
//  talk when a gameweek closes. Phantom stakes only — zero real value.
//
//  Off-season honesty: between seasons the FPL API may serve a skeleton or
//  503 during rollover. Sync keeps the last good data and /ff/status says
//  exactly what state the season is in — the league never pretends.
// ════════════════════════════════════════════════════════════════════════
import type express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { resolveUser } from './zAccess.js';
import { logUsage } from './usage.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

const FPL = 'https://fantasy.premierleague.com/api';
const POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

// house league rules (deterministic; server is law)
const SQUAD_SIZE = 5;
const BUDGET = 40.0;
const MAX_GK = 1;
const MAX_PER_TEAM = 2;

async function fplGet(path: string): Promise<any> {
  const r = await fetch(`${FPL}${path}`, {
    signal: AbortSignal.timeout(15000),
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (yourZ house league)' },
  });
  if (!r.ok) throw new Error(`fpl ${path} → ${r.status}`);
  return r.json();
}

// ── sync: bootstrap → players + gameweeks (keep last on any failure) ──────
export async function syncFpl(): Promise<{ players: number; gameweeks: number }> {
  const boot = await fplGet('/bootstrap-static/');
  const teams: Record<number, string> = {};
  for (const t of boot.teams ?? []) teams[t.id] = t.short_name;

  let players = 0;
  const rows = (boot.elements ?? []).map((e: any) => ({
    id: e.id,
    name: String(e.web_name || '').slice(0, 60),
    full_name: `${e.first_name || ''} ${e.second_name || ''}`.trim().slice(0, 120),
    team: teams[e.team] || String(e.team),
    pos: POS[e.element_type] || 'MID',
    cost: Number(e.now_cost) / 10,
    total_points: Number(e.total_points) || 0,
    status: e.status || null,
    news: e.news ? String(e.news).slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  }));
  // chunked upserts — the pool is ~700 rows
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('ff_players').upsert(rows.slice(i, i + 200));
    if (error) throw new Error('ff_players upsert: ' + error.message);
    players += Math.min(200, rows.length - i);
  }

  let gameweeks = 0;
  for (const ev of boot.events ?? []) {
    const { error } = await supabase.from('ff_gameweeks').upsert({
      gw: ev.id, deadline: ev.deadline_time, finished: !!ev.finished,
      is_current: !!ev.is_current, updated_at: new Date().toISOString(),
    });
    if (!error) gameweeks++;
  }
  return { players, gameweeks };
}

// ── season status: the honest header ──────────────────────────────────────
export async function ffStatus() {
  const now = new Date().toISOString();
  const [{ data: cur }, { data: next }, { count }] = await Promise.all([
    supabase.from('ff_gameweeks').select('gw, deadline, finished').eq('is_current', true).maybeSingle(),
    supabase.from('ff_gameweeks').select('gw, deadline').gt('deadline', now).order('deadline', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('ff_players').select('id', { count: 'exact', head: true }),
  ]);
  const { data: lastSync } = await supabase.from('ff_players').select('updated_at').order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return {
    season_live: !!cur && !(cur as any).finished,
    current_gw: cur ? (cur as any).gw : null,
    next_gw: next ? (next as any).gw : null,
    next_deadline: next ? (next as any).deadline : null,
    players_synced: count ?? 0,
    last_sync: lastSync ? (lastSync as any).updated_at : null,
    rules: { size: SQUAD_SIZE, budget: BUDGET, max_gk: MAX_GK, max_per_team: MAX_PER_TEAM, captain: '2x' },
  };
}

// the gameweek a new squad write targets: the next one whose deadline hasn't passed
async function openGw(): Promise<{ gw: number; deadline: string } | null> {
  const { data } = await supabase.from('ff_gameweeks')
    .select('gw, deadline').gt('deadline', new Date().toISOString())
    .order('deadline', { ascending: true }).limit(1).maybeSingle();
  return data ? { gw: (data as any).gw, deadline: (data as any).deadline } : null;
}

// effective squad for a gw = most recent squad row with gw' <= gw
async function effectiveSquad(userId: string, gw: number) {
  const { data } = await supabase.from('ff_squads')
    .select('gw, player_ids, captain').eq('user_id', userId).lte('gw', gw)
    .order('gw', { ascending: false }).limit(1).maybeSingle();
  return data as { gw: number; player_ids: number[]; captain: number } | null;
}

async function playersById(ids: number[]) {
  if (!ids.length) return {} as Record<number, any>;
  const { data } = await supabase.from('ff_players').select('id, name, team, pos, cost, total_points, status, news').in('id', ids);
  const out: Record<number, any> = {};
  for (const p of (data ?? []) as any[]) out[p.id] = p;
  return out;
}

// ── squad validation: every rule enforced here, nothing client-side ───────
export async function saveSquad(userId: string, playerIds: number[], captain: number) {
  const open = await openGw();
  if (!open) throw new Error('no open gameweek — the season has not opened for entries yet');
  const ids = [...new Set(playerIds.map(Number))];
  if (ids.length !== SQUAD_SIZE) throw new Error(`pick exactly ${SQUAD_SIZE} different players`);
  if (!ids.includes(Number(captain))) throw new Error('your captain must be in the squad');
  const pool = await playersById(ids);
  if (Object.keys(pool).length !== SQUAD_SIZE) throw new Error('a player in that squad does not exist in the pool');
  const cost = ids.reduce((s, id) => s + Number(pool[id].cost), 0);
  if (cost > BUDGET + 1e-9) throw new Error(`over budget: ${cost.toFixed(1)} of ${BUDGET.toFixed(1)}`);
  const gks = ids.filter((id) => pool[id].pos === 'GK').length;
  if (gks > MAX_GK) throw new Error(`at most ${MAX_GK} goalkeeper`);
  const perTeam: Record<string, number> = {};
  for (const id of ids) {
    perTeam[pool[id].team] = (perTeam[pool[id].team] || 0) + 1;
    if (perTeam[pool[id].team] > MAX_PER_TEAM) throw new Error(`at most ${MAX_PER_TEAM} players from ${pool[id].team}`);
  }
  const { error } = await supabase.from('ff_squads').upsert({
    user_id: userId, gw: open.gw, player_ids: ids, captain: Number(captain), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('squad save: ' + error.message);
  return { gw: open.gw, deadline: open.deadline, cost: Math.round(cost * 10) / 10 };
}

export async function squadView(userId: string) {
  const open = await openGw();
  const targetGw = open?.gw ?? (await lastKnownGw());
  if (!targetGw) return { gw: null, squad: null, open: false };
  const sq = await effectiveSquad(userId, targetGw);
  if (!sq) return { gw: targetGw, deadline: open?.deadline ?? null, open: !!open, squad: null };
  const pool = await playersById(sq.player_ids);
  const players = sq.player_ids.map((id) => ({ ...(pool[id] || { id, name: '?', team: '?', pos: '?', cost: 0 }), captain: id === sq.captain }));
  const cost = players.reduce((s, p) => s + Number(p.cost || 0), 0);
  return {
    gw: targetGw, deadline: open?.deadline ?? null, open: !!open,
    saved_for_gw: sq.gw, rolled_forward: sq.gw !== targetGw,
    squad: { players, captain: sq.captain, cost: Math.round(cost * 10) / 10, budget: BUDGET },
  };
}

async function lastKnownGw(): Promise<number | null> {
  const { data } = await supabase.from('ff_gameweeks').select('gw').order('gw', { ascending: false }).limit(1).maybeSingle();
  return data ? (data as any).gw : null;
}

// ── live points for a gw (60s in-memory cache — be kind to FPL) ───────────
const liveCache: Record<number, { at: number; pts: Record<number, number> }> = {};
async function livePoints(gw: number): Promise<Record<number, number>> {
  const hit = liveCache[gw];
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.pts;
  const j = await fplGet(`/event/${gw}/live/`);
  const pts: Record<number, number> = {};
  for (const el of j.elements ?? []) pts[el.id] = Number(el?.stats?.total_points) || 0;
  liveCache[gw] = { at: Date.now(), pts };
  return pts;
}

export async function myLive(userId: string) {
  const { data: cur } = await supabase.from('ff_gameweeks').select('gw, finished').eq('is_current', true).maybeSingle();
  if (!cur) return { gw: null, points: null, players: [] };
  const gw = (cur as any).gw;
  const sq = await effectiveSquad(userId, gw);
  if (!sq) return { gw, points: null, players: [] };
  const [pts, pool] = await Promise.all([livePoints(gw), playersById(sq.player_ids)]);
  const players = sq.player_ids.map((id) => {
    const cap = id === sq.captain;
    const p = pts[id] || 0;
    return { id, name: pool[id]?.name || '?', team: pool[id]?.team || '?', pos: pool[id]?.pos || '?', points: p, captain: cap, counted: cap ? p * 2 : p };
  });
  return { gw, finished: !!(cur as any).finished, points: players.reduce((s, p) => s + p.counted, 0), players };
}

// ── the hustler's gameweek trash talk (real numbers only) ─────────────────
const HUSTLER_SYS = `You are THE WANNABE HUSTLER of the Z house — all hype, all trash talk, secretly loves his friends. A fantasy football gameweek just closed in the house league (phantom stakes, real EPL points — a game between friends). Write EXACTLY ONE line, under 30 words, lowercase-casual, cocky and funny, personal. Use ONLY the numbers and names given — never invent a player, score, or event. No emojis, no hashtags, no markdown.`;

async function hustlerLine(userId: string, ctx: string, fallback: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 100, system: HUSTLER_SYS,
      messages: [{ role: 'user', content: ctx }],
    });
    logUsage({ userId, personaKey: 'the_wannabe', surface: 'other', model: MODEL, usage: (msg as any).usage });
    const t = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    return t ? t.slice(0, 240) : fallback;
  } catch (e: any) {
    console.error('[ff] hustler line failed:', e?.message || e);
    return fallback;
  }
}

// ── finalize: score every finished-but-unscored gw, ping the players ──────
export async function finalizeGameweeks(): Promise<{ scored_gws: number; users: number }> {
  const { data: due } = await supabase.from('ff_gameweeks')
    .select('gw').eq('finished', true).eq('scored', false).order('gw', { ascending: true });
  let scoredGws = 0, users = 0;
  for (const row of (due ?? []) as any[]) {
    const gw = row.gw;
    try {
      const pts = await livePoints(gw);
      // everyone with an effective squad at this gw = anyone with a squad row gw' <= gw
      const { data: squadUsers } = await supabase.from('ff_squads')
        .select('user_id').lte('gw', gw);
      const uids = [...new Set(((squadUsers ?? []) as any[]).map((s) => s.user_id))];
      for (const uid of uids) {
        const sq = await effectiveSquad(uid, gw);
        if (!sq) continue;
        const pool = await playersById(sq.player_ids);
        const breakdown = sq.player_ids.map((id) => {
          const cap = id === sq.captain;
          const p = pts[id] || 0;
          return { id, name: pool[id]?.name || '?', points: cap ? p * 2 : p, captain: cap };
        });
        const total = breakdown.reduce((s, b) => s + b.points, 0);
        const { error } = await supabase.from('ff_scores').upsert({ user_id: uid, gw, points: total, breakdown });
        if (error) { console.error('[ff] score write failed', uid, gw, error.message); continue; }
        users++;

        const best = [...breakdown].sort((a, b) => b.points - a.points)[0];
        const worst = [...breakdown].sort((a, b) => a.points - b.points)[0];
        const ctx = [
          `gameweek ${gw} closed. their squad scored ${total} points.`,
          best ? `their best: ${best.name} with ${best.points}${best.captain ? ' (captain, doubled)' : ''}` : '',
          worst && worst !== best ? `their flop: ${worst.name} with ${worst.points}` : '',
          `talk your trash.`,
        ].filter(Boolean).join('\n');
        const fallback = `gameweek ${gw} closed — ${total} points on your squad. the board remembers everything.`;
        const body = await hustlerLine(uid, ctx, fallback);
        await supabase.from('scheduled_pings').insert({
          user_id: uid, persona_key: 'the_wannabe', kind: 'ff_gameweek',
          body, due_at: new Date().toISOString(),
        });
      }
      await supabase.from('ff_gameweeks').update({ scored: true, updated_at: new Date().toISOString() }).eq('gw', gw);
      scoredGws++;
    } catch (e: any) { console.error('[ff] finalize gw', gw, 'failed:', e?.message || e); }
  }
  return { scored_gws: scoredGws, users };
}

// ── leaderboard: me + accepted friends, season totals + last gw ───────────
export async function ffLeaderboard(userId: string) {
  const { data: edges } = await supabase.from('friendships')
    .select('user_lo, user_hi, status').or(`user_lo.eq.${userId},user_hi.eq.${userId}`);
  const friendIds = ((edges ?? []) as any[])
    .filter((e) => e.status === 'accepted')
    .map((e) => (e.user_lo === userId ? e.user_hi : e.user_lo));
  const ids = [...new Set([userId, ...friendIds])];

  const [{ data: scores }, { data: usersRows }] = await Promise.all([
    supabase.from('ff_scores').select('user_id, gw, points').in('user_id', ids),
    supabase.from('users').select('id, handle, display_name').in('id', ids),
  ]);
  const nameOf: Record<string, any> = {};
  for (const u of (usersRows ?? []) as any[]) nameOf[u.id] = u;
  const agg: Record<string, { total: number; lastGw: number; lastPts: number }> = {};
  for (const id of ids) agg[id] = { total: 0, lastGw: 0, lastPts: 0 };
  for (const s of (scores ?? []) as any[]) {
    agg[s.user_id].total += s.points;
    if (s.gw > agg[s.user_id].lastGw) { agg[s.user_id].lastGw = s.gw; agg[s.user_id].lastPts = s.points; }
  }
  return Object.entries(agg)
    .map(([id, a]) => ({
      user_id: id, handle: nameOf[id]?.handle ?? null, display_name: nameOf[id]?.display_name ?? null,
      you: id === userId, total: a.total, last_gw: a.lastGw || null, last_points: a.lastGw ? a.lastPts : null,
    }))
    .sort((a, b) => b.total - a.total)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

// ── schedulers: sync every 6h (+ boot), finalize hourly ───────────────────
export function startFfScheduler() {
  const sync = async () => {
    try { const r = await syncFpl(); console.log('[ff] synced', r.players, 'players,', r.gameweeks, 'gameweeks'); }
    catch (e: any) { console.error('[ff] sync failed (keeping last):', e?.message || e); }
  };
  sync();
  setInterval(sync, 6 * 60 * 60 * 1000);
  setInterval(async () => {
    try { const r = await finalizeGameweeks(); if (r.scored_gws) console.log('[ff] finalized', r); }
    catch (e: any) { console.error('[ff] finalize sweep failed:', e?.message || e); }
  }, 60 * 60 * 1000);
  console.log('[ff] house league open — sync 6h, finalize hourly');
}

// ── routes ────────────────────────────────────────────────────────────────
export function installFfRoutes(app: express.Express, authUser: (req: express.Request) => Promise<string | null>) {
  const guard = async (req: express.Request, res: express.Response): Promise<string | null> => {
    const authId = await authUser(req);
    if (!authId) { res.status(401).json({ error: 'unauthorized' }); return null; }
    const user = await resolveUser(authId);
    return user.id;
  };

  app.get('/ff/status', async (req, res) => {
    try { if (!(await guard(req, res))) return; res.json(await ffStatus()); }
    catch (e: any) { res.status(500).json({ error: 'status failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/players', async (req, res) => {
    try {
      if (!(await guard(req, res))) return;
      const q = String(req.query.q || '').trim().toLowerCase();
      const pos = String(req.query.pos || '').trim().toUpperCase();
      let sel = supabase.from('ff_players').select('id, name, team, pos, cost, total_points, status, news')
        .order('total_points', { ascending: false }).limit(60);
      if (pos && ['GK', 'DEF', 'MID', 'FWD'].includes(pos)) sel = sel.eq('pos', pos);
      if (q) sel = sel.ilike('name', `%${q}%`);
      const { data, error } = await sel;
      if (error) return res.status(500).json({ error: error.message });
      res.json({ players: data ?? [] });
    } catch (e: any) { res.status(500).json({ error: 'players failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/squad', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json(await squadView(uid));
    } catch (e: any) { res.status(500).json({ error: 'squad failed: ' + (e?.message || String(e)) }); }
  });

  app.post('/ff/squad', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      const playerIds = Array.isArray((req.body ?? {}).playerIds) ? (req.body.playerIds as any[]).map(Number) : [];
      const captain = Number((req.body ?? {}).captain);
      const r = await saveSquad(uid, playerIds, captain);
      res.json(r);
    } catch (e: any) { res.status(400).json({ error: e?.message || String(e) }); }
  });

  app.get('/ff/live', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json(await myLive(uid));
    } catch (e: any) { res.status(500).json({ error: 'live failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/leaderboard', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json({ board: await ffLeaderboard(uid) });
    } catch (e: any) { res.status(500).json({ error: 'leaderboard failed: ' + (e?.message || String(e)) }); }
  });

  // dev triggers (curl-verifiable)
  app.post('/dev/ff-sync', async (_req, res) => {
    try { res.json(await syncFpl()); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
  app.post('/dev/ff-finalize', async (_req, res) => {
    try { res.json(await finalizeGameweeks()); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
}
