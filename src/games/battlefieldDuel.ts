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
  // History's Turning Points
  { motion: 'This house believes the Treaty of Versailles was the primary cause of the Second World War.', domain: 'history' },
  { motion: 'This house believes the Industrial Revolution did more to liberate the common person than any political revolution.', domain: 'history' },
  { motion: 'This house believes the fall of the Roman Empire owed more to internal decay than to external invasion.', domain: 'history' },
  { motion: 'This house believes colonial empires retarded rather than accelerated the development of the societies they ruled.', domain: 'history' },
  { motion: 'This house believes the printing press reshaped society more profoundly than the internet has.', domain: 'history' },
  // The Global Economy
  { motion: 'This house believes free markets allocate resources more justly than the state.', domain: 'economy' },
  { motion: 'This house believes free trade has done more to reduce global poverty than foreign aid.', domain: 'economy' },
  { motion: 'This house believes minimum wage laws help the workers they are intended to protect.', domain: 'economy' },
  { motion: 'This house believes central bank independence produces better outcomes than elected control of monetary policy.', domain: 'economy' },
  { motion: 'This house believes inflation is primarily a monetary phenomenon rather than a product of supply shocks.', domain: 'economy' },
  // Geopolitics & World Order
  { motion: 'This house believes economic sanctions do more to entrench regimes than to weaken them.', domain: 'geopolitics' },
  { motion: 'This house believes a multipolar world order is more stable than a unipolar one.', domain: 'geopolitics' },
  { motion: 'This house believes economic interdependence makes war between great powers less likely.', domain: 'geopolitics' },
  { motion: 'This house believes foreign military intervention more often prolongs conflicts than resolves them.', domain: 'geopolitics' },
  { motion: 'This house believes international institutions meaningfully constrain the behaviour of powerful states.', domain: 'geopolitics' },
  // Law, Justice & Rights
  { motion: 'This house believes judicial review is incompatible with democracy.', domain: 'law' },
  { motion: 'This house believes a written constitution protects rights better than an unwritten one.', domain: 'law' },
  { motion: 'This house believes mandatory minimum sentences do more harm than good.', domain: 'law' },
  { motion: 'This house believes the death penalty deters serious crime more effectively than life imprisonment.', domain: 'law' },
  { motion: 'This house believes plea bargaining undermines the pursuit of justice.', domain: 'law' },
  // Democracy & Governance
  { motion: 'This house believes political legitimacy rests on consent rather than outcomes.', domain: 'democracy' },
  { motion: 'This house believes proportional representation produces more representative government than first-past-the-post.', domain: 'democracy' },
  { motion: 'This house believes compulsory voting strengthens democracy.', domain: 'democracy' },
  { motion: 'This house believes referendums produce worse policy than representative democracy.', domain: 'democracy' },
  { motion: 'This house believes term limits improve the quality of governance.', domain: 'democracy' },
  // Political Philosophy & Ethics
  { motion: 'This house believes the ends can justify the means in public life.', domain: 'philosophy' },
  { motion: 'This house believes moral responsibility is incompatible with a fully determined universe.', domain: 'philosophy' },
  { motion: 'This house believes a just society should prioritise equality of outcome over equality of opportunity.', domain: 'philosophy' },
  { motion: 'This house believes individual liberty should take precedence over collective welfare when the two conflict.', domain: 'philosophy' },
  { motion: 'This house believes objective moral truths exist independently of human belief.', domain: 'philosophy' },
  // War, Security & Just War
  { motion: 'This house believes nuclear deterrence has made great-power war less likely.', domain: 'war' },
  { motion: 'This house believes pre-emptive war can be morally justified.', domain: 'war' },
  { motion: 'This house believes the concept of a just war is coherent and defensible.', domain: 'war' },
  { motion: 'This house believes drone warfare has made armed conflict more ethical, not less.', domain: 'war' },
  { motion: 'This house believes conscription is a legitimate demand a state may make of its citizens.', domain: 'war' },
  // Technology Governance
  { motion: 'This house believes the regulation of artificial intelligence should precede its deployment.', domain: 'technology' },
  { motion: 'This house believes social media has done more to harm democratic discourse than to help it.', domain: 'technology' },
  { motion: 'This house believes encryption backdoors for law enforcement make society less safe overall.', domain: 'technology' },
  { motion: 'This house believes automation will destroy more jobs than it creates.', domain: 'technology' },
  { motion: 'This house believes data privacy is a right that should not be tradeable for services.', domain: 'technology' },
  // Religion, Secularism & the State
  { motion: 'This house believes secular government is a precondition for a free society.', domain: 'religion' },
  { motion: 'This house believes faith-based schools deepen social division.', domain: 'religion' },
  { motion: 'This house believes the separation of religion and state has strengthened rather than weakened religion.', domain: 'religion' },
  { motion: 'This house believes blasphemy laws have no place in a modern legal system.', domain: 'religion' },
  { motion: 'This house believes religious exemptions from general law undermine equality before the law.', domain: 'religion' },
  // Environment & Climate Policy
  { motion: 'This house believes democracies are structurally worse at responding to climate change.', domain: 'environment' },
  { motion: 'This house believes nuclear power is essential to any realistic path to decarbonisation.', domain: 'environment' },
  { motion: 'This house believes carbon taxes are more effective than regulation at cutting emissions.', domain: 'environment' },
  { motion: 'This house believes economic growth and environmental sustainability are fundamentally incompatible.', domain: 'environment' },
  { motion: 'This house believes individual action is largely irrelevant to solving climate change compared with systemic change.', domain: 'environment' },
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
  difficulty: 'normal' | 'pro';
};

