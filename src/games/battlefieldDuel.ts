// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE BATTLEFIELD DUEL. The SERIOUS, structured, adjudicated debate
//  (distinct from the arena's light debateDuel). Assigned PRO/CON, three timed
//  phases (Opening → Rebuttal → Closing), turn-locked, server-side transcript.
//  The PROVEN Tyrion adjudicator (battlefieldAdjudicator.ts) reads the full
//  transcript and delivers the real Matter/Manner verdict — this adapter does
//  NOT judge; it runs the floor and calls the judge.
//
//  Rides the sessions adapter interface (create/move/ai/view/isOver/toActSeat),
//  registered in GAME_ENGINES as 'battlefield_duel'.
//
//  House opponent: when a persona seat is to act, generation happens INSIDE the
//  async move() (advanceAI is sync and can't await) — see the house turn below.
//  This keeps all async confined to this adapter; ai() stays a no-op.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usage.js';
import { finalVerdict, runningNote, type DebateDomain, type Verdict } from '../battlefieldAdjudicator.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

// ── fact-based motions, each tagged with the adjudicator's domain corpus ──
export const MOTIONS: { motion: string; domain: DebateDomain }[] = [
  { motion: 'This house believes economic sanctions do more to entrench regimes than to weaken them.', domain: 'geopolitics' },
  { motion: 'This house believes judicial review is incompatible with democracy.', domain: 'law' },
  { motion: 'This house believes the Treaty of Versailles was the primary cause of the Second World War.', domain: 'history' },
  { motion: 'This house believes free markets allocate resources more justly than the state.', domain: 'economy' },
  { motion: 'This house believes nuclear deterrence has made great-power war less likely.', domain: 'war' },
  { motion: 'This house believes secular government is a precondition for a free society.', domain: 'religion' },
  { motion: 'This house believes democracies are structurally worse at responding to climate change.', domain: 'environment' },
  { motion: 'This house believes the regulation of artificial intelligence should precede its deployment.', domain: 'technology' },
  { motion: 'This house believes political legitimacy rests on consent rather than outcomes.', domain: 'democracy' },
  { motion: 'This house believes the ends can justify the means in public life.', domain: 'philosophy' },
];

const PHASES = ['Opening', 'Rebuttal', 'Closing'] as const;
type Phase = (typeof PHASES)[number];

export type BFTurn = { seat: 0 | 1; role: Phase; text: string };
export type BFState = {
  kind: 'battlefield_duel';
  motion: string;
  domain: DebateDomain;
  phase: Phase | 'verdict';
  phaseIndex: number;          // 0..2 across PHASES
  turns: BFTurn[];             // the full transcript
  toAct: 0 | 1;                // seat 0 = PRO, seat 1 = CON
  // per-phase order: PRO speaks first in Opening & Closing; CON first in Rebuttal
  // (real debate: the side under attack answers, so Rebuttal opens with CON on PRO).
  notes: { phase: Phase; note: string }[];   // the commentary track (optional running read)
  verdict: Verdict | null;
  winner: 'PRO' | 'CON' | null;
  judging: boolean;
  error: string | null;
};

// PRO=0 leads Opening & Closing; CON=1 leads Rebuttal (answers the attack first).
function leadSeat(phaseIndex: number): 0 | 1 { return phaseIndex === 1 ? 1 : 0; }

export function newBattlefield(opts?: { motion?: string; domain?: DebateDomain }): BFState {
  const pick = (opts?.motion && opts?.domain)
    ? { motion: opts.motion, domain: opts.domain }
    : MOTIONS[Math.floor(Math.random() * MOTIONS.length)];
  return {
    kind: 'battlefield_duel',
    motion: pick.motion,
    domain: pick.domain,
    phase: 'Opening',
    phaseIndex: 0,
    turns: [],
    toAct: leadSeat(0),
    notes: [],
    verdict: null,
    winner: null,
    judging: false,
    error: null,
  };
}

