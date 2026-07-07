// ════════════════════════════════════════════════════════════════════════
//  yourZ — FANTASY FOOTBALL, multi-league (EPL + UCL), full XI with real
//  formations. Rules of the house league: pick ELEVEN — exactly 1 GK,
//  3–5 DEF, 2–5 MID, 1–3 FWD — max 3 per club, captain doubled, per-league
//  budget. Locked at each league's deadline; your latest XI rolls forward.
//  The wannabe hustler runs the trash talk when a round closes.
//
//  Data doctrine — nothing invented, ever:
//   • EPL: FPL public API (players, deadlines, per-player gw points).
//   • UCL: UEFA feeds — players + fixtures (both verified with real curls).
//     No verified per-matchday points feed exists, so UCL scores by
//     SNAPSHOT DELTA: totPts at matchday lock vs totPts after; the
//     difference IS the matchday. A 30-min sweep takes the snapshot in the
//     window between our lock and first kickoff; if the window is ever
//     missed, that matchday is skipped with an honest log — never guessed.
//   • UEFA timestamps carry no timezone → parsed as UTC+2, deadlines get a
//     further 60-min buffer. We may lock early; we never lock late.
// ════════════════════════════════════════════════════════════════════════
import type express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { llm } from './llm.js';
import { supabase } from './db.js';
import { resolveUser } from './zAccess.js';
import { logUsage } from './usage.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

// ── league config (server is law) ─────────────────────────────────────────
type LeagueKey = 'epl' | 'ucl';
const LEAGUES: Record<LeagueKey, { name: string; budget: number; maxPerTeam: number }> = {
  epl: { name: 'Premier League', budget: 83.0, maxPerTeam: 3 },
  ucl: { name: 'Champions League', budget: 80.0, maxPerTeam: 3 },
};
const SQUAD_SIZE = 11;
const FORMATION = { GK: [1, 1], DEF: [3, 5], MID: [2, 5], FWD: [1, 3] } as const;
const asLeague = (v: any): LeagueKey => (String(v || 'epl').toLowerCase() === 'ucl' ? 'ucl' : 'epl');

async function jget(url: string): Promise<any> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (yourZ house league)' },
  });
  if (!r.ok) throw new Error(`${url.split('/').slice(-1)[0]} → ${r.status}`);
  return r.json();
}

// ── EPL adapter (FPL) ─────────────────────────────────────────────────────
const FPL = 'https://fantasy.premierleague.com/api';
const FPL_POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

async function syncEpl(syncStart: string): Promise<{ players: number; gameweeks: number }> {
  const boot = await jget(`${FPL}/bootstrap-static/`);
  const teams: Record<number, string> = {};
  for (const t of boot.teams ?? []) teams[t.id] = t.short_name;
  const rows = (boot.elements ?? []).map((e: any) => ({
    league: 'epl', id: e.id,
    name: String(e.web_name || '').slice(0, 60),
    full_name: `${e.first_name || ''} ${e.second_name || ''}`.trim().slice(0, 120),
    team: teams[e.team] || String(e.team),
    pos: FPL_POS[e.element_type] || 'MID',
    cost: Number(e.now_cost) / 10,
    total_points: Number(e.total_points) || 0,
    status: e.status || null,
    news: e.news ? String(e.news).slice(0, 200) : null,
    updated_at: new Date().toISOString(),
  }));
  let players = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('ff_players').upsert(rows.slice(i, i + 200));
    if (error) throw new Error('epl ff_players upsert: ' + error.message);
    players += Math.min(200, rows.length - i);
  }
  let gameweeks = 0;
  for (const ev of boot.events ?? []) {
    const row: any = {
      league: 'epl', gw: ev.id, deadline: ev.deadline_time,
      finished: !!ev.finished, is_current: !!ev.is_current,
      updated_at: new Date().toISOString(),
    };
    if (!ev.finished) row.scored = false;   // rollover law: unfinished can't stay scored
    const { error } = await supabase.from('ff_gameweeks').upsert(row);
    if (!error) gameweeks++;
  }
  const { error: pruneErr } = await supabase.from('ff_players')
    .delete().eq('league', 'epl').lt('updated_at', syncStart);
  if (pruneErr) console.error('[ff] epl prune failed:', pruneErr.message);
  return { players, gameweeks };
}

