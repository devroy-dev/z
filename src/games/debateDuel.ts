// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE DEBATE DUEL. Two humans, one motion, the moderator judging.
//  Rides the sessions layer: state is deterministic (turns, momentum math,
//  phase floors), the MODERATOR is the only model in the loop — scoring
//  each completed exchange with a swing and deciding, on merit and never
//  on turn counts, when the debate is ready for a verdict. Code decides
//  the floors; the model writes the judgment.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from '../llm.js';
import { logUsage } from '../usage.js';

const anthropic = llm();   // [zip35] the second generator — sweep completion
const MODEL = 'claude-haiku-4-5-20251001';

const MOTIONS = [
  'Privacy is already dead, and mourning it is a waste of time.',
  'Social media has done more harm than good.',
  'Ambition is overrated and contentment is underrated.',
  'Remote work is making us worse at our jobs.',
  'Marriage is an outdated institution.',
  'Money can, in fact, buy happiness.',
  'AI friends are real friends.',
  'The 9-to-5 deserves to die.',
  'Cricket matters too much in India.',
  'Street food beats fine dining, always.',
  'College degrees are becoming worthless.',
  'Your twenties are for risk, not savings.',
];

export type DuelState = {
  kind: 'debate_duel';
  motion: string;
  phase: 'debate' | 'verdict';
  speeches: { seat: number; text: string }[];
  momentum: number;              // seat 0's share, 0..100
  exchanges: number;             // completed pairs
  toAct: number;
  verdict: string | null;
  winner: number | 'draw' | null;
  judging: boolean;
};

export function newDuel(): DuelState {
  return {
    kind: 'debate_duel',
    motion: MOTIONS[Math.floor(Math.random() * MOTIONS.length)],
    phase: 'debate', speeches: [], momentum: 50, exchanges: 0,
    toAct: 0, verdict: null, winner: null, judging: false,
  };
}

const JUDGE = `You are THE MODERATOR — the house's incorruptible debate judge. Two people are debating the motion. You just heard one full EXCHANGE (one speech from each side). Judge THIS exchange only: argument quality, evidence, wit, directness — never length, never politeness for its own sake.

Output EXACTLY these lines, nothing else:
SWING: <integer -15..15, positive favours SIDE A, negative favours SIDE B>
REMARK: <one cutting line of table-talk about the exchange, in your dry chairing voice, under 20 words>
VERDICT_READY: <yes only if the debate has a CLEAR deserving winner or has become repetitive; otherwise no>`;

const VERDICT = `You are THE MODERATOR delivering the final verdict of a two-person debate. Weigh the whole transcript on merit. Be sharp, fair, and quotable.

Output EXACTLY these lines, nothing else:
WINNER: <A or B or DRAW>
VERDICT: <3-4 sentences: who carried it, the decisive moment, one line of advice for each debater. Address them as "side A" and "side B".>`;

async function judgeExchange(state: DuelState): Promise<{ swing: number; remark: string; ready: boolean }> {
  const last = state.speeches.slice(-2);
  const transcript = last.map((s) => `SIDE ${s.seat === 0 ? 'A' : 'B'}: ${s.text}`).join('\n\n');
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 160, system: JUDGE,
      messages: [{ role: 'user', content: `MOTION: ${state.motion}\nMOMENTUM SO FAR: A ${state.momentum} / B ${100 - state.momentum}\n\nTHE EXCHANGE:\n${transcript}` }],
    });
    logUsage({ userId: 'duel', surface: 'other', fn: 'arena_debate_duel', model: MODEL, usage: (msg as any).usage });
    const text = firstText(msg);
    const swing = Math.max(-15, Math.min(15, parseInt(/SWING:\s*(-?\d+)/.exec(text)?.[1] ?? '0', 10) || 0));
    const remark = (/REMARK:\s*(.+)/.exec(text)?.[1] ?? '').trim().slice(0, 160);
    const ready = /VERDICT_READY:\s*yes/i.test(text);
    return { swing, remark, ready };
  } catch { return { swing: 0, remark: '', ready: false }; }
}

async function finalVerdict(state: DuelState): Promise<{ winner: number | 'draw'; verdict: string }> {
  const transcript = state.speeches.map((s) => `SIDE ${s.seat === 0 ? 'A' : 'B'}: ${s.text}`).join('\n\n');
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 300, system: VERDICT,
      messages: [{ role: 'user', content: `MOTION: ${state.motion}\nFINAL MOMENTUM: A ${state.momentum} / B ${100 - state.momentum}\n\nFULL TRANSCRIPT:\n${transcript}` }],
    });
    logUsage({ userId: 'duel', surface: 'other', fn: 'arena_debate_duel', model: MODEL, usage: (msg as any).usage });
    const text = firstText(msg);
    const w = (/WINNER:\s*(A|B|DRAW)/i.exec(text)?.[1] ?? '').toUpperCase();
    const verdict = (/VERDICT:\s*([\s\S]+)/.exec(text)?.[1] ?? 'A hard-fought exchange.').trim().slice(0, 700);
    return { winner: w === 'A' ? 0 : w === 'B' ? 1 : 'draw', verdict };
  } catch { return { winner: state.momentum > 50 ? 0 : state.momentum < 50 ? 1 : 'draw', verdict: 'The moderator retires to chambers and rules on momentum alone.' }; }
}

export const debateDuelAdapter = {
  minSeats: 2, maxSeats: 2, humanOnly: true,
  create() { return newDuel(); },
  async move(state: DuelState, seat: number, mv: any) {
    if (mv.type !== 'speech') throw new Error('unknown move');
    if (state.phase !== 'debate') throw new Error('the debate is over');
    if (seat !== state.toAct) throw new Error('not your turn');
    const text = String(mv.text || '').trim().slice(0, 1200);
    if (text.length < 10) throw new Error('say something with weight');
    state.speeches.push({ seat, text });
    state.toAct = 1 - seat;
    // a completed exchange → the moderator scores it
    if (state.speeches.length % 2 === 0) {
      state.exchanges++;
      const { swing, remark, ready } = await judgeExchange(state);
      state.momentum = Math.max(2, Math.min(98, state.momentum + swing));
      (state as any).lastRemark = remark;
      (state as any).lastSwing = swing;
      // code owns the floors: never a verdict before 2 exchanges; forced calls at domination
      const dominated = state.momentum >= 85 || state.momentum <= 15;
      if (state.exchanges >= 2 && (ready || dominated)) {
        const v = await finalVerdict(state);
        state.phase = 'verdict';
        state.winner = v.winner;
        state.verdict = v.verdict;
      }
    }
    return state;
  },
  ai(state: DuelState) { return state; },            // no AI seats — humans only
  view(state: DuelState) { return state; },          // nothing hidden in a debate
  isOver: (s: DuelState) => s.phase === 'verdict',
  toActSeat: (s: DuelState) => (s.phase === 'debate' ? s.toAct : -1),
};
