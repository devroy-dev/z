// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TRIVIA DUEL. Two humans, ten questions, the house asking.
//  Rides the sessions layer. Turn-based per question (the route enforces
//  toActSeat): the first answerer ALTERNATES each question, and neither
//  correctness nor the opponent's pick is revealed until both have
//  answered — so answering second confers nothing. Questions are Haiku-
//  generated at create (strict JSON), with a fixed fallback bank so a
//  generation failure can never brick a table. The correct answers NEVER
//  leave the server before the reveal (view() strips them).
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from '../usage.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

type Q = { q: string; opts: string[]; correct: number };
export type TriviaDuelState = {
  kind: 'trivia_duel';
  topic: string;
  questions: Q[];
  qi: number;                       // current question index
  answers: (number | null)[][];    // answers[qi] = [seat0 pick, seat1 pick]
  scores: [number, number];
  phase: 'answer' | 'reveal' | 'over';
  lastResult: { q: string; opts: string[]; correct: number; picks: (number | null)[] } | null;
  winner: number | 'draw' | null;
};

const N_QUESTIONS = 10;

// the fallback bank — a duel must never fail to deal
const FALLBACK: Q[] = [
  { q: 'Which planet has the most moons discovered so far?', opts: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correct: 1 },
  { q: 'The Konark Sun Temple is in which Indian state?', opts: ['Tamil Nadu', 'Karnataka', 'Odisha', 'Gujarat'], correct: 2 },
  { q: 'What does "HTTP" stand for?', opts: ['HyperText Transfer Protocol', 'High Tech Transfer Process', 'Hyperlink Text Program', 'Host Transfer Text Protocol'], correct: 0 },
  { q: 'Which ocean is the deepest?', opts: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 },
  { q: 'Who wrote the national anthem of India?', opts: ['Bankim Chandra', 'Rabindranath Tagore', 'Sarojini Naidu', 'Subhas Bose'], correct: 1 },
  { q: 'Gold\'s chemical symbol is…', opts: ['Gd', 'Go', 'Au', 'Ag'], correct: 2 },
  { q: 'The FIFA World Cup 2022 was won by…', opts: ['France', 'Brazil', 'Argentina', 'Germany'], correct: 2 },
  { q: 'Which is the smallest prime number?', opts: ['0', '1', '2', '3'], correct: 2 },
  { q: 'Mount Everest sits on the border of Nepal and…', opts: ['India', 'Bhutan', 'China', 'Pakistan'], correct: 2 },
  { q: 'Who painted the Mona Lisa?', opts: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Botticelli'], correct: 2 },
];

const GEN_SYS = `You write trivia for a fast two-player duel. Produce EXACTLY ${N_QUESTIONS} multiple-choice questions on the given topic: crisp, unambiguous, verifiable facts only — no opinion, no trick wording, mixed difficulty (start easy, end hard). Output ONLY a JSON array, no markdown fences, no prose: [{"q":"…","opts":["…","…","…","…"],"correct":0}] where correct is the 0-based index of the right option. Exactly 4 options each. Never invent facts.`;

async function generateQuestions(topic: string): Promise<Q[]> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 1800, system: GEN_SYS,
      messages: [{ role: 'user', content: `Topic: ${topic}` }],
    });
    logUsage({ userId: 'trivia-duel', surface: 'other', model: MODEL, usage: (msg as any).usage });
    const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
      .replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const arr = JSON.parse(text);
    const clean: Q[] = [];
    for (const it of Array.isArray(arr) ? arr : []) {
      const q = String(it?.q || '').trim().slice(0, 240);
      const opts = Array.isArray(it?.opts) ? it.opts.map((o: any) => String(o).trim().slice(0, 90)) : [];
      const correct = Number(it?.correct);
      if (q && opts.length === 4 && opts.every(Boolean) && correct >= 0 && correct <= 3) {
        clean.push({ q, opts, correct });
      }
      if (clean.length === N_QUESTIONS) break;
    }
    if (clean.length === N_QUESTIONS) return clean;
    console.warn('[trivia-duel] generation gave', clean.length, 'usable — falling back');
    return FALLBACK;
  } catch (e: any) {
    console.error('[trivia-duel] generation failed, using fallback:', e?.message || e);
    return FALLBACK;
  }
}

export const triviaDuelAdapter = {
  minSeats: 2, maxSeats: 2, humanOnly: true,
  async create(_seats: any[], options?: any): Promise<TriviaDuelState> {
    const topic = String(options?.topic || 'a wide general-knowledge mix').trim().slice(0, 120) || 'a wide general-knowledge mix';
    const questions = await generateQuestions(topic);
    return {
      kind: 'trivia_duel', topic, questions,
      qi: 0, answers: questions.map(() => [null, null]),
      scores: [0, 0], phase: 'answer', lastResult: null, winner: null,
    };
  },
  async move(state: TriviaDuelState, seat: number, mv: any) {
    if (mv.type === 'answer') {
      if (state.phase !== 'answer') throw new Error('wait for the next question');
      const pick = Number(mv.pick);
      if (!(pick >= 0 && pick <= 3)) throw new Error('pick one of the four');
      if (state.answers[state.qi][seat] != null) throw new Error('you already answered this one');
      state.answers[state.qi][seat] = pick;
      const [a, b] = state.answers[state.qi];
      if (a != null && b != null) {
        const q = state.questions[state.qi];
        if (a === q.correct) state.scores[0]++;
        if (b === q.correct) state.scores[1]++;
        state.lastResult = { q: q.q, opts: q.opts, correct: q.correct, picks: [a, b] };
        state.phase = 'reveal';
      }
      return state;
    }
    if (mv.type === 'next') {
      if (state.phase !== 'reveal') throw new Error('nothing to advance');
      state.qi++;
      if (state.qi >= state.questions.length) {
        state.phase = 'over';
        state.winner = state.scores[0] > state.scores[1] ? 0 : state.scores[1] > state.scores[0] ? 1 : 'draw';
      } else {
        state.phase = 'answer';
      }
      return state;
    }
    throw new Error('unknown move');
  },
  ai(state: TriviaDuelState) { return state; },        // humans only
  // per-viewer filter: correct answers NEVER ship before their reveal, and the
  // opponent's in-flight pick is a boolean, not a value.
  view(state: TriviaDuelState, mySeat: number) {
    const cur = state.qi < state.questions.length ? state.questions[state.qi] : null;
    const myPick = state.qi < state.answers.length ? state.answers[state.qi][mySeat] : null;
    const oppAnswered = state.qi < state.answers.length ? state.answers[state.qi][1 - mySeat] != null : false;
    return {
      kind: 'trivia_duel', topic: state.topic,
      total: state.questions.length, qi: state.qi,
      scores: state.scores, phase: state.phase,
      question: state.phase === 'answer' && cur ? { q: cur.q, opts: cur.opts } : null,
      myPick, oppAnswered,
      lastResult: state.phase !== 'answer' ? state.lastResult : null,
      winner: state.winner,
    };
  },
  isOver: (s: TriviaDuelState) => s.phase === 'over',
  // turn-based fairness: the first answerer alternates each question; the seat
  // that hasn't answered the current question is to act. reveal/over → -1
  // (only 'next' passes, which the route lets anyone send).
  toActSeat: (s: TriviaDuelState) => {
    if (s.phase !== 'answer') return -1;
    const first = s.qi % 2;
    const [a0, a1] = s.answers[s.qi];
    const picks = [a0, a1];
    if (picks[first] == null) return first;
    if (picks[1 - first] == null) return 1 - first;
    return -1;
  },
};