async function eplLivePoints(gw: number): Promise<Record<number, number>> {
  const j = await jget(`${FPL}/event/${gw}/live/`);
  const pts: Record<number, number> = {};
  for (const el of j.elements ?? []) pts[el.id] = Number(el?.stats?.total_points) || 0;
  return pts;
}

// ── UCL adapter (UEFA) ────────────────────────────────────────────────────
const UEFA = 'https://gaming.uefa.com/en/uclfantasy/services/feeds';
const UCL_POS: Record<number, string> = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const DEADLINE_BUFFER_MS = 60 * 60 * 1000;

// UEFA timestamps have no tz; both "9/19/24 6:45:00 PM" and
// "09/17/2024 21:00:00" occur. Parse as UTC+2 (CEST) — errs EARLY, never late.
export function parseUefaDate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(String(s || '').trim());
  if (!m) return null;
  const [, mo, d, yRaw, hRaw, mi, se, ap] = m;
  let y = Number(yRaw); if (y < 100) y += 2000;
  let h = Number(hRaw);
  if (ap) { const up = ap.toUpperCase(); if (up === 'PM' && h < 12) h += 12; if (up === 'AM' && h === 12) h = 0; }
  const utc = Date.UTC(y, Number(mo) - 1, Number(d), h, Number(mi), Number(se || 0)) - 2 * 3600 * 1000;
  return new Date(utc);
}

async function fetchUclPlayers(): Promise<any[]> {
  // suffix _1 verified; if _2 exists AND is a different page (ids mostly new),
  // treat the suffix as pagination and keep going; if it's the same players
  // (matchday-view suffix), use only _1. Logged either way.
  const first = await jget(`${UEFA}/players/players_70_en_1.json`);
  const list1: any[] = first?.data?.value?.playerList ?? [];
  if (!list1.length) return [];
  const ids1 = new Set(list1.map((p) => String(p.id)));
  try {
    const second = await jget(`${UEFA}/players/players_70_en_2.json`);
    const list2: any[] = second?.data?.value?.playerList ?? [];
    if (list2.length) {
      const overlap = list2.filter((p) => ids1.has(String(p.id))).length / list2.length;
      if (overlap > 0.5) {
        console.log('[ff] ucl players suffix is matchday-style; using file _1 only');
        return list1;
      }
      console.log('[ff] ucl players feed is paginated; walking pages');
      const all = [...list1, ...list2];
      for (let page = 3; page <= 10; page++) {
        try {
          const j = await jget(`${UEFA}/players/players_70_en_${page}.json`);
          const l: any[] = j?.data?.value?.playerList ?? [];
          if (!l.length) break;
          all.push(...l);
        } catch (e) { break; }
      }
      return all;
    }
  } catch (e) { /* _2 absent → single file; the verified path */ }
  return list1;
}

