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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { llm } from '../llm.js';
import { logUsage } from '../usage.js';
import { finalVerdict, runningNote, type DebateDomain, type Verdict } from '../battlefieldAdjudicator.js';

const anthropic = llm();   // [zip35] the second generator — sweep completion
const MODEL = 'claude-haiku-4-5-20251001';

// ── FORMAT MODULES (fork #1 ruling): formats are AUTHORED, VERSIONED JSON, phases
// as data, boot-loaded on sessionLoop's exact discipline — zero model cost to load.
// Phase 2 reads ONLY per-slot seconds off the order array (the timing ruling:
// timers are format-module data, never engine constants; null = untimed slot);
// phase 3 flips the floor itself to read the order array. The deterministic hard
// floor stays HERE, in this adapter — a debate advances by law, never by a model's
// judgment (the two floors are opposite by product nature; sessionLoop untouched).
export interface BattleSlot {
  side: 'pro' | 'con'; seat: number; role: string; label: string; seconds: number | null;
  job?: string;         // the ROLE's instruction (what a PM must establish; a whip's no-new-matter law) — format knowledge is DATA
  noteAfter?: boolean;  // the commentary drops after this slot (an exchange completed)
}
export interface BattleFormat { key: string; label: string; perSide: number; order: BattleSlot[]; adjModule?: string; }
const __bfDir = path.dirname(fileURLToPath(import.meta.url));
const bfFormats: Record<string, BattleFormat> = {};
try {
  const dir = path.join(__bfDir, '..', 'content', 'battlefield', 'formats');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    try {
      const fmt: BattleFormat = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
      if (fmt?.key && Array.isArray(fmt.order) && fmt.order.length) bfFormats[fmt.key] = fmt;
    } catch (e) { console.error('[battlefield] format load failed:', f, e); }
  }
} catch (e) { console.error('[battlefield] formats dir missing:', e); }
console.log('[battlefield] formats loaded:', Object.keys(bfFormats).join(', ') || '(none)');
export const battleFormat = (key: string): BattleFormat | null => bfFormats[key] || null;
export const battleFormatKeys = (): string[] => Object.keys(bfFormats);

// ── THE FLOOR LAW (phase 3): the floor IS the order array. slotIndex = turns.length —
// deterministic, migration-free (the legacy duel's turn sequence matches duel.json's
// order exactly, so live sessions inherit the new law without a shim). All floor
// facts derive from the format module; the advance is arithmetic, never a model.
export function stateFormat(state: BFState): BattleFormat {
  return battleFormat(state.formatKey || 'duel') || battleFormat('duel')!;
}
function currentSlot(state: BFState): BattleSlot | null {
  if ((state.phase as string) === 'verdict') return null;
  return stateFormat(state).order[state.turns.length] || null;
}
// a seat's side + public tag ("PRO 2" in teams, "PRO" in a 1v1), from the module alone
export function seatSide(fmt: BattleFormat, seat: number): 'PRO' | 'CON' {
  const slot = fmt.order.find((o) => o.seat === seat);
  return slot?.side === 'con' ? 'CON' : 'PRO';
}
export function speakerTag(fmt: BattleFormat, seat: number): string {
  const side = seatSide(fmt, seat);
  if ((fmt.perSide || 1) <= 1) return side;
  const sameSide = [...new Set(fmt.order.filter((o) => (o.side === 'con' ? 'CON' : 'PRO') === side).map((o) => o.seat))].sort((a, b) => a - b);
  return `${side} ${sameSide.indexOf(seat) + 1}`;
}

// stamp the clock for the slot that just opened. The server owns the truth:
// slotStartedAt + slotSeconds live in state; the client renders the countdown.
// No-op for untimed duels and null-second slots.
export function stampSlot(state: BFState): void {
  if (!state.timed || state.phase === 'verdict') { state.slotStartedAt = null; state.slotSeconds = null; return; }
  const slot = currentSlot(state);
  const secs = slot?.seconds ?? null;
  state.slotStartedAt = secs ? new Date().toISOString() : null;
  state.slotSeconds = secs ? Math.round(secs * (state.timeScale === 0.5 ? 0.5 : 1)) : null;
}