// how many turns each seat has taken in the current phase (each phase = one per side)
function turnsInPhase(state: BFState, phaseIndex: number): BFTurn[] {
  const role = PHASES[phaseIndex];
  return state.turns.filter((t) => t.role === role);
}

// advance the floor after a turn is recorded: swap speaker, or roll to next phase /
// to the verdict. Returns whether the phase just completed (for the running note).
function advanceFloor(state: BFState): { phaseComplete: boolean } {
  const done = turnsInPhase(state, state.phaseIndex);
  if (done.length >= 2) {
    // phase complete → next phase or verdict
    if (state.phaseIndex >= PHASES.length - 1) {
      state.phase = 'verdict';
      return { phaseComplete: true };
    }
    state.phaseIndex += 1;
    state.phase = PHASES[state.phaseIndex];
    state.toAct = leadSeat(state.phaseIndex);
    return { phaseComplete: true };
  }
  // still in phase → the other side answers
  state.toAct = (1 - state.toAct) as 0 | 1;
  return { phaseComplete: false };
}

// ── the house opponent: generate a real argument for its assigned side ──
// Voice: a sharp, disciplined debater. Argues the SIDE it was assigned, in the
// CURRENT phase's job (open the case / rebut the opponent / close — no new args).
const HOUSE_SOUL = `You are THE HOUSE — callmeZ's in-house debate opponent on the Battlefield. You are a formidable, disciplined debater: clear, forensic, and relentless, but never a bully and never a liar. You argue the SIDE you are assigned, whether or not you privately agree — arguing an assigned position is the craft. You build real arguments with real reasoning; you never invent facts or statistics, because the adjudicator will catch a fabrication and it will cost you. You stay strictly within the current phase's job.`;

function phaseJob(phase: Phase, side: 'PRO' | 'CON'): string {
  if (phase === 'Opening') return `Deliver your OPENING as ${side}: state your strongest case for your side of the motion. Build the frame. Do not rebut yet — there is nothing to rebut.`;
  if (phase === 'Rebuttal') return `Deliver your REBUTTAL as ${side}: attack the specific weak points in your opponent's opening. Name what they claimed and dismantle it. This is where the debate sharpens.`;
  return `Deliver your CLOSING as ${side}: crystallise why your side won the clash. NO new arguments — that is a debate foul. Land the case you already built.`;
}

async function houseTurn(state: BFState): Promise<string> {
  const seat = state.toAct;
  const side: 'PRO' | 'CON' = seat === 0 ? 'PRO' : 'CON';
  const phase = state.phase as Phase;
  const transcript = state.turns.length
    ? state.turns.map((t) => `${t.seat === 0 ? 'PRO' : 'CON'} (${t.role}): ${t.text}`).join('\n\n')
    : '(no speeches yet — you open the floor)';
  const system = `${HOUSE_SOUL}\n\nTHE MOTION: "${state.motion}"\nYOU ARE: ${side}. ${side === 'PRO' ? 'You argue FOR the motion.' : 'You argue AGAINST the motion.'}\nCURRENT PHASE: ${phase}. ${phaseJob(phase, side)}\n\nWrite ONLY your speech — no stage directions, no "as ${side} I would say", just the argument itself. Keep it tight: 3-6 sentences, the register of a serious debate floor.`;
  try {
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: 500, temperature: 0.6, system,
      messages: [{ role: 'user', content: `THE FLOOR SO FAR:\n${transcript}\n\nDeliver your ${phase} now.` }],
    });
    logUsage({ userId: 'battlefield', surface: 'other', model: MODEL, usage: msg.usage });
    const text = (msg.content?.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || '').trim();
    return text.slice(0, 1400) || '(the house holds its tongue)';
  } catch (e: any) {
    return '(the house was unable to respond this turn)';
  }
}

