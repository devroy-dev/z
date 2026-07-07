// traitors.ts — REALITY GAME #1: THE TRAITORS (social deduction, AI-as-hidden-player).
//
// A handful of personas (and optionally the human) sit at a table. A few are
// secretly TRAITORS; the rest are FAITHFUL. Each round:
//   roundtable  — everyone says a line: suspicion, defense, misdirection
//   banish      — everyone votes to banish one player; most-voted is out
//   reveal      — the banished player's true role is revealed to all
// Win: FAITHFUL win when every traitor is banished; TRAITORS win when their
// number reaches the number of remaining faithful (parity) — they've taken over.
//
// THE MOAT PRIMITIVE = information asymmetry via view(state, seat):
//   - a TRAITOR seat sees the full role map (knows the other traitors)
//   - a FAITHFUL seat sees only public info (talk, votes, reveals) — never roles
//   - a SPECTATOR (watch) sees EVERYTHING, including who's lying — the dramatic irony
//
// LLM-driven, like battlefieldDuel: contestants' talk + votes are generated
// inside the engine, role-aware. Pure state helpers (assign/tally/reveal/win)
// are separated out so the state machine is unit-testable without the model.
import Anthropic from '@anthropic-ai/sdk';
import { llm } from '../llm.js';
import { personaByKey } from '../personas.js';

const anthropic = llm();   // [zip35] the second generator — sweep completion
const MODEL = 'claude-haiku-4-5-20251001';

export type Seat = { kind: 'persona' | 'user'; id: string; name: string };
export type Phase = 'roundtable' | 'banish' | 'reveal' | 'ended';
export type TraitorsState = {
  kind: 'traitors';
  round: number;
  phase: Phase;
  seats: Seat[];                       // index = seat number
  roles: ('traitor' | 'faithful')[];   // by seat index — SECRET (filtered by view)
  alive: boolean[];                    // by seat index
  // public record, visible to everyone:
  log: { round: number; phase: Phase; seat: number; name: string; text: string }[];
  votes: Record<number, number>;       // voter seat -> target seat (current round)
  lastBanished: number | null;         // seat index banished last reveal
  lastRevealRole: 'traitor' | 'faithful' | null;
  winner: 'faithful' | 'traitors' | null;
};

// ── pure helpers (unit-testable, no model, no db) ───────────────────────
export function assignRoles(n: number, traitorCount: number, rng: () => number = Math.random): ('traitor' | 'faithful')[] {
  const roles: ('traitor' | 'faithful')[] = Array(n).fill('faithful');
  const idx = Array.from({ length: n }, (_, i) => i);
  // Fisher-Yates with injectable rng (deterministic in tests)
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  for (let k = 0; k < Math.min(traitorCount, n - 1); k++) roles[idx[k]] = 'traitor';
  return roles;
}

export function createTraitors(seats: Seat[], opts: { traitors?: number } = {}): TraitorsState {
  const n = seats.length;
  const traitorCount = Math.max(1, Math.min(opts.traitors ?? Math.max(1, Math.floor(n / 4)), n - 1));
  return {
    kind: 'traitors', round: 1, phase: 'roundtable', seats,
    roles: assignRoles(n, traitorCount),
    alive: Array(n).fill(true),
    log: [], votes: {}, lastBanished: null, lastRevealRole: null, winner: null,
  };
}

export function aliveSeats(s: TraitorsState): number[] {
  return s.seats.map((_, i) => i).filter((i) => s.alive[i]);
}
function aliveByRole(s: TraitorsState, role: 'traitor' | 'faithful'): number[] {
  return aliveSeats(s).filter((i) => s.roles[i] === role);
}

// tally the current votes → the banished seat (ties broken by lowest seat for determinism)
export function tallyBanish(s: TraitorsState): number | null {
  const counts: Record<number, number> = {};
  for (const target of Object.values(s.votes)) counts[target] = (counts[target] || 0) + 1;
  let best: number | null = null, bestN = -1;
  for (const seatStr of Object.keys(counts).sort((a, b) => Number(a) - Number(b))) {
    const seat = Number(seatStr);
    if (!s.alive[seat]) continue;
    if (counts[seat] > bestN) { bestN = counts[seat]; best = seat; }
  }
  return best;
}