// PRO=0 leads Opening & Closing; CON=1 leads Rebuttal (answers the attack first).
function leadSeat(phaseIndex: number): 0 | 1 { return phaseIndex === 1 ? 1 : 0; }

export function newBattlefield(opts?: { motion?: string; domain?: DebateDomain; difficulty?: 'normal' | 'pro' }): BFState {
  const rand = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
  // pin exactly if both given; else a random motion within the requested domain;
  // else a fully random motion. (domain-only used to fall through to fully random.)
  const pick = (opts?.motion && opts?.domain)
    ? { motion: opts.motion, domain: opts.domain }
    : opts?.domain
      ? (MOTIONS.filter((m) => m.domain === opts.domain).length
          ? rand(MOTIONS.filter((m) => m.domain === opts.domain))   // motion within the requested domain
          : rand(MOTIONS))
      : rand(MOTIONS);
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
    difficulty: opts?.difficulty === 'pro' ? 'pro' : 'normal',
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

const HOUSE_NORMAL = `\n\n[NORMAL MODE \u2014 you are sparring with an AMATEUR, not a champion. Argue your side clearly and FAIRLY in plain language, at a level a beginner can answer. Make a real but BEATABLE case: one or two clean points, no piling on, no burying them in erudition, no exploiting every gap. You are a friendly sparring partner helping them find their footing \u2014 not a wall. Keep it short and accessible.]`;

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
  const system = `${HOUSE_SOUL}\n\nTHE MOTION: "${state.motion}"\nYOU ARE: ${side}. ${side === 'PRO' ? 'You argue FOR the motion.' : 'You argue AGAINST the motion.'}\nCURRENT PHASE: ${phase}. ${phaseJob(phase, side)}\n\nWrite ONLY your speech — no stage directions, no "as ${side} I would say", just the argument itself. Keep it tight: 3-6 sentences, the register of a serious debate floor.${state.difficulty !== 'pro' ? HOUSE_NORMAL : ''}`;
  try {
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: 500, temperature: 0.6, system,
      messages: [{ role: 'user', content: `THE FLOOR SO FAR:\n${transcript}\n\nDeliver your ${phase} now.` }],
    });
    logUsage({ userId: 'battlefield', surface: 'other', fn: 'bf_house_turn', model: MODEL, usage: msg.usage });
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
        difficulty: state.difficulty,
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
      difficulty: state.difficulty,
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
    return newBattlefield({ motion: opts.motion, domain: opts.domain, difficulty: opts.difficulty });
  },

  async move(state: BFState, seat: number, mv: any, seats?: any[]): Promise<BFState> {
    if (mv?.type === 'next') return state;   // no-op advance (reveal steps, if any)
    if (mv?.type !== 'speech') throw new Error('unknown move');
    if ((seats || []).some((x: any) => x?.kind === 'open')) throw new Error('waiting for the opponent to take their seat');
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
