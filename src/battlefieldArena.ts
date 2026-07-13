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
import { battlefieldDuelAdapter, newBattlefield, stampSlot, slotLapsed, forceLapse, type BFState } from './games/battlefieldDuel.js';

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;   // spec: challenges expire in 7 days (lazy)
const ABANDON_AFTER_MS = 48 * 60 * 60 * 1000;        // declared default: dead past 48h → abandoned

type AuthFn = (req: express.Request) => Promise<string | null>;

// ── THE RECORD ────────────────────────────────────────────────────────────

function sidesOf(seats: any[]): any[] {
  const ent = (x: any) => x?.kind === 'user' ? { user_id: x.id } : x?.kind === 'persona' ? { persona: x.id || x.key || 'the_house' } : { open: true };
  return [
    { side: 'PRO', seats: [ent(seats?.[0])] },
    { side: 'CON', seats: [ent(seats?.[1])] },
  ];
}

export async function insertBattlefieldRecord(sessionId: string, state: BFState, seats: any[], visibility: 'public' | 'link' | 'private'): Promise<void> {
  try {
    await supabase.from('battlefield_record').insert({
      session_id: sessionId,
      format_key: 'duel',
      motion: state.motion,
      domain: state.domain,
      sides: sidesOf(seats),
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
export async function finalizeBattlefieldRecord(sessionId: string): Promise<void> {
  try {
    const { data: s } = await supabase.from('game_sessions').select('id, state, seats').eq('id', sessionId).maybeSingle();
    if (!s) return;
    const st = (s.state || {}) as BFState;
    if ((st.phase as string) !== 'verdict') return;
    const verdict = st.verdict
      ? {
          winner: st.verdict.winner,
          verdict_line: st.verdict.adjVerdict,
          summary: st.verdict.summary,
          matter: st.verdict.matter,
          manner: st.verdict.manner,
          closing: st.verdict.closing,
        }
      : (st.error ? { failed: st.error } : null);
    await supabase.from('battlefield_record').update({
      status: 'done',
      verdict,
      crowd: await crowdTally(sessionId),
      sides: sidesOf(s.seats as any[]),   // refresh — a claimed seat postdates the insert
      ended_at: new Date().toISOString(),
    }).eq('session_id', sessionId);
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
      const timed = req.body?.timed === true;
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
        challenger_side: side, timed, status: 'open',
      }).select('id').single();
      if (error || !ch) return res.status(500).json({ error: error?.message || 'challenge insert failed' });
      res.json({
        challengeId: ch.id,
        fightPath: `/fight/${ch.id}`,   // rides the claim-link pattern, served like /watch/:id
        motion, domain: finalDomain, side, timed,
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
        timed: !!ch.timed, sessionId: ch.session_id || null,
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
      const state = newBattlefield({ motion: ch.motion, domain, difficulty: 'normal', notesOn: true, timed: !!ch.timed });
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

      await insertBattlefieldRecord(sess.id, state, seats, 'link');   // a settled argument is the parties' to share
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
        crowd: r.crowd || null,
        date: r.ended_at,
        watchPath: `/watch/${r.session_id}`,
      });
    } catch (e: any) { res.status(500).json({ error: 'verdict read failed: ' + (e?.message || String(e)) }); }
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
            if (upd && over) await finalizeBattlefieldRecord(s.id);
          } catch (e: any) { console.error('[bf-sweep] lapse failed for', s.id, e?.message || e); }
          continue;   // one job per session per tick — the next tick reassesses
        }
        // job 2: abandonment
        if (Date.now() - Date.parse(s.updated_at) > ABANDON_AFTER_MS) {
          try {
            await supabase.from('battlefield_record')
              .update({ status: 'abandoned', ended_at: new Date().toISOString() })
              .eq('session_id', s.id).eq('status', 'live');
          } catch (e: any) { console.error('[bf-sweep] abandon mark failed for', s.id, e?.message || e); }
        }
      }
    } catch (e: any) { console.error('[bf-sweep] tick failed:', e?.message || e); }
    finally { sweeping = false; }
  };
  setInterval(tick, 60 * 1000);
  console.log('[battlefield] sweeper armed (lapse + abandonment, 60s tick)');
}