async function syncUcl(syncStart: string): Promise<{ players: number; gameweeks: number }> {
  const list = await fetchUclPlayers();
  const rows = list.map((p: any) => ({
    league: 'ucl', id: Number(p.id),
    name: String(p.pDName || p.latinName || '').slice(0, 60),
    full_name: String(p.pFName || '').slice(0, 120),
    team: String(p.cCode || p.tName || '').slice(0, 12),
    pos: UCL_POS[Number(p.skill)] || 'MID',
    cost: Number(p.value) || 0,
    total_points: Number(p.totPts) || 0,
    status: p.isActive ? 'a' : 'u',
    news: p.trained ? String(p.trained).slice(0, 200) : (p.pStatus ? String(p.pStatus).slice(0, 200) : null),
    updated_at: new Date().toISOString(),
  })).filter((r: any) => Number.isFinite(r.id) && r.name);
  let players = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('ff_players').upsert(rows.slice(i, i + 200));
    if (error) throw new Error('ucl ff_players upsert: ' + error.message);
    players += Math.min(200, rows.length - i);
  }

  const fx = await jget(`${UEFA}/fixtures/fixtures_70_en.json`);
  const mds: any[] = fx?.data?.value ?? [];
  let gameweeks = 0;
  for (const md of mds) {
    const gw = Number(md.mdId);
    if (!Number.isFinite(gw)) continue;
    const dl = parseUefaDate(md.deadline);
    if (!dl) { console.warn('[ff] ucl md', gw, 'deadline unparseable:', md.deadline); continue; }
    const kicks = (md.match ?? [])
      .map((mm: any) => parseUefaDate(mm.matchDate || mm.dateTime || ''))
      .filter(Boolean) as Date[];
    const kFirst = kicks.length ? new Date(Math.min(...kicks.map((k) => k.getTime()))) : null;
    const kLast = kicks.length ? new Date(Math.max(...kicks.map((k) => k.getTime()))) : null;
    // finished = every match kicked off and the last one is 4h+ done
    const finished = !!kLast && Date.now() > kLast.getTime() + 4 * 3600 * 1000;
    const row: any = {
      league: 'ucl', gw,
      deadline: new Date(dl.getTime() - DEADLINE_BUFFER_MS).toISOString(),
      kickoff_first: kFirst ? kFirst.toISOString() : null,
      kickoff_last: kLast ? kLast.toISOString() : null,
      finished, is_current: false,
      updated_at: new Date().toISOString(),
    };
    if (!finished) row.scored = false;
    const { error } = await supabase.from('ff_gameweeks').upsert(row);
    if (!error) gameweeks++;
  }
  // is_current for ucl: deadline passed, not finished, earliest such md
  await supabase.from('ff_gameweeks').update({ is_current: false }).eq('league', 'ucl');
  const { data: cur } = await supabase.from('ff_gameweeks')
    .select('gw').eq('league', 'ucl').eq('finished', false)
    .lt('deadline', new Date().toISOString())
    .order('deadline', { ascending: true }).limit(1).maybeSingle();
  if (cur) await supabase.from('ff_gameweeks').update({ is_current: true }).eq('league', 'ucl').eq('gw', (cur as any).gw);

  const { error: pruneErr } = await supabase.from('ff_players')
    .delete().eq('league', 'ucl').lt('updated_at', syncStart);
  if (pruneErr) console.error('[ff] ucl prune failed:', pruneErr.message);
  return { players, gameweeks };
}

// UCL snapshot: totPts at lock, taken in the window (our lock → first kickoff)
export async function sweepUclSnapshots(): Promise<number> {
  const now = new Date().toISOString();
  const { data: due } = await supabase.from('ff_gameweeks')
    .select('gw, kickoff_first').eq('league', 'ucl').eq('finished', false)
    .lt('deadline', now).gt('kickoff_first', now);
  let taken = 0;
  for (const md of (due ?? []) as any[]) {
    const { count } = await supabase.from('ff_md_snapshots')
      .select('player_id', { count: 'exact', head: true }).eq('league', 'ucl').eq('gw', md.gw);
    if ((count ?? 0) > 0) continue;
    const list = await fetchUclPlayers();
    const rows = list.map((p: any) => ({
      league: 'ucl', gw: md.gw, player_id: Number(p.id), points_at: Number(p.totPts) || 0,
    })).filter((r: any) => Number.isFinite(r.player_id));
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await supabase.from('ff_md_snapshots').upsert(rows.slice(i, i + 200));
      if (error) { console.error('[ff] ucl snapshot upsert:', error.message); break; }
    }
    console.log('[ff] ucl md', md.gw, 'locked —', rows.length, 'players snapshotted');
    taken++;
  }
  return taken;
}

// UCL points for a matchday = current totPts − snapshot at lock
async function uclDeltaPoints(gw: number): Promise<Record<number, number> | null> {
  const { data: snaps } = await supabase.from('ff_md_snapshots')
    .select('player_id, points_at').eq('league', 'ucl').eq('gw', gw);
  if (!snaps?.length) return null;   // window missed → honestly unscoreable
  const list = await fetchUclPlayers();
  const nowPts: Record<number, number> = {};
  for (const p of list) nowPts[Number(p.id)] = Number(p.totPts) || 0;
  const out: Record<number, number> = {};
  for (const s of snaps as any[]) {
    const cur = nowPts[s.player_id];
    if (cur !== undefined) out[s.player_id] = Math.max(0, cur - s.points_at);
  }
  return out;
}

// ── shared: live/round points per league ──────────────────────────────────
const liveCache: Record<string, { at: number; pts: Record<number, number> }> = {};
async function roundPoints(league: LeagueKey, gw: number): Promise<Record<number, number> | null> {
  const key = `${league}:${gw}`;
  const hit = liveCache[key];
  if (hit && Date.now() - hit.at < 60 * 1000) return hit.pts;
  const pts = league === 'epl' ? await eplLivePoints(gw) : await uclDeltaPoints(gw);
  if (pts) liveCache[key] = { at: Date.now(), pts };
  return pts;
}