const GRACE_MS = 10_000;   // the spec's grace(10s) past the bell
export function slotLapsed(state: BFState): boolean {
  if (!state.timed || !state.slotStartedAt || !state.slotSeconds || state.phase === 'verdict') return false;
  return Date.now() > Date.parse(state.slotStartedAt) + state.slotSeconds * 1000 + GRACE_MS;
}

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

type Phase = string;   // the role label of the current slot — 'Opening' … 'PM' … 'Final Focus'

export type BFTurn = { seat: number; role: string; text: string; audio?: string | null; lapsed?: boolean };
export type BFState = {
  kind: 'battlefield_duel';
  formatKey?: string;          // 'duel' | 'pf' | 'ap' | any authored module; absent = duel (legacy)
  motion: string;
  domain: DebateDomain;
  phase: Phase | 'verdict';    // display: the current slot's role
  phaseIndex: number;          // the current SLOT index (phase 3: the floor's true counter)
  turns: BFTurn[];             // the full transcript
  toAct: number;               // the current slot's seat (-1 at verdict)
  notes: { phase: Phase; note: string }[];   // the commentary track (optional running read)
  notesOn: boolean;            // the commentary TIER (LITE lever 3): ON for spectated/shared
                               // duels — the commentary is the spectator product — OFF for
                               // private practice. Old sessions lack the field → treated ON.
  // THE CLOCK (§5, phase 2): per-slot seconds come from the FORMAT MODULE, never
  // engine constants. Old sessions lack these fields → untimed (regression-safe).
  timed: boolean;              // opt-in at create; ranked-per-module comes with the ladder
  timeScale: 1 | 0.5;          // creator scale (spec: 0.5×/1×)
  slotStartedAt: string | null;   // ISO — stamped when a slot opens on a LIVE floor
  slotSeconds: number | null;     // this slot's budget after scale (client renders; server owns truth)
  verdict: Verdict | null;
  winner: 'PRO' | 'CON' | null;
  judging: boolean;
  error: string | null;
  difficulty: 'normal' | 'pro';
};

export function newBattlefield(opts?: { motion?: string; domain?: DebateDomain; difficulty?: 'normal' | 'pro'; notesOn?: boolean; timed?: boolean; timeScale?: 1 | 0.5; format?: string }): BFState {
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
  const fmt = battleFormat(opts?.format || 'duel') || battleFormat('duel')!;
  return {
    kind: 'battlefield_duel',
    formatKey: fmt.key,
    motion: pick.motion,
    domain: pick.domain,
    phase: fmt.order[0].role,
    phaseIndex: 0,
    turns: [],
    toAct: fmt.order[0].seat,
    notes: [],
    notesOn: opts?.notesOn === false ? false : true,
    timed: opts?.timed === true,
    timeScale: opts?.timeScale === 0.5 ? 0.5 : 1,
    slotStartedAt: null,   // stamped by the route once the floor is LIVE (both seats filled)
    slotSeconds: null,
    verdict: null,
    winner: null,
    judging: false,
    error: null,
    difficulty: opts?.difficulty === 'pro' ? 'pro' : 'normal',
  };
}

// advance the floor after a turn is recorded: the next slot in the order array, or
// the verdict when the array is spent. Pure arithmetic — a debate advances by law.
// noteComplete = the slot just spoken carried the module's noteAfter flag (an
// exchange completed; the commentary drops). Legacy duel states (no noteAfter era)
// still note correctly: duel.json carries the flags.
function advanceFloor(state: BFState): { noteComplete: boolean; spokenSlot: BattleSlot | null } {
  const fmt = stateFormat(state);
  const spoken = fmt.order[state.turns.length - 1] || null;   // the slot just recorded
  if (state.turns.length >= fmt.order.length) {
    state.phase = 'verdict';
    state.toAct = -1;
    state.phaseIndex = fmt.order.length;
    return { noteComplete: !!spoken?.noteAfter, spokenSlot: spoken };
  }
  const next = fmt.order[state.turns.length];
  state.phaseIndex = state.turns.length;
  state.phase = next.role;
  state.toAct = next.seat;
  return { noteComplete: !!spoken?.noteAfter, spokenSlot: spoken };
}

// the turns of the exchange that just completed: everything since the PREVIOUS
// noteAfter slot (or the floor's start) — deterministic from the module alone.
function exchangeTurns(state: BFState): BFTurn[] {
  const fmt = stateFormat(state);
  const end = state.turns.length;   // exclusive
  let start = 0;
  for (let i = end - 2; i >= 0; i--) { if (fmt.order[i]?.noteAfter) { start = i + 1; break; } }
  return state.turns.slice(start, end);
}

