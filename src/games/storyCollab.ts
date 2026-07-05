// storyCollab.ts — STORY COLLAB. A story written round-robin by 3-4 personas and
// (optionally) the human, each adding one bounded paragraph, exquisite-corpse style.
// The engine IS the moderator: it orchestrates whose turn it is (round-robin) and
// holds the story-so-far as the shared "bible". Two modes, picked at start:
//   coherent — honour what's established; move the one story forward, hand off cleanly
//   chaos    — exquisite-corpse; subvert, surprise, delight; coherence optional
// The magic is the distinct persona voices: historian+philosopher → literary;
// comic+conspiracy → absurdist. Finished stories can be published (content-mod gates
// the publish step — see the endpoint note). Follows the Traitors session pattern.
import Anthropic from '@anthropic-ai/sdk';
import { personaByKey } from '../personas.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

export type Seat = { kind: 'persona' | 'user'; id: string; name: string };
export type StoryMode = 'coherent' | 'chaos';
export type StoryState = {
  kind: 'story';
  mode: StoryMode;
  premise: string;
  seats: Seat[];
  order: number[];        // round-robin seat order (index into seats)
  turn: number;           // index into order — whose turn now
  round: number;
  maxRounds: number;
  paragraphs: { seat: number; name: string; text: string; round: number }[];
  status: 'writing' | 'done';
  published: boolean;
};

// ── pure helpers (unit-testable, no model) ──────────────────────────────
export function createStory(seats: Seat[], opts: { mode?: StoryMode; premise?: string; rounds?: number } = {}): StoryState {
  return {
    kind: 'story',
    mode: opts.mode === 'chaos' ? 'chaos' : 'coherent',
    premise: (opts.premise || '').slice(0, 500),
    seats,
    order: seats.map((_, i) => i),
    turn: 0, round: 1,
    maxRounds: Math.max(1, Math.min(opts.rounds ?? 3, 8)),
    paragraphs: [], status: 'writing', published: false,
  };
}

export function currentSeat(s: StoryState): number { return s.order[s.turn]; }

// advance the turn pointer after a paragraph is appended (wrap → next round → done)
export function advanceStory(prev: StoryState): StoryState {
  const s: StoryState = { ...prev, paragraphs: [...prev.paragraphs], order: [...prev.order], seats: [...prev.seats] };
  s.turn += 1;
  if (s.turn >= s.order.length) { s.turn = 0; s.round += 1; }
  if (s.round > s.maxRounds) s.status = 'done';
  return s;
}

// every paragraph is public — no hidden info. `seat` is the caller (or -1 for a viewer).
export function viewStory(s: StoryState, seat: number): any {
  const cur = currentSeat(s);
  return {
    kind: 'story', mode: s.mode, premise: s.premise, round: s.round, maxRounds: s.maxRounds,
    status: s.status, published: s.published,
    players: s.seats.map((p, i) => ({ seat: i, name: p.name, kind: p.kind })),
    paragraphs: s.paragraphs,
    turnSeat: s.status === 'done' ? null : cur,
    turnName: s.status === 'done' ? null : s.seats[cur]?.name ?? null,
    yourTurn: seat >= 0 && s.status !== 'done' && cur === seat,
    you: seat >= 0 ? { seat, name: s.seats[seat]?.name } : null,
  };
}

// the whole finished story as one text (for publishing / sharing)
export function storyText(s: StoryState): string {
  return s.paragraphs.map((p) => p.text).join('\n\n');
}

// ── LLM: a persona writes the next paragraph (device-verified) ──────────
function storySoFar(s: StoryState): string {
  if (!s.paragraphs.length) return `(the story has not begun yet — you write the OPENING paragraph)`;
  return s.paragraphs.map((p) => `${p.name}: ${p.text}`).join('\n\n');
}

async function writeParagraph(s: StoryState, seat: number): Promise<string> {
  const p = s.seats[seat];
  const persona = p.kind === 'persona' ? personaByKey(p.id) : null;
  const modeNudge = s.mode === 'chaos'
    ? `This is an EXQUISITE-CORPSE / chaos story: take it somewhere SURPRISING — subvert what came before, introduce the unexpected, be bold. Coherence is optional; delight and surprise are the point.`
    : `Continue the story COHERENTLY: honour what has been established (characters, setting, tone, plot), move it forward by ONE beat, and leave a clean thread for the next writer. Do not contradict earlier paragraphs.`;
  const opening = s.paragraphs.length === 0
    ? ` You are writing the OPENING — set the scene and voice from the premise, then stop and leave room.`
    : '';
  const sys = `You are ${persona?.defaultName || p.name}, co-writing a story round-robin with others. Write in YOUR OWN unmistakable voice and sensibility. ${modeNudge}${opening} Write ONE paragraph (2-5 sentences) — your contribution only. No meta, no "continued", no narrating that it's your turn — just the prose. Never end the whole story; hand off to the next writer.`;
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 320,
      system: sys,
      messages: [{ role: 'user', content: `PREMISE: ${s.premise || '(freeform)'}\n\nSTORY SO FAR:\n${storySoFar(s)}\n\nWrite the next paragraph as ${persona?.defaultName || p.name}:` }],
    });
    return resp.content.filter((b) => b.type === 'text').map((b: any) => (b as any).text).join('').trim().slice(0, 1200)
      || '…';
  } catch {
    return '(a beat of silence — the pen hovers, then passes on)';
  }
}

// step ONE turn. Persona seats auto-write; a user seat needs humanText (else it waits).
export async function stepStory(prev: StoryState, humanText?: string): Promise<StoryState> {
  let s: StoryState = JSON.parse(JSON.stringify(prev));
  if (s.status === 'done') return s;
  const seat = currentSeat(s);
  const isUser = s.seats[seat].kind === 'user';
  let text: string;
  if (isUser) {
    if (!humanText || !humanText.trim()) return s;   // waiting on the human's paragraph
    text = humanText.trim().slice(0, 1200);
  } else {
    text = await writeParagraph(s, seat);
  }
  s.paragraphs.push({ seat, name: s.seats[seat].name, text, round: s.round });
  return advanceStory(s);
}