// ── status ────────────────────────────────────────────────────────────────
export async function ffStatus(league: LeagueKey) {
  const now = new Date().toISOString();
  const [{ data: cur }, { data: next }, { count }] = await Promise.all([
    supabase.from('ff_gameweeks').select('gw, deadline, finished').eq('league', league).eq('is_current', true).maybeSingle(),
    supabase.from('ff_gameweeks').select('gw, deadline').eq('league', league).gt('deadline', now).order('deadline', { ascending: true }).limit(1).maybeSingle(),
    supabase.from('ff_players').select('id', { count: 'exact', head: true }).eq('league', league),
  ]);
  const { data: lastSync } = await supabase.from('ff_players').select('updated_at').eq('league', league).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  return {
    league, league_name: LEAGUES[league].name,
    season_live: !!cur && !(cur as any).finished,
    current_gw: cur ? (cur as any).gw : null,
    next_gw: next ? (next as any).gw : null,
    next_deadline: next ? (next as any).deadline : null,
    players_synced: count ?? 0,
    last_sync: lastSync ? (lastSync as any).updated_at : null,
    rules: {
      size: SQUAD_SIZE, budget: LEAGUES[league].budget,
      formation: { GK: FORMATION.GK, DEF: FORMATION.DEF, MID: FORMATION.MID, FWD: FORMATION.FWD },
      max_per_team: LEAGUES[league].maxPerTeam, captain: '2x',
    },
  };
}

async function openGw(league: LeagueKey): Promise<{ gw: number; deadline: string } | null> {
  const { data } = await supabase.from('ff_gameweeks')
    .select('gw, deadline').eq('league', league).gt('deadline', new Date().toISOString())
    .order('deadline', { ascending: true }).limit(1).maybeSingle();
  return data ? { gw: (data as any).gw, deadline: (data as any).deadline } : null;
}

async function effectiveSquad(userId: string, league: LeagueKey, gw: number) {
  const { data } = await supabase.from('ff_squads')
    .select('gw, player_ids, captain').eq('user_id', userId).eq('league', league).lte('gw', gw)
    .order('gw', { ascending: false }).limit(1).maybeSingle();
  return data as { gw: number; player_ids: number[]; captain: number } | null;
}

async function playersById(league: LeagueKey, ids: number[]) {
  if (!ids.length) return {} as Record<number, any>;
  const { data } = await supabase.from('ff_players')
    .select('id, name, team, pos, cost, total_points, status, news').eq('league', league).in('id', ids);
  const out: Record<number, any> = {};
  for (const p of (data ?? []) as any[]) out[p.id] = p;
  return out;
}

// ── the XI validator: every formation rule enforced here ──────────────────
export async function saveSquad(userId: string, league: LeagueKey, playerIds: number[], captain: number) {
  const open = await openGw(league);
  if (!open) throw new Error(`no open ${league.toUpperCase()} round — entries open when the season does`);
  const ids = [...new Set(playerIds.map(Number))];
  if (ids.length !== SQUAD_SIZE) throw new Error(`pick exactly ${SQUAD_SIZE} different players`);
  if (!ids.includes(Number(captain))) throw new Error('your captain must be in the XI');
  const pool = await playersById(league, ids);
  if (Object.keys(pool).length !== SQUAD_SIZE) throw new Error('a player in that XI is not in this league\'s pool');

  const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  const perTeam: Record<string, number> = {};
  let cost = 0;
  for (const id of ids) {
    const p = pool[id];
    counts[p.pos] = (counts[p.pos] || 0) + 1;
    perTeam[p.team] = (perTeam[p.team] || 0) + 1;
    cost += Number(p.cost);
  }
  for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as const) {
    const [lo, hi] = FORMATION[pos];
    if (counts[pos] < lo || counts[pos] > hi)
      throw new Error(`formation needs ${lo === hi ? lo : `${lo}–${hi}`} ${pos}, you have ${counts[pos]}`);
  }
  const maxPT = LEAGUES[league].maxPerTeam;
  for (const [team, n] of Object.entries(perTeam)) {
    if (n > maxPT) throw new Error(`at most ${maxPT} players from ${team}`);
  }
  const budget = LEAGUES[league].budget;
  if (cost > budget + 1e-9) throw new Error(`over budget: ${cost.toFixed(1)} of ${budget.toFixed(1)}`);

  const { error } = await supabase.from('ff_squads').upsert({
    user_id: userId, league, gw: open.gw, player_ids: ids, captain: Number(captain), updated_at: new Date().toISOString(),
  });
  if (error) throw new Error('squad save: ' + error.message);
  return {
    league, gw: open.gw, deadline: open.deadline, cost: Math.round(cost * 10) / 10,
    formation: `${counts.DEF}-${counts.MID}-${counts.FWD}`,
  };
}