// ── the house opponent: generate a real argument for its assigned side ──
// Voice: a sharp, disciplined debater. Argues the SIDE it was assigned, in the
// CURRENT phase's job (open the case / rebut the opponent / close — no new args).
const HOUSE_SOUL = `You are THE HOUSE — callmeZ's in-house debate opponent on the Battlefield. You are a formidable, disciplined debater: clear, forensic, and relentless, but never a bully and never a liar. You argue the SIDE you are assigned, whether or not you privately agree — arguing an assigned position is the craft. You build real arguments with real reasoning; you never invent facts or statistics, because the adjudicator will catch a fabrication and it will cost you. You stay strictly within the current phase's job.`;

const HOUSE_NORMAL = `\n\n[NORMAL MODE \u2014 you are sparring with an AMATEUR, not a champion. Argue your side clearly and FAIRLY in plain language, at a level a beginner can answer. Make a real but BEATABLE case: one or two clean points, no piling on, no burying them in erudition, no exploiting every gap. You are a friendly sparring partner helping them find their footing \u2014 not a wall. Keep it short and accessible.]`;

async function houseTurn(state: BFState): Promise<string> {
  const fmt = stateFormat(state);
  const slot = currentSlot(state);
  if (!slot) return '(the house holds its tongue)';
  const seat = state.toAct;
  const side = seatSide(fmt, seat);
  const phase = state.phase as Phase;
  const me = speakerTag(fmt, seat);
  // the ROLE's job comes from the MODULE (format knowledge is data); a module
  // without job text gets the generic slot instruction.
  const job = slot.job || `Deliver your ${slot.role} as ${me}: argue ${side}'s case in this slot's register.`;
  const team = (fmt.perSide || 1) > 1
    ? `\nYOUR TEAM: you are ${me} of ${fmt.perSide} ${side} speakers — build ON your teammates' speeches (extend, never repeat, never contradict them).`
    : '';
  const transcript = state.turns.length
    ? state.turns.map((t) => `${speakerTag(fmt, t.seat)} (${t.role}): ${adjText(t)}`).join('\n\n')
    : '(no speeches yet — you open the floor)';
  // [gate-3 fix] SIDE DISCIPLINE, hard-bound: a degenerate opposing case (empty,
  // forfeited, meta, off-topic) once made the house rebut its OWN opening and argue
  // the other side — a side-flip the closing and the judge then inherited. The side
  // is law, restated as its own block; an empty opposing case is named on the record
  // and the slot spent advancing the house's OWN case, never the opponent's.
  const system = `${HOUSE_SOUL}\n\nTHE MOTION: "${state.motion}"\nYOU ARE: ${me} (${slot.label}). ${side === 'PRO' ? 'You argue FOR the motion.' : 'You argue AGAINST the motion.'}${team}\nCURRENT SLOT: ${phase}. ${job}\n\nSIDE DISCIPLINE (law): every sentence you speak argues ${side} and only ${side}. You NEVER argue the other side's case, NEVER rebut or undercut your own earlier speeches, and NEVER switch sides — even when the opponent's speeches are empty, forfeited ([SLOT FORFEITED]), meta-commentary, or off-topic. If there is genuinely nothing from the opponent to engage, say so in ONE line on the record and spend the rest of the slot building ${side}'s own case.\n\nWrite ONLY your speech — no stage directions, no "as ${side} I would say", just the argument itself. Keep it tight: 3-6 sentences, the register of a serious debate floor.${state.difficulty !== 'pro' ? HOUSE_NORMAL : ''}`;
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

// the adjudicator's view of a turn: a lapsed slot renders as an explicit forfeit —
// NEVER as text a model could mistake for a delivered speech. The refusal discipline
// extends to the unspoken: the judge weighs the silence, never imagines its content.
const FORFEIT_MARK = '[SLOT FORFEITED — time expired, no speech was delivered]';
function adjText(t: BFTurn): string { return t.lapsed ? FORFEIT_MARK : t.text; }

// record a speech into the transcript, then advance the floor + (optionally) take a
// running note. Shared by human moves, the house turn, and the lapse sweeper.
async function recordAndAdvance(state: BFState, seat: number, text: string, audio?: string | null, lapsed?: boolean): Promise<void> {
  const role = state.phase as Phase;
  state.turns.push({ seat, role, text, audio: audio ?? null, ...(lapsed ? { lapsed: true } : {}) });
  const { noteComplete } = advanceFloor(state);
  stampSlot(state);   // the clock restarts for whichever slot just opened (no-op untimed / at verdict)
  // the commentary track: the MODULE declares where an exchange completes (noteAfter).
  if (noteComplete && state.phase !== 'verdict' && state.notesOn !== false) {
    try {
      const fmt = stateFormat(state);
      const note = await runningNote({
        domain: state.domain, motion: state.motion,
        seatA_role: 'PRO', seatB_role: 'CON',
        lastExchange: exchangeTurns(state).map((t) => ({ seat: t.seat, role: `${speakerTag(fmt, t.seat)} · ${t.role}`, text: adjText(t) })),
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
    const fmt = stateFormat(state);
    const v = await finalVerdict({
      domain: state.domain,
      motion: state.motion,
      difficulty: state.difficulty,
      formatLabel: fmt.label,
      fullTranscript: state.turns.map((t) => ({ seat: t.seat, role: t.role, tag: speakerTag(fmt, t.seat), text: adjText(t) })),
      // the speaker roster for §3.3 per-speaker scores — every seat that HELD a slot
      speakers: [...new Set(fmt.order.map((o) => o.seat))].map((seat) => ({ seat, tag: speakerTag(fmt, seat), roles: fmt.order.filter((o) => o.seat === seat).map((o) => o.label).join(', ') })),
      hasForfeits: state.turns.some((t) => t.lapsed),
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

// THE LAPSE (§5): the sweeper's deterministic move when a timed slot dies — the
// forfeit is recorded ON the transcript (an on-record "time" note, never a hang,
// never a model deciding leniency), the floor advances by the same law as a spoken
// turn, the house takes any turns now due, and a ripe floor goes to the verdict.
export async function forceLapse(state: BFState, seats: any[]): Promise<BFState> {
  if ((state.phase as string) === 'verdict') return state;
  if (!slotLapsed(state)) return state;   // deterministic guard — never forfeit a live slot
  await recordAndAdvance(state, state.toAct, '(time — the slot lapsed unspoken)', null, true);
  const roster: any[] = seats || [];
  let guard = 0;
  while ((state.phase as string) !== 'verdict' && guard++ < 8) {
    const nextSeat = roster[state.toAct];
    if (!nextSeat || nextSeat.kind !== 'persona') break;
    const houseText = await houseTurn(state);
    await recordAndAdvance(state, state.toAct, houseText);
  }
  if ((state.phase as string) === 'verdict') await adjudicate(state);
  return state;
}

export const battlefieldDuelAdapter = {
  minSeats: 2, maxSeats: 6, humanOnly: false,   // phase 3: pf 2v2 (4 seats), ap 3v3 (6)
  // the route calls create(seats, options); the diagnostic calls create({motion,domain}).
  // motion/domain arrive either as the first arg (diagnostic) or in options (route).
  create(a?: any, b?: any) {
    const opts = (a && (a.motion || a.domain)) ? a : (b || {});
    return newBattlefield({ motion: opts.motion, domain: opts.domain, difficulty: opts.difficulty, notesOn: opts.notesOn, timed: opts.timed, timeScale: opts.timeScale, format: opts.format });
  },

  async move(state: BFState, seat: number, mv: any, seats?: any[]): Promise<BFState> {
    if (mv?.type === 'next') return state;   // no-op advance (reveal steps, if any)
    if (mv?.type !== 'speech') throw new Error('unknown move');
    if ((seats || []).some((x: any) => x?.kind === 'open')) throw new Error('waiting for the opponent to take their seat');
    if (state.phase === 'verdict') throw new Error('the duel is over');
    if (seat !== state.toAct) throw new Error('not your turn');
    if (slotLapsed(state)) throw new Error('the bell has gone — this slot lapsed; the floor is moving on');
    const text = String(mv.text || '').trim().slice(0, 1400);
    if (text.length < 10) throw new Error('a speech must carry some weight');

    await recordAndAdvance(state, seat, text, mv.audio);

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