// win check after a banish/reveal
export function checkWin(s: TraitorsState): 'faithful' | 'traitors' | null {
  const traitors = aliveByRole(s, 'traitor').length;
  const faithful = aliveByRole(s, 'faithful').length;
  if (traitors === 0) return 'faithful';
  if (traitors >= faithful) return 'traitors';
  return null;
}

// apply the banish + reveal + win, mutating a copy. Pure given votes are set.
export function resolveBanish(prev: TraitorsState): TraitorsState {
  const s: TraitorsState = JSON.parse(JSON.stringify(prev));
  const banished = tallyBanish(s);
  if (banished !== null) {
    s.alive[banished] = false;
    s.lastBanished = banished;
    s.lastRevealRole = s.roles[banished];
    s.log.push({ round: s.round, phase: 'reveal', seat: banished, name: s.seats[banished].name,
      text: `${s.seats[banished].name} is banished — and was ${s.roles[banished] === 'traitor' ? 'a TRAITOR' : 'FAITHFUL'}.` });
  }
  s.votes = {};
  s.phase = 'reveal';
  const w = checkWin(s);
  if (w) { s.winner = w; s.phase = 'ended'; }
  return s;
}

// ── per-seat view: THE asymmetry ────────────────────────────────────────
// seat = the viewer's seat index, or -1 for a SPECTATOR (sees all).
export function viewTraitors(s: TraitorsState, seat: number): any {
  const isSpectator = seat < 0;
  const iAmTraitor = !isSpectator && s.roles[seat] === 'traitor';
  const seeRoles = isSpectator || iAmTraitor;   // spectators + traitors see the truth
  return {
    kind: 'traitors', round: s.round, phase: s.phase, winner: s.winner,
    you: isSpectator ? null : { seat, name: s.seats[seat].name, role: isSpectator ? null : s.roles[seat] },
    players: s.seats.map((p, i) => ({
      seat: i, name: p.name, kind: p.kind, alive: s.alive[i],
      // role is revealed ONLY to those allowed to see it, OR if the player is dead (banished → publicly revealed)
      role: (seeRoles || !s.alive[i]) ? s.roles[i] : null,
    })),
    log: s.log,                                  // public record — everyone sees talk + reveals
    lastBanished: s.lastBanished === null ? null : { seat: s.lastBanished, name: s.seats[s.lastBanished].name, role: s.lastRevealRole },
    // a traitor also sees the current secret conclave (who the traitors are)
    traitors: seeRoles ? s.seats.map((p, i) => ({ seat: i, name: p.name })).filter((_, i) => s.roles[i] === 'traitor') : undefined,
    spectator: isSpectator || undefined,
  };
}

// ── LLM contestants (device-verified; not exercised by the local logic test) ──
function otherNames(s: TraitorsState, seat: number): string {
  return aliveSeats(s).filter((i) => i !== seat).map((i) => s.seats[i].name).join(', ');
}
function recentTalk(s: TraitorsState, n = 12): string {
  return s.log.slice(-n).map((l) => `${l.name}: ${l.text}`).join('\n') || '(the table is silent so far)';
}
function banishRecap(s: TraitorsState): string {
  if (s.lastBanished === null) return '';
  const name = s.seats[s.lastBanished].name;
  const wasTraitor = s.lastRevealRole === 'traitor';
  return `\n\nLast banishment: ${name} was banished and turned out to be ${wasTraitor ? 'a TRAITOR' : 'FAITHFUL'}. ${wasTraitor ? 'The table got one right.' : 'The table got it WRONG — a traitor is still among you. Rethink your reads.'}`;
}