async function lastKnownGw(league: LeagueKey): Promise<number | null> {
  const { data } = await supabase.from('ff_gameweeks').select('gw').eq('league', league).order('gw', { ascending: false }).limit(1).maybeSingle();
  return data ? (data as any).gw : null;
}

export async function squadView(userId: string, league: LeagueKey) {
  const open = await openGw(league);
  const targetGw = open?.gw ?? (await lastKnownGw(league));
  if (!targetGw) return { league, gw: null, squad: null, open: false };
  const sq = await effectiveSquad(userId, league, targetGw);
  if (!sq) return { league, gw: targetGw, deadline: open?.deadline ?? null, open: !!open, squad: null };
  const pool = await playersById(league, sq.player_ids);
  const players = sq.player_ids.map((id) => ({ ...(pool[id] || { id, name: '?', team: '?', pos: '?', cost: 0 }), captain: id === sq.captain }));
  const cost = players.reduce((s, p) => s + Number(p.cost || 0), 0);
  const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const p of players) counts[p.pos] = (counts[p.pos] || 0) + 1;
  return {
    league, gw: targetGw, deadline: open?.deadline ?? null, open: !!open,
    saved_for_gw: sq.gw, rolled_forward: sq.gw !== targetGw,
    squad: {
      players, captain: sq.captain,
      cost: Math.round(cost * 10) / 10, budget: LEAGUES[league].budget,
      formation: `${counts.DEF}-${counts.MID}-${counts.FWD}`,
    },
  };
}

export async function myLive(userId: string, league: LeagueKey) {
  const { data: cur } = await supabase.from('ff_gameweeks')
    .select('gw, finished').eq('league', league).eq('is_current', true).maybeSingle();
  if (!cur) return { league, gw: null, points: null, players: [] };
  const gw = (cur as any).gw;
  const sq = await effectiveSquad(userId, league, gw);
  if (!sq) return { league, gw, points: null, players: [] };
  const pts = await roundPoints(league, gw);
  const pool = await playersById(league, sq.player_ids);
  if (!pts) return { league, gw, points: null, players: [], note: 'this round could not be tracked (lock snapshot missing)' };
  const players = sq.player_ids.map((id) => {
    const cap = id === sq.captain;
    const p = pts[id] || 0;
    return { id, name: pool[id]?.name || '?', team: pool[id]?.team || '?', pos: pool[id]?.pos || '?', points: p, captain: cap, counted: cap ? p * 2 : p };
  });
  return { league, gw, finished: !!(cur as any).finished, points: players.reduce((s, p) => s + p.counted, 0), players };
}

// ── the hustler's round-close trash talk (real numbers only) ──────────────
const HUSTLER_SYS = `You are THE WANNABE HUSTLER of the Z house — all hype, all trash talk, secretly loves his friends. A fantasy football round just closed in the house league (phantom stakes, real points — a game between friends). Write EXACTLY ONE line, under 30 words, lowercase-casual, cocky and funny, personal. Use ONLY the numbers and names given — never invent a player, score, or event. No emojis, no hashtags, no markdown.`;

async function hustlerLine(userId: string, ctx: string, fallback: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 100, system: HUSTLER_SYS,
      messages: [{ role: 'user', content: ctx }],
    });
    logUsage({ userId, personaKey: 'the_wannabe', surface: 'other', fn: 'fantasy', model: MODEL, usage: (msg as any).usage });
    const t = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join(' ').trim();
    return t ? t.slice(0, 240) : fallback;
  } catch (e: any) {
    console.error('[ff] hustler line failed:', e?.message || e);
    return fallback;
  }
}

