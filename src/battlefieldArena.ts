// ════════════════════════════════════════════════════════════════════════
//  callmeZ — BATTLEFIELD ARENA (spec phase 2): the viral loop's machinery.
//
//  · SETTLE IT (0064): a vetted motion + a stance become a /fight/<id> link;
//    the claim IS the duel start — both seats fill at accept, a normal duel
//    runs, no parallel machinery. evaluateMotion fronts EVERY user-authored
//    motion (spec guardrail); a failed vet returns the nearest judgeable
//    rewrite for consent — the client re-submits the rewrite, never bypasses.
//  · THE RECORD (0066): every duel gets a row at creation (LIVE NOW reads
//    live rows); the verdict finalizes it; the sweeper marks dead sessions
//    abandoned. Sessions stay the source of truth for state; this is the
//    index the directory, the share route, the ladder, and the GM will read.
//  · THE SHARE ROUTE: the verdict card's SUBSTANCE (phase 2b owns the visual
//    — no card visual ships without the owner's design sitting). Read-only,
//    logged-out, public|link rows only — private practice never serves.
//  · THE SWEEPER (§5 + abandonment): 60s tick, the pings pattern. Timed
//    slots past bell+grace force-advance with an on-record "time" note —
//    never a hang, never a model deciding leniency. Live records whose
//    session sits unfinished past 48h are marked abandoned (default chosen;
//    flip if wrong) — a later real completion still finalizes done.
//
//  House laws honored: never invent (no headcounts — the directory carries
//  the vote tally, a real number, and nothing imagined); money walls
//  untouched; identity resolution mirrors the watch endpoint's exactly
//  (display names — the handle-default guardrail is FLAGGED for a ruling,
//  not silently changed here).
// ════════════════════════════════════════════════════════════════════════
import express from 'express';
import { supabase } from './db.js';
import { resolveUser } from './zAccess.js';
import { evaluateMotion, type MotionAssessment } from './battlefieldMotions.js';
import { DOMAIN_LABELS, type DebateDomain } from './battlefieldAdjudicator.js';
import { battlefieldDuelAdapter, newBattlefield, stampSlot, slotLapsed, forceLapse, battleFormat, battleFormatKeys, seatSide as bfSeatSideOf, type BFState } from './games/battlefieldDuel.js';
import { renderCardPNG, type CardData } from './battlefieldCard.js';   // [2b] the share object

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // spec: challenges expire in 7 days (lazy)
const AUDIO_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;   // §7: the voice lives 30 days; the transcript forever
const AUDIO_BUCKET = 'battlefield-audio';                // private — signed URLs only (0068)
const ABANDON_AFTER_MS = 48 * 60 * 60 * 1000;        // declared default: dead past 48h → abandoned

type AuthFn = (req: express.Request) => Promise<string | null>;

// ── §7 VOICE AUDIT: the signer + the retention sweep ─────────────────────
// A turn's `audio` field is a PATH inside the private bucket (new turns) or a
// legacy full public URL (pre-audit turns — passed through until retention
// ages their sessions out). Signing happens AT READ: the watch payload and the
// voice-turn response carry hour-lived URLs; nothing permanent ever leaves.
export async function signTurnAudio(turns: any[]): Promise<any[]> {
  const out: any[] = [];
  for (const t of (turns || [])) {
    if (!t?.audio || typeof t.audio !== 'string' || t.audio.startsWith('http')) { out.push(t); continue; }
    try {
      const { data } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(t.audio, 3600);
      out.push({ ...t, audio: data?.signedUrl || null, audioExpired: !data?.signedUrl });
    } catch { out.push({ ...t, audio: null, audioExpired: true }); }
  }
  return out;
}