async function speakOne(s: TraitorsState, seat: number): Promise<string> {
  const p = s.seats[seat];
  const persona = p.kind === 'persona' ? personaByKey(p.id) : null;
  const iAmTraitor = s.roles[seat] === 'traitor';
  const fellowTraitors = iAmTraitor
    ? s.seats.filter((_, i) => s.roles[i] === 'traitor' && i !== seat && s.alive[i]).map((x) => x.name)
    : [];
  const roleBrief = iAmTraitor
    ? `You are secretly a TRAITOR. Your goal: survive and get FAITHFUL players banished. NEVER admit you're a traitor. Cast subtle suspicion on the innocent, defend yourself smoothly, and protect your fellow traitors (${fellowTraitors.join(', ') || 'none left'}) WITHOUT being obvious. You may quietly throw a fellow traitor under the bus if it saves you.`
    : `You are FAITHFUL. Your goal: find and banish the traitors. Read the table, voice genuine suspicion, defend yourself if accused. You do NOT know who the traitors are — reason from behavior.`;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 160,
      system: `You are ${persona?.defaultName || p.name}, a contestant at the round table in a game of THE TRAITORS. ${persona ? 'Stay fully in your own voice and personality.' : ''} ${roleBrief} Say ONE short, natural round-table line (1-3 sentences) reacting to the table — an accusation, a defense, a read, a bit of misdirection. In character, spoken aloud to the group. No stage directions, no meta, just the line.`,
      messages: [{ role: 'user', content: `Round ${s.round}. Still at the table: ${otherNames(s, seat)} (and you).\n\nRecent table talk:\n${recentTalk(s)}${banishRecap(s)}\n\nYour line:` }],
    });
    return resp.content.filter((b) => b.type === 'text').map((b: any) => (b as any).text).join('').trim().slice(0, 400);
  } catch {
    return iAmTraitor ? `I'm just as lost as the rest of you — let's not point fingers wildly.` : `Something's off with how quiet some of you are being.`;
  }
}

async function voteOne(s: TraitorsState, seat: number): Promise<number> {
  const alive = aliveSeats(s).filter((i) => i !== seat);
  if (!alive.length) return seat;
  const p = s.seats[seat];
  const persona = p.kind === 'persona' ? personaByKey(p.id) : null;
  const iAmTraitor = s.roles[seat] === 'traitor';
  const options = alive.map((i) => `${i}=${s.seats[i].name}`).join(', ');
  const guide = iAmTraitor
    ? `You are a TRAITOR: vote to banish a FAITHFUL player who threatens you, or steer the herd — never vote out a fellow traitor unless it saves you.`
    : `You are FAITHFUL: vote for whoever you most suspect is a traitor, based on the table talk.`;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 20,
      system: `You are ${persona?.defaultName || p.name} voting at the banishment in THE TRAITORS. ${guide} Reply with ONLY the seat number of your vote. Nothing else.`,
      messages: [{ role: 'user', content: `Options: ${options}\n\nTable talk:\n${recentTalk(s)}${banishRecap(s)}\n\nYour vote (seat number only):` }],
    });
    const txt = resp.content.filter((b) => b.type === 'text').map((b: any) => (b as any).text).join('');
    const m = txt.match(/\d+/);
    const pick = m ? Number(m[0]) : NaN;
    return alive.includes(pick) ? pick : alive[Math.floor(Math.random() * alive.length)];
  } catch {
    return alive[Math.floor(Math.random() * alive.length)];
  }
}

// Advance the game ONE phase. AI seats act automatically; a human seat's action
// (a vote) is passed in via `humanMove`. Returns the next state.
export async function stepTraitors(prev: TraitorsState, humanMove?: { seat: number; vote?: number }): Promise<TraitorsState> {
  let s: TraitorsState = JSON.parse(JSON.stringify(prev));
  if (s.phase === 'ended') return s;

  if (s.phase === 'reveal') {
    s.round += 1;
    s.phase = 'roundtable';   // fall through: THIS step runs the new round's table
  }

  if (s.phase === 'roundtable') {
    for (const seat of aliveSeats(s)) {
      if (s.seats[seat].kind === 'user') continue;   // the human speaks via chat, not auto
      const line = await speakOne(s, seat);
      s.log.push({ round: s.round, phase: 'roundtable', seat, name: s.seats[seat].name, text: line });
    }
    s.phase = 'banish';
    return s;
  }

  if (s.phase === 'banish') {
    for (const seat of aliveSeats(s)) {
      if (s.seats[seat].kind === 'user') {
        if (humanMove && humanMove.seat === seat && typeof humanMove.vote === 'number') s.votes[seat] = humanMove.vote;
        continue;   // if the human hasn't voted, they're skipped this tally (v1)
      }
      s.votes[seat] = await voteOne(s, seat);
    }
    return resolveBanish(s);   // → reveal (or ended)
  }

  return s;
}