// ── finalize: score every finished-unscored round in both leagues ─────────
export async function finalizeGameweeks(): Promise<{ scored: number; users: number }> {
  const { data: due } = await supabase.from('ff_gameweeks')
    .select('league, gw').eq('finished', true).eq('scored', false).order('gw', { ascending: true });
  let scored = 0, users = 0;
  for (const row of (due ?? []) as any[]) {
    const league = asLeague(row.league), gw = row.gw;
    try {
      const pts = await roundPoints(league, gw);
      if (!pts) {
        // UCL round with no lock snapshot — unscoreable, say so once and move on
        console.warn('[ff]', league, 'round', gw, 'unscoreable (no snapshot) — marking scored empty');
        await supabase.from('ff_gameweeks').update({ scored: true, updated_at: new Date().toISOString() }).eq('league', league).eq('gw', gw);
        scored++;
        continue;
      }
      const { data: squadUsers } = await supabase.from('ff_squads')
        .select('user_id').eq('league', league).lte('gw', gw);
      const uids = [...new Set(((squadUsers ?? []) as any[]).map((s) => s.user_id))];
      for (const uid of uids) {
        const sq = await effectiveSquad(uid, league, gw);
        if (!sq) continue;
        const pool = await playersById(league, sq.player_ids);
        const breakdown = sq.player_ids.map((id) => {
          const cap = id === sq.captain;
          const p = pts[id] || 0;
          return { id, name: pool[id]?.name || '?', points: cap ? p * 2 : p, captain: cap };
        });
        const total = breakdown.reduce((s, b) => s + b.points, 0);
        const { error } = await supabase.from('ff_scores').upsert({ user_id: uid, league, gw, points: total, breakdown });
        if (error) { console.error('[ff] score write failed', uid, league, gw, error.message); continue; }
        users++;

        const best = [...breakdown].sort((a, b) => b.points - a.points)[0];
        const worst = [...breakdown].sort((a, b) => a.points - b.points)[0];
        const ctx = [
          `${LEAGUES[league].name} round ${gw} closed. their XI scored ${total} points.`,
          best ? `their best: ${best.name} with ${best.points}${best.captain ? ' (captain, doubled)' : ''}` : '',
          worst && worst !== best ? `their flop: ${worst.name} with ${worst.points}` : '',
          `talk your trash.`,
        ].filter(Boolean).join('\n');
        const fallback = `${LEAGUES[league].name.toLowerCase()} round ${gw} closed — ${total} points on your XI. the board remembers everything.`;
        const body = await hustlerLine(uid, ctx, fallback);
        await supabase.from('scheduled_pings').insert({
          user_id: uid, persona_key: 'the_wannabe', kind: 'ff_gameweek',
          body, due_at: new Date().toISOString(),
        });
      }
      await supabase.from('ff_gameweeks').update({ scored: true, updated_at: new Date().toISOString() }).eq('league', league).eq('gw', gw);
      scored++;
    } catch (e: any) { console.error('[ff] finalize', league, gw, 'failed:', e?.message || e); }
  }
  return { scored, users };
}