// purge a finished session's audio from BOTH buckets (the private one and the
// legacy public 'duel-audio'); stamp the record so the sweep runs exactly once.
async function purgeSessionAudio(sessionId: string): Promise<void> {
  for (const bucket of [AUDIO_BUCKET, 'duel-audio']) {
    try {
      const { data: files } = await supabase.storage.from(bucket).list(sessionId, { limit: 100 });
      const paths = (files || []).map((f: any) => `${sessionId}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    } catch { /* a missing bucket or empty prefix is a clean no-op */ }
  }
  await supabase.from('battlefield_record')
    .update({ audio_purged_at: new Date().toISOString() })
    .eq('session_id', sessionId).is('audio_purged_at', null);
}

// ── THE RECORD ────────────────────────────────────────────────────────────

// [phase 3] sides grouped by the FORMAT MODULE — a pf row carries 2 seats per side,
// an ap row 3; the legacy two-seat shape is the duel module's natural output.
function sidesOf(state: BFState, seats: any[]): any[] {
  const fmt = battleFormat((state as any)?.formatKey || 'duel') || battleFormat('duel')!;
  const ent = (x: any) => x?.kind === 'user' ? { user_id: x.id } : x?.kind === 'persona' ? { persona: x.id || x.key || 'the_house' } : { open: true };
  const bySide = (side: 'PRO' | 'CON') =>
    [...new Set(fmt.order.filter((o) => (o.side === 'con' ? 'CON' : 'PRO') === side).map((o) => o.seat))].sort((a, b) => a - b);
  return [
    { side: 'PRO', seats: bySide('PRO').map((i) => ent(seats?.[i])) },
    { side: 'CON', seats: bySide('CON').map((i) => ent(seats?.[i])) },
  ];
}

export async function insertBattlefieldRecord(sessionId: string, state: BFState, seats: any[], visibility: 'public' | 'link' | 'private'): Promise<void> {
  try {
    await supabase.from('battlefield_record').insert({
      session_id: sessionId,
      format_key: (state as any).formatKey || 'duel',
      motion: state.motion,
      domain: state.domain,
      sides: sidesOf(state, seats),
      status: 'live',
      visibility,
    });
  } catch (e: any) { console.error('[bf-record] insert failed (never blocks the duel):', e?.message || e); }
}

async function crowdTally(sessionId: string): Promise<{ pro: number; con: number; total: number }> {
  const tally = { pro: 0, con: 0, total: 0 };
  try {
    const { data: vrows } = await supabase.from('battlefield_votes').select('side').eq('session_id', sessionId);
    for (const v of (vrows || [])) { if (v.side === 'PRO') tally.pro++; else if (v.side === 'CON') tally.con++; }
    tally.total = tally.pro + tally.con;
  } catch { /* best-effort */ }
  return tally;
}

// the verdict lands on the record. Called from the move route's over-hook and the
// sweeper. A completed duel finalizes even a previously-abandoned row (the record
// never blocks a real verdict); adjudication_failed is done-without-a-winner —
// stored as {failed}, never laundered into a verdict shape.
// ── §9 THE LADDER: Elo settlement ─────────────────────────────────────────
// K=32, per-format, from 1200. Team duels: each member's delta is computed vs
// the OPPOSING TEAM'S AVERAGE (spec law). Ranked requires every seat human —
// the house has no rating; a ranked floor that somehow seated the house
// settles nothing and says so in the log. Settlement is called ONLY from the
// finalize path's live→done compare-and-flip, so a duel settles exactly once
// (the reconciler healing a missed flip still settles; a re-run never does).
const ELO_K = 32;
async function settleElo(st: any, seatsArr: any[]): Promise<void> {
  try {
    if (!st?.ranked || !st?.verdict?.winner) return;
    const fmt = battleFormat(st.formatKey || 'duel'); if (!fmt) return;
    if ((seatsArr || []).some((x: any) => x?.kind !== 'user')) {
      console.error('[bf-elo] ranked duel carried a non-human seat — no settlement'); return;
    }
    const fkey = fmt.key;
    const players = (seatsArr as any[]).map((x: any, i: number) => ({ id: x.id, seat: i, side: bfSeatSideOf(fmt, i) }));
    const ids = players.map((p) => p.id);
    const { data: rows } = await supabase.from('battlefield_ratings').select('*').eq('format_key', fkey).in('user_id', ids);
    const rowOf: Record<string, any> = {};
    for (const r of (rows || []) as any[]) rowOf[r.user_id] = r;
    const cur = (id: string) => rowOf[id]?.elo ?? 1200;
    const teamAvg = (side: string) => {
      const t = players.filter((p) => p.side === side);
      return t.reduce((a, p) => a + cur(p.id), 0) / Math.max(1, t.length);
    };
    const proAvg = teamAvg('PRO'), conAvg = teamAvg('CON');
    const winner = st.verdict.winner;
    const now = new Date().toISOString();
    const updates = players.map((p) => {
      const oppAvg = p.side === 'PRO' ? conAvg : proAvg;
      const expected = 1 / (1 + Math.pow(10, (oppAvg - cur(p.id)) / 400));
      const won = p.side === winner;
      const delta = Math.round(ELO_K * ((won ? 1 : 0) - expected));
      return {
        user_id: p.id, format_key: fkey,
        elo: cur(p.id) + delta,
        wins: (rowOf[p.id]?.wins ?? 0) + (won ? 1 : 0),
        losses: (rowOf[p.id]?.losses ?? 0) + (won ? 0 : 1),
        updated_at: now,
      };
    });
    await supabase.from('battlefield_ratings').upsert(updates, { onConflict: 'user_id,format_key' });
  } catch (e: any) { console.error('[bf-elo] settlement failed:', e?.message || e); }
}

export async function finalizeBattlefieldRecord(sessionId: string, live?: { state: BFState; seats: any[] }): Promise<void> {
  try {
    // [gate-1 fix] the move route calls this AFTER the fenced persist, passing the
    // in-memory state — the old re-read raced the persist and saw pre-verdict state,
    // so the record never flipped. The reconciler path (no `live`) re-reads.
    let st: BFState; let seatsArr: any[];
    if (live) { st = live.state; seatsArr = live.seats; }
    else {
      const { data: s } = await supabase.from('game_sessions').select('id, state, seats').eq('id', sessionId).maybeSingle();
      if (!s) return;
      st = (s.state || {}) as BFState; seatsArr = s.seats as any[];
    }
    if ((st.phase as string) !== 'verdict') return;
    const verdict = st.verdict
      ? {
          winner: st.verdict.winner,
          verdict_line: st.verdict.adjVerdict,
          summary: st.verdict.summary,
          matter: st.verdict.matter,
          manner: st.verdict.manner,
          closing: st.verdict.closing,
          // [2b] the tab rides the record — the card's ★ and the share page's scores
          speakers: (st.verdict as any).speakers || [],
          best_speaker: (st.verdict as any).bestSpeaker ?? -1,
        }
      : (st.error ? { failed: st.error } : null);
    // [0067] the live→done COMPARE-AND-FLIP: only the call that performs the flip
    // settles Elo — re-runs (reconciler on an already-done record, double finalize)
    // update nothing and settle nothing.
    const { data: flipped } = await supabase.from('battlefield_record').update({
      status: 'done',
      verdict,
      crowd: await crowdTally(sessionId),
      sides: sidesOf(st, seatsArr),   // refresh — a claimed seat postdates the insert
      ended_at: new Date().toISOString(),
    }).eq('session_id', sessionId).eq('status', 'live').select('session_id').maybeSingle();
    if (flipped && (st as any).ranked && st.verdict?.winner) await settleElo(st, seatsArr);
  } catch (e: any) { console.error('[bf-record] finalize failed:', e?.message || e); }
}

// display names exactly as the watch endpoint resolves them (consistency; the
// handle-default guardrail is an open ruling, flagged in the status doc).
async function namesForSides(sides: any[]): Promise<any[]> {
  const ids: string[] = [];
  for (const side of (sides || [])) for (const seat of (side.seats || [])) if (seat.user_id) ids.push(seat.user_id);
  const nameById: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
    for (const u of (us || [])) nameById[u.id] = u.display_name || 'a debater';
  }
  return (sides || []).map((side: any) => ({
    side: side.side,
    names: (side.seats || []).map((seat: any) =>
      seat.user_id ? (nameById[seat.user_id] || 'a debater') : seat.persona ? 'the House' : '(open)'),
  }));
}

// ── ROUTES ────────────────────────────────────────────────────────────────

export function installBattlefieldArenaRoutes(app: express.Express, authUser: AuthFn) {
  // [phase 4 contract] the FORMAT MODULES, served to the client — the duel screen is
  // driven by the module (§3.1) and fork #1's single-source law forbids a bundled
  // client copy. Public, static, cacheable; the server's loaded modules ARE the truth.
  app.get('/battlefield/formats', (_req, res) => {
    const out: Record<string, any> = {};
    for (const k of battleFormatKeys()) out[k] = battleFormat(k);
    res.json({ formats: out });
  });

  const guard = async (req: express.Request, res: express.Response): Promise<{ id: string } | null> => {
    const authId = await authUser(req);
    if (!authId) { res.status(401).json({ error: 'unauthorized' }); return null; }
    const user = await resolveUser(authId);
    return user;
  };

  const lazyExpire = async (ch: any): Promise<any> => {
    if (ch.status === 'open' && Date.now() - Date.parse(ch.created_at) > CHALLENGE_TTL_MS) {
      try { await supabase.from('battlefield_challenges').update({ status: 'expired' }).eq('id', ch.id).eq('status', 'open'); } catch { /* lazy */ }
      ch.status = 'expired';
    }
    return ch;
  };

  // SETTLE IT — mint a challenge. evaluateMotion fronts the motion (spec guardrail);
  // a failing motion returns 422 WITH the assessment + the nearest judgeable rewrite —
  // the consent step: the client shows the rewrite, the user re-submits it. Never a
  // silent rewrite, never a bypass.
  app.post('/battlefield/challenge/create', async (req, res) => {
    try {
      const me = await guard(req, res); if (!me) return;
      const motion = String(req.body?.motion || '').trim().slice(0, 300);
      if (motion.length < 10) return res.status(400).json({ error: 'a motion must carry some weight' });
      const domain = req.body?.domain && DOMAIN_LABELS[req.body.domain as DebateDomain] ? req.body.domain as DebateDomain : undefined;
      const side = String(req.body?.side || 'pro').toLowerCase() === 'con' ? 'con' : 'pro';
      // [0067] ranked is OPT-IN AT CREATE (spec §9): ranked = public + timed +
      // commentary-on. Opting in forces the clock; the record goes public at claim.
      const ranked = req.body?.ranked === true;
      const timed = req.body?.timed === true || ranked;
      const assess: MotionAssessment = await evaluateMotion(motion, domain, me.id, 'normal');
      if (!assess.pass) {
        return res.status(422).json({
          error: 'the motion is not judgeable as written',
          assessment: {
            judgeable: assess.judgeable, issues: assess.issues, note: assess.note,
            restructured: assess.restructured || null,
            suggestedDomain: assess.suggestedDomain !== 'none' ? assess.suggestedDomain : null,
          },
        });
      }
      const finalDomain = domain || (assess.suggestedDomain !== 'none' ? assess.suggestedDomain as DebateDomain : null);
      const { data: ch, error } = await supabase.from('battlefield_challenges').insert({
        challenger: me.id, motion, domain: finalDomain, format_key: 'duel',
        challenger_side: side, timed, ranked, status: 'open',
      }).select('id').single();
      if (error || !ch) return res.status(500).json({ error: error?.message || 'challenge insert failed' });
      res.json({
        challengeId: ch.id,
        fightPath: `/fight/${ch.id}`,   // rides the claim-link pattern, served like /watch/:id
        motion, domain: finalDomain, side, timed, ranked,
        expiresInDays: 7,
      });
    } catch (e: any) { res.status(500).json({ error: 'challenge create failed: ' + (e?.message || String(e)) }); }
  });

  // the fight page's data — PUBLIC read (the invitee sees the motion before signing in).
  // Never exposes user ids or phones; the challenger shows by display name (watch parity).
  app.get('/battlefield/challenge/:id', async (req, res) => {
    try {
      const { data: chRaw } = await supabase.from('battlefield_challenges').select('*').eq('id', req.params.id).maybeSingle();
      if (!chRaw) return res.status(404).json({ error: 'no such challenge' });
      const ch = await lazyExpire(chRaw);
      let challengerName = 'a debater';
      try {
        const { data: u } = await supabase.from('users').select('display_name').eq('id', ch.challenger).maybeSingle();
        if (u?.display_name) challengerName = u.display_name;
      } catch { /* name is best-effort */ }
      res.json({
        id: ch.id, status: ch.status, motion: ch.motion, domain: ch.domain,
        challengerName, challengerSide: String(ch.challenger_side || 'pro').toUpperCase(),
        yourSide: String(ch.challenger_side || 'pro') === 'pro' ? 'CON' : 'PRO',
        timed: !!ch.timed, ranked: !!ch.ranked, sessionId: ch.session_id || null,
        createdAt: ch.created_at,
      });
    } catch (e: any) { res.status(500).json({ error: 'challenge read failed: ' + (e?.message || String(e)) }); }
  });

  // the CLAIM — accept the challenge. Both seats fill HERE and the duel is live at
  // once (no open-seat wait: the challenge carried the stance, the accept is the
  // handshake). Refusals in register: expired, own-challenge, already-claimed.
  app.post('/battlefield/challenge/:id/claim', async (req, res) => {
    try {
      const me = await guard(req, res); if (!me) return;
      const { data: chRaw } = await supabase.from('battlefield_challenges').select('*').eq('id', req.params.id).maybeSingle();
      if (!chRaw) return res.status(404).json({ error: 'no such challenge' });
      const ch = await lazyExpire(chRaw);
      if (ch.status === 'expired') return res.status(410).json({ error: 'this challenge has expired — the floor waited seven days' });
      if (ch.status !== 'open') return res.status(409).json({ error: 'this challenge was already accepted', sessionId: ch.session_id || null });
      if (ch.challenger === me.id) return res.status(400).json({ error: 'you cannot accept your own challenge — send the link to your opponent' });

      // the shared floor: same shape the duel/start route builds (no parallel machinery)
      const title = 'the Battlefield · settle it';
      const { data: thread, error: tErr } = await supabase.from('threads').insert({
        user_id: ch.challenger, is_group: true, is_shared: true, member_keys: [], companion_name: title,
      }).select('id').single();
      if (tErr || !thread) return res.status(500).json({ error: 'could not open the floor: ' + (tErr?.message || '') });
      await supabase.from('room_members').insert([
        { thread_id: thread.id, user_id: ch.challenger, role: 'owner' },
        { thread_id: thread.id, user_id: me.id, role: 'member' },
      ]);
      const proId = ch.challenger_side === 'pro' ? ch.challenger : me.id;
      const conId = ch.challenger_side === 'pro' ? me.id : ch.challenger;
      const seats = [{ kind: 'user', id: proId }, { kind: 'user', id: conId }];
      const domain = ch.domain && DOMAIN_LABELS[ch.domain as DebateDomain] ? ch.domain as DebateDomain : undefined;
      const state = newBattlefield({ motion: ch.motion, domain, difficulty: 'normal', notesOn: true, timed: !!ch.timed || !!ch.ranked });
      if (ch.ranked) (state as any).ranked = true;   // [0067] Elo settles at the flip
      stampSlot(state);   // both seats are filled at claim — the floor is LIVE, the clock runs
      const { data: sess, error } = await supabase.from('game_sessions').insert({
        thread_id: thread.id, game: 'battlefield_duel', state, seats, created_by: ch.challenger,
      }).select('id, version').single();
      if (error || !sess) return res.status(500).json({ error: error?.message || 'session insert failed' });

      // claim races: only the first accept flips open→accepted; a loser rolls nothing
      // back (the orphan session is harmless and unreferenced) but is told the truth.
      const { data: flipped } = await supabase.from('battlefield_challenges')
        .update({ status: 'accepted', session_id: sess.id })
        .eq('id', ch.id).eq('status', 'open').select('id').maybeSingle();
      if (!flipped) return res.status(409).json({ error: 'someone accepted this challenge first' });

      await insertBattlefieldRecord(sess.id, state, seats, ch.ranked ? 'public' : 'link');   // ranked = PUBLIC by law; a friendly settled argument stays the parties' to share
      res.json({
        ok: true, sessionId: sess.id, version: sess.version, roomId: thread.id,
        yourSeat: seats.findIndex((x) => x.id === me.id),
        yourSide: proId === me.id ? 'PRO' : 'CON',
        watchPath: `/watch/${sess.id}`,
      });
    } catch (e: any) { res.status(500).json({ error: 'claim failed: ' + (e?.message || String(e)) }); }
  });

  // THE DIRECTORY — LIVE NOW + RECENT VERDICTS, public rows only. The engagement
  // number is the vote tally (real); no headcount is invented (house law).
  app.get('/battlefield/directory', async (_req, res) => {
    try {
      const { data: liveRows } = await supabase.from('battlefield_record')
        .select('session_id, motion, domain, format_key, started_at, crowd')
        .eq('status', 'live').eq('visibility', 'public')
        .order('started_at', { ascending: false }).limit(20);
      const live = [] as any[];
      for (const r of (liveRows || [])) {
        live.push({ sessionId: r.session_id, motion: r.motion, domain: r.domain, formatKey: r.format_key, startedAt: r.started_at, votes: (await crowdTally(r.session_id)).total, watchPath: `/watch/${r.session_id}` });
      }
      const { data: doneRows } = await supabase.from('battlefield_record')
        .select('session_id, motion, domain, format_key, verdict, crowd, ended_at')
        .eq('status', 'done').eq('visibility', 'public').not('verdict', 'is', null)
        .order('ended_at', { ascending: false }).limit(20);
      const recent = (doneRows || []).map((r: any) => ({
        sessionId: r.session_id, motion: r.motion, domain: r.domain, formatKey: r.format_key,
        winner: r.verdict?.winner || null, verdictLine: r.verdict?.verdict_line || null,
        crowd: r.crowd || null, endedAt: r.ended_at, verdictPath: `/battlefield/verdict/${r.session_id}`,
      }));
      res.json({ live, recent });
    } catch (e: any) { res.status(500).json({ error: 'directory failed: ' + (e?.message || String(e)) }); }
  });

  // THE SHARE ROUTE — the verdict card's substance (phase 2b renders it). Public,
  // read-only, logged-out. public|link rows serve; private practice NEVER serves.
  app.get('/battlefield/verdict/:sessionId', async (req, res) => {
    try {
      const { data: r } = await supabase.from('battlefield_record').select('*').eq('session_id', req.params.sessionId).maybeSingle();
      if (!r || r.visibility === 'private') return res.status(404).json({ error: 'no such verdict' });
      if (r.status === 'live') return res.status(409).json({ error: 'the duel is still live', watchPath: `/watch/${r.session_id}` });
      if (r.status === 'abandoned' || !r.verdict) return res.status(410).json({ error: 'this duel ended without a verdict' });
      if (r.verdict.failed) return res.status(410).json({ error: 'adjudication failed — no verdict stands', reason: r.verdict.failed });
      res.json({
        sessionId: r.session_id,
        motion: r.motion, domain: r.domain, formatKey: r.format_key,
        sides: await namesForSides(r.sides),
        winner: r.verdict.winner,
        verdictLine: r.verdict.verdict_line,
        matter: r.verdict.matter, manner: r.verdict.manner,
        summary: r.verdict.summary, closing: r.verdict.closing,
        speakers: r.verdict.speakers || [], bestSpeaker: r.verdict.best_speaker ?? -1,
        crowd: r.crowd || null,
        date: r.ended_at,
        watchPath: `/watch/${r.session_id}`,
      });
    } catch (e: any) { res.status(500).json({ error: 'verdict read failed: ' + (e?.message || String(e)) }); }
  });

  // ── §9 THE LADDER — the read side ─────────────────────────────────────────
  // Top 50 by Elo per format. Names only — never user ids or phones (watch parity).
  app.get('/battlefield/ladder/:formatKey', async (req, res) => {
    try {
      const fkey = req.params.formatKey;
      if (!battleFormatKeys().includes(fkey)) return res.status(400).json({ error: `unknown format '${fkey}'` });
      const { data: rows } = await supabase.from('battlefield_ratings')
        .select('user_id, elo, wins, losses, updated_at').eq('format_key', fkey)
        .order('elo', { ascending: false }).limit(50);
      const ids = ((rows || []) as any[]).map((r) => r.user_id);
      const nameById: Record<string, string> = {};
      if (ids.length) {
        const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
        for (const u of (us || []) as any[]) nameById[u.id] = u.display_name || 'a debater';
      }
      res.json({
        formatKey: fkey,
        ladder: ((rows || []) as any[]).map((r, i) => ({
          rank: i + 1, name: nameById[r.user_id] || 'a debater',
          elo: r.elo, wins: r.wins, losses: r.losses,
        })),
      });
    } catch (e: any) { res.status(500).json({ error: 'ladder read failed: ' + (e?.message || String(e)) }); }
  });

  // my own standing, every format I hold a rating in (auth'd — it's YOUR row)
  app.get('/battlefield/rating/me', async (req, res) => {
    try {
      const me = await guard(req, res); if (!me) return;
      const { data: rows } = await supabase.from('battlefield_ratings')
        .select('format_key, elo, wins, losses, updated_at').eq('user_id', me.id);
      res.json({ ratings: rows || [] });
    } catch (e: any) { res.status(500).json({ error: 'rating read failed: ' + (e?.message || String(e)) }); }
  });

  // ── [2b] THE VERDICT CARD — the battlefield's share object ────────────────
  // A 1200×630 PNG (the og:image standard): the WhatsApp unfurl IS the card.
  // Rendered deterministically (same verdict → same bytes), cached in memory.
  // public|link only; private practice never serves — same law as the JSON route.
  // OWNER-GATED aesthetics: this ships behind the 2b review.
  const cardCache = new Map<string, Buffer>();
  const cardDataFor = async (r: any): Promise<CardData> => {
    const sides = await namesForSides(r.sides);
    const fmt = battleFormat(r.format_key || 'duel');
    let bestSpeakerName: string | null = null;
    const best = r.verdict?.best_speaker;
    if (Number.isInteger(best) && best >= 0) {
      const sp = (r.verdict?.speakers || []).find((x: any) => x.seat === best);
      if (sp?.role) bestSpeakerName = sp.role;
    }
    return {
      motion: r.motion,
      winner: r.verdict.winner,
      verdictLine: r.verdict.verdict_line || r.verdict.summary || '',
      domain: r.domain,
      formatLabel: fmt?.label || null,
      sides,
      crowd: r.crowd || null,
      date: r.ended_at,
      bestSpeakerName,
    };
  };
  const readableRecord = async (sessionId: string): Promise<{ r?: any; code?: number; error?: string }> => {
    const { data: r } = await supabase.from('battlefield_record').select('*').eq('session_id', sessionId).maybeSingle();
    if (!r || r.visibility === 'private') return { code: 404, error: 'no such verdict' };
    if (r.status === 'live') return { code: 409, error: 'the duel is still live' };
    if (r.status === 'abandoned' || !r.verdict || r.verdict.failed) return { code: 410, error: 'this duel ended without a verdict' };
    return { r };
  };

  app.get('/battlefield/card/:sessionId.png', async (req, res) => {
    try {
      const sid = req.params.sessionId;
      if (cardCache.has(sid)) { res.type('png').send(cardCache.get(sid)); return; }
      const { r, code, error } = await readableRecord(sid);
      if (!r) return res.status(code!).json({ error });
      const png = renderCardPNG(await cardDataFor(r));
      if (cardCache.size > 100) cardCache.delete(cardCache.keys().next().value as string);   // a light lid
      cardCache.set(sid, png);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.type('png').send(png);
    } catch (e: any) { res.status(500).json({ error: 'card render failed: ' + (e?.message || String(e)) }); }
  });

  // the unfurling page: /v/<id> — og tags point at the card; the body is the
  // verdict typeset for a browser + the pull into the app. THIS is the link the
  // app shares (the JSON route stays the data contract).
  app.get('/v/:sessionId', async (req, res) => {
    try {
      const sid = req.params.sessionId;
      const { r, code, error } = await readableRecord(sid);
      if (!r) return res.status(code!).send(`<!doctype html><html><body style="background:#120A0E;color:#F5ECE1;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh"><p>${error}</p></body></html>`);
      const base = `https://${req.get('host')}`;
      const d = await cardDataFor(r);
      const esc = (x: string) => String(x || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      const winColor = d.winner === 'PRO' ? '#78C8FF' : '#E0576F';
      const sideLine = (side: string) => esc((d.sides.find((x) => x.side === side)?.names || []).join(' · '));
      const speakers = (r.verdict.speakers || []) as any[];
      res.type('html').send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.winner)} takes the floor — callmeZ Battlefield</title>
<meta property="og:title" content="${esc(d.winner)} takes the floor — “${esc(d.motion)}”">
<meta property="og:description" content="${esc(d.verdictLine)}">
<meta property="og:image" content="${base}/battlefield/card/${sid}.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:type" content="article"><meta property="og:url" content="${base}/v/${sid}">
<meta name="twitter:card" content="summary_large_image">
<style>
  body{margin:0;background:#120A0E;color:#F5ECE1;font:16px/1.6 Georgia,'Times New Roman',serif;display:flex;justify-content:center;padding:28px 18px}
  .card{max-width:640px;width:100%}
  .kick{color:#E0576F;font-family:system-ui,sans-serif;font-size:12px;letter-spacing:.22em}
  .motion{font-style:italic;font-size:24px;line-height:1.35;margin:16px 0 22px;border-left:3px solid #E0576F;padding-left:16px}
  .win{font-size:30px;margin:0 0 8px}
  .line{font-style:italic;color:rgba(245,236,225,.85);margin:0 0 20px}
  .metric{border-left:2px solid rgba(224,87,111,.4);padding-left:14px;margin:0 0 16px}
  .metric b{display:block;color:rgba(245,236,225,.5);font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.18em;margin-bottom:4px}
  .metric p{margin:0;color:rgba(245,236,225,.78);font-size:15px}
  .tab{border:1px solid rgba(245,236,225,.14);border-radius:12px;padding:14px;margin:18px 0}
  .tab .row{display:flex;gap:12px;align-items:baseline;margin-top:8px;font-family:system-ui,sans-serif;font-size:14px}
  .tab .score{color:#C9A86A;font-family:Georgia,serif;font-size:17px;min-width:28px;text-align:right}
  .closing{border:1px solid rgba(201,168,106,.35);border-radius:12px;padding:14px;color:#C9A86A;font-style:italic;margin:0 0 20px}
  .foot{color:rgba(245,236,225,.45);font-size:13px;font-family:system-ui,sans-serif}
  .cta{display:block;text-align:center;background:#E0576F;color:#120A0E;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;border-radius:12px;padding:14px;margin:24px 0 8px}
  .watch{display:block;text-align:center;color:rgba(245,236,225,.6);font-family:system-ui,sans-serif;font-size:14px;text-decoration:none;border:1px solid rgba(245,236,225,.18);border-radius:12px;padding:12px}
</style></head><body><div class="card">
<div class="kick">THE ADJUDICATOR RULED</div>
<div class="motion">“${esc(d.motion)}”</div>
<h1 class="win"><span style="color:${winColor}">${esc(d.winner)}</span> takes the floor</h1>
<p class="line">${esc(d.verdictLine)}</p>
${r.verdict.matter ? `<div class="metric"><b>MATTER — LOGIC · EVIDENCE · FACT</b><p>${esc(r.verdict.matter)}</p></div>` : ''}
${r.verdict.manner ? `<div class="metric"><b>MANNER — DELIVERY · STRUCTURE · CONTROL</b><p>${esc(r.verdict.manner)}</p></div>` : ''}
${speakers.length ? `<div class="tab"><b style="color:rgba(245,236,225,.5);font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.18em">THE TAB — SPEAKER SCORES</b>${speakers.map((sp: any) => `<div class="row"><span style="min-width:86px;letter-spacing:.06em;color:${String(sp.role || '').startsWith('PRO') ? '#78C8FF' : '#E0576F'}">${esc(sp.role || '')}${sp.seat === r.verdict.best_speaker ? ' ★' : ''}</span><span class="score">${sp.score | 0}</span><span style="color:rgba(245,236,225,.6)">${esc(sp.line || '')}</span></div>`).join('')}</div>` : ''}
${r.verdict.closing ? `<div class="closing">${esc(r.verdict.closing)}</div>` : ''}
<div class="foot"><span style="color:#78C8FF">PRO</span> ${sideLine('PRO')} · <span style="color:#E0576F">CON</span> ${sideLine('CON')}${d.crowd && d.crowd.total ? ` · the room: ${d.crowd.pro}–${d.crowd.con}` : ''}${d.date ? ' · ' + new Date(d.date).toDateString() : ''}</div>
<a class="cta" href="https://callmez.app">settle your own argument on callmeZ</a>
<a class="watch" href="/watch/${sid}">replay the full duel</a>
</div></body></html>`);
    } catch (e: any) { res.status(500).send('verdict page failed'); }
  });
}

// ── THE SWEEPER (60s tick, the pings pattern) ────────────────────────────
// Two jobs, both deterministic:
//  1. LAPSED SLOTS: a timed slot past bell+grace force-advances with the on-record
//     "time" note — the engine's forceLapse runs the same law a spoken turn does
//     (house turns follow, a ripe floor adjudicates), persisted behind the same
//     version fence the move route uses. Never a hang.
//  2. ABANDONMENT: a live record whose session sits unfinished past 48h is marked
//     abandoned (verdict stays null — never fabricated). Sessions themselves are
//     untouched (existing behavior is sacred); a late real completion finalizes done.
let sweeping = false;
export function startBattlefieldSweeper(): void {
  const tick = async () => {
    if (sweeping) return;   // never overlap — a lapse turn can take model-seconds
    sweeping = true;
    try {
      const { data: rows } = await supabase.from('game_sessions')
        .select('id, thread_id, seats, state, version, updated_at')
        .eq('game', 'battlefield_duel').eq('status', 'live').limit(50);
      for (const s of (rows || []) as any[]) {
        const st = (s.state || {}) as BFState;
        // job 1: the bell
        if (slotLapsed(st)) {
          try {
            const state = await forceLapse(st, s.seats as any[]);
            const over = battlefieldDuelAdapter.isOver(state as any);
            const { data: upd } = await supabase.from('game_sessions')
              .update({ state, version: s.version + 1, status: over ? 'over' : 'live', updated_at: new Date().toISOString() })
              .eq('id', s.id).eq('version', s.version)   // the same concurrency fence as /move
              .select('version').maybeSingle();
            if (upd && over) await finalizeBattlefieldRecord(s.id, { state: state as any, seats: s.seats as any[] });
          } catch (e: any) { console.error('[bf-sweep] lapse failed for', s.id, e?.message || e); }
          continue;   // one job per session per tick — the next tick reassesses
        }
      }
      // job 2: THE RECORD SWEEP — live records reconciled against their sessions.
      // A session already over with a verdict → finalize (heals any missed flip,
      // forever); a session unfinished past 48h → abandoned, verdict stays null.
      const { data: recs } = await supabase.from('battlefield_record')
        .select('session_id').eq('status', 'live').limit(50);
      const ids = (recs || []).map((r: any) => r.session_id);
      if (ids.length) {
        const { data: sess } = await supabase.from('game_sessions')
          .select('id, status, state, seats, updated_at').in('id', ids);
        for (const s2 of (sess || []) as any[]) {
          const st2 = (s2.state || {}) as BFState;
          try {
            if (s2.status === 'over' && (st2.phase as string) === 'verdict') {
              await finalizeBattlefieldRecord(s2.id, { state: st2, seats: s2.seats as any[] });
            } else if (Date.now() - Date.parse(s2.updated_at) > ABANDON_AFTER_MS) {
              await supabase.from('battlefield_record')
                .update({ status: 'abandoned', ended_at: new Date().toISOString() })
                .eq('session_id', s2.id).eq('status', 'live');
            }
          } catch (e: any) { console.error('[bf-sweep] record sweep failed for', s2.id, e?.message || e); }
        }
      }
      // job 3: §7 AUDIO RETENTION — finished duels older than 30 days lose their
      // voice (both buckets), keep their transcript. Stamped once per record.
      try {
        const cutoff = new Date(Date.now() - AUDIO_RETENTION_MS).toISOString();
        const { data: aged } = await supabase.from('battlefield_record')
          .select('session_id').lt('ended_at', cutoff).is('audio_purged_at', null)
          .not('ended_at', 'is', null).limit(10);
        for (const r of (aged || []) as any[]) {
          try { await purgeSessionAudio(r.session_id); }
          catch (e: any) { console.error('[bf-sweep] audio purge failed for', r.session_id, e?.message || e); }
        }
      } catch (e: any) { console.error('[bf-sweep] retention scan failed:', e?.message || e); }
    } catch (e: any) { console.error('[bf-sweep] tick failed:', e?.message || e); }
    finally { sweeping = false; }
  };
  setInterval(tick, 60 * 1000);
  console.log('[battlefield] sweeper armed (lapse + abandonment, 60s tick)');
}