// record a speech into the transcript, then advance the floor + (optionally) take a
// running note. Shared by human moves and the house turn.
async function recordAndAdvance(state: BFState, seat: 0 | 1, text: string): Promise<void> {
  const role = state.phase as Phase;
  state.turns.push({ seat, role, text });
  const { phaseComplete } = advanceFloor(state);
  // the commentary track: after a completed phase (both sides spoke), one running read.
  if (phaseComplete && state.phase !== 'verdict') {
    try {
      const phaseTurns = state.turns.filter((t) => t.role === role);
      const note = await runningNote({
        domain: state.domain, motion: state.motion,
        seatA_role: 'PRO', seatB_role: 'CON',
        lastExchange: phaseTurns.map((t) => ({ seat: t.seat, role: t.role, text: t.text })),
        momentumA: 50,
      });
      if (note?.note) state.notes.push({ phase: role, note: note.note });
    } catch { /* running note is best-effort — never blocks the duel */ }
  }
}

// when the floor reaches 'verdict', call the PROVEN adjudicator. Never fabricate a
// winner — if adjudication throws, surface it loudly (state.error), don't invent.
async function adjudicate(state: BFState): Promise<void> {
  if (state.judging || state.verdict) return;
  state.judging = true;
  try {
    const v = await finalVerdict({
      domain: state.domain,
      motion: state.motion,
      fullTranscript: state.turns.map((t) => ({ seat: t.seat, role: t.role, text: t.text })),
    });
    state.verdict = v;
    state.winner = v.winner;
  } catch (e: any) {
    // the adjudicator failed loudly (adjudication_failed). Do NOT default a winner.
    state.error = 'adjudication_failed';
    console.error('[battlefield_duel] verdict failed — no winner defaulted:', e?.message || e);
  } finally {
    state.judging = false;
  }
}

export const battlefieldDuelAdapter = {
  minSeats: 2, maxSeats: 2, humanOnly: false,
  // the route calls create(seats, options); the diagnostic calls create({motion,domain}).
  // motion/domain arrive either as the first arg (diagnostic) or in options (route).
  create(a?: any, b?: any) {
    const opts = (a && (a.motion || a.domain)) ? a : (b || {});
    return newBattlefield({ motion: opts.motion, domain: opts.domain });
  },

  async move(state: BFState, seat: number, mv: any, seats?: any[]): Promise<BFState> {
    if (mv?.type === 'next') return state;   // no-op advance (reveal steps, if any)
    if (mv?.type !== 'speech') throw new Error('unknown move');
    if (state.phase === 'verdict') throw new Error('the duel is over');
    if (seat !== state.toAct) throw new Error('not your turn');
    const text = String(mv.text || '').trim().slice(0, 1400);
    if (text.length < 10) throw new Error('a speech must carry some weight');

    await recordAndAdvance(state, seat as 0 | 1, text);

    // if the floor now points at a PERSONA (house) seat, take its turn(s) here — inside
    // async move(), because advanceAI is synchronous and cannot await the model.
    const roster: any[] = seats || [];
    let guard = 0;
    while ((state.phase as string) !== 'verdict' && guard++ < 8) {
      const nextSeat = roster[state.toAct];
      if (!nextSeat || nextSeat.kind !== 'persona') break;   // human to act → stop, wait for them
      const houseText = await houseTurn(state);
      await recordAndAdvance(state, state.toAct, houseText);
    }

    if ((state.phase as string) === 'verdict') await adjudicate(state);
    return state;
  },

  // ai() stays a no-op: the house turn is handled inside async move() above, because
  // the sessions layer drives ai() synchronously and cannot await a model call.
  ai(state: BFState) { return state; },

  // nothing hidden in a debate — everyone sees the same floor.
  view(state: BFState) { return state; },

  isOver: (s: BFState) => s.phase === 'verdict' && (!!s.verdict || !!s.error),
  toActSeat: (s: BFState) => (s.phase === 'verdict' ? -1 : s.toAct),
};