// ── leaderboard: me + accepted friends, per league ────────────────────────
export async function ffLeaderboard(userId: string, league: LeagueKey) {
  const { data: edges } = await supabase.from('friendships')
    .select('user_lo, user_hi, status').or(`user_lo.eq.${userId},user_hi.eq.${userId}`);
  const friendIds = ((edges ?? []) as any[])
    .filter((e) => e.status === 'accepted')
    .map((e) => (e.user_lo === userId ? e.user_hi : e.user_lo));
  const ids = [...new Set([userId, ...friendIds])];

  const [{ data: scores }, { data: usersRows }] = await Promise.all([
    supabase.from('ff_scores').select('user_id, gw, points').eq('league', league).in('user_id', ids),
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

// ── schedulers: sync 6h (+ boot), snapshots 30 min, finalize hourly ───────
export function startFfScheduler() {
  const sync = async () => {
    const syncStart = new Date().toISOString();
    try { const r = await syncEpl(syncStart); console.log('[ff] epl synced', r.players, 'players,', r.gameweeks, 'gws'); }
    catch (e: any) { console.error('[ff] epl sync failed (keeping last):', e?.message || e); }
    try { const r = await syncUcl(syncStart); console.log('[ff] ucl synced', r.players, 'players,', r.gameweeks, 'mds'); }
    catch (e: any) { console.error('[ff] ucl sync failed (keeping last):', e?.message || e); }
  };
  sync();
  setInterval(sync, 6 * 60 * 60 * 1000);
  setInterval(async () => {
    try { await sweepUclSnapshots(); }
    catch (e: any) { console.error('[ff] snapshot sweep failed:', e?.message || e); }
  }, 30 * 60 * 1000);
  setInterval(async () => {
    try { const r = await finalizeGameweeks(); if (r.scored) console.log('[ff] finalized', r); }
    catch (e: any) { console.error('[ff] finalize sweep failed:', e?.message || e); }
  }, 60 * 60 * 1000);
  console.log('[ff] house league open — epl+ucl, sync 6h, snapshots 30m, finalize hourly');
}

// ── routes (?league=epl|ucl, default epl — backward compatible) ───────────
export function installFfRoutes(app: express.Express, authUser: (req: express.Request) => Promise<string | null>) {
  const guard = async (req: express.Request, res: express.Response): Promise<string | null> => {
    const authId = await authUser(req);
    if (!authId) { res.status(401).json({ error: 'unauthorized' }); return null; }
    const user = await resolveUser(authId);
    return user.id;
  };

  app.get('/ff/status', async (req, res) => {
    try { if (!(await guard(req, res))) return; res.json(await ffStatus(asLeague(req.query.league))); }
    catch (e: any) { res.status(500).json({ error: 'status failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/players', async (req, res) => {
    try {
      if (!(await guard(req, res))) return;
      const league = asLeague(req.query.league);
      const q = String(req.query.q || '').trim().toLowerCase();
      const pos = String(req.query.pos || '').trim().toUpperCase();
      let sel = supabase.from('ff_players').select('id, name, team, pos, cost, total_points, status, news')
        .eq('league', league).order('total_points', { ascending: false }).limit(60);
      if (pos && ['GK', 'DEF', 'MID', 'FWD'].includes(pos)) sel = sel.eq('pos', pos);
      if (q) sel = sel.ilike('name', `%${q}%`);
      const { data, error } = await sel;
      if (error) return res.status(500).json({ error: error.message });
      res.json({ league, players: data ?? [] });
    } catch (e: any) { res.status(500).json({ error: 'players failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/squad', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json(await squadView(uid, asLeague(req.query.league)));
    } catch (e: any) { res.status(500).json({ error: 'squad failed: ' + (e?.message || String(e)) }); }
  });

  app.post('/ff/squad', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      const league = asLeague((req.body ?? {}).league);
      const playerIds = Array.isArray((req.body ?? {}).playerIds) ? (req.body.playerIds as any[]).map(Number) : [];
      const captain = Number((req.body ?? {}).captain);
      res.json(await saveSquad(uid, league, playerIds, captain));
    } catch (e: any) { res.status(400).json({ error: e?.message || String(e) }); }
  });

  app.get('/ff/live', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      res.json(await myLive(uid, asLeague(req.query.league)));
    } catch (e: any) { res.status(500).json({ error: 'live failed: ' + (e?.message || String(e)) }); }
  });

  app.get('/ff/leaderboard', async (req, res) => {
    try {
      const uid = await guard(req, res); if (!uid) return;
      const league = asLeague(req.query.league);
      res.json({ league, board: await ffLeaderboard(uid, league) });
    } catch (e: any) { res.status(500).json({ error: 'leaderboard failed: ' + (e?.message || String(e)) }); }
  });

  // dev triggers (curl-verifiable)
  app.post('/dev/ff-sync', async (_req, res) => {
    const syncStart = new Date().toISOString();
    const out: any = {};
    try { out.epl = await syncEpl(syncStart); } catch (e: any) { out.epl = { error: e?.message || String(e) }; }
    try { out.ucl = await syncUcl(syncStart); } catch (e: any) { out.ucl = { error: e?.message || String(e) }; }
    res.json(out);
  });
  app.post('/dev/ff-snapshots', async (_req, res) => {
    try { res.json({ taken: await sweepUclSnapshots() }); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
  app.post('/dev/ff-finalize', async (_req, res) => {
    try { res.json(await finalizeGameweeks()); }
    catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
  });
}
