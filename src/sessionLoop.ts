// ════════════════════════════════════════════════════════════════════════
//  Z — sessionLoop · THE SESSION's phase controller (ROOMS_SPEC_V2 §4)
//  Two humans and ONE moderator presence in a structured, consented sitting.
//  This controller sits ABOVE the room: it holds session_state (format,
//  phase, whose floor), gates every machine turn to the moderator ONLY —
//  no DIRECTOR casting inside sessions — and enforces the floor SOFTLY:
//  off-turn human words always persist and render (house law: never block
//  a human's words here); the moderator's next move re-holds the floor.
//
//  NEVER THERAPY: the moderator is a wise friend holding the room — she
//  mirrors, structures, asks, reflects. She never diagnoses, never labels,
//  never treats, and the word therapy never renders. NEVER CAPTIVE: either
//  party ends it in one tap. NEVER LEAKY: session content is excluded from
//  every harvester (the wall — see the is_session guards across the engine)
//  and inbox previews read "a session", never content. NEVER A CAGE FOR
//  DANGER: the crisis ramp rides every turn prompt — at signs of abuse
//  dynamics, threats, or crisis she stops mediating, says so plainly,
//  points at real help, and offers to end the sitting.
//
//  The battlefield's format modules inherit this chassis later — the moat
//  outranks the arcade (the reversed dependency, deliberate).
// ════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { supabase } from './db.js';
import { llm } from './llm.js';
import { logUsage } from './usage.js';
import { readContentFile } from './content.js';
import { broadcastRoomMessage } from './broadcast.js';

const anthropic = llm();
const MODEL = 'claude-haiku-4-5-20251001';   // cost discipline: Haiku; moderator turns are few by design

// ── format modules: authored JSON, versioned, zero model cost to load ────
export interface SessionPhase { id: string; title: string; floor: 'a' | 'b' | 'both'; move: string; }
export interface SessionFormat { id: string; title: string; line: string; phases: SessionPhase[]; }
const __dir = path.dirname(fileURLToPath(import.meta.url));
const FORMAT_IDS = ['clear_the_air', 'check_in', 'cofounder', 'bridge'] as const;
const formats: Record<string, SessionFormat> = {};
for (const id of FORMAT_IDS) {
  try {
    const p = path.join(__dir, 'content', 'sessions', `${id}.json`);
    formats[id] = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) { console.error('[session] format load failed:', id, e); }
}
export const sessionFormat = (id: string): SessionFormat | null => formats[id] || null;
export const sessionFormats = (): SessionFormat[] => FORMAT_IDS.map((i) => formats[i]).filter(Boolean);

export interface SessionRow {
  id: string; thread_id: string; format: string; moderator_key: string;
  initiator: string; invitee: string | null; status: string;
  phase: number; floor_holder: string | null;
}

export async function sessionByThread(threadId: string): Promise<SessionRow | null> {
  const { data } = await supabase.from('sessions')
    .select('id, thread_id, format, moderator_key, initiator, invitee, status, phase, floor_holder')
    .eq('thread_id', threadId).maybeSingle();
  return (data as any) || null;
}

const floorUid = (s: SessionRow, floor: 'a' | 'b' | 'both'): string | null =>
  floor === 'a' ? s.initiator : floor === 'b' ? (s.invitee || null) : null;

async function namesFor(s: SessionRow): Promise<{ a: string; b: string; byUid: Record<string, string> }> {
  const ids = [s.initiator, s.invitee].filter(Boolean) as string[];
  const { data } = await supabase.from('users').select('id, display_name').in('id', ids);
  const byUid: Record<string, string> = {};
  for (const u of (data ?? []) as any[]) byUid[u.id] = u.display_name || 'someone';
  return { a: byUid[s.initiator] || 'someone', b: (s.invitee && byUid[s.invitee]) || 'someone', byUid };
}

// ── the moderator's laws, engine-owned (structure is the engine's truth;
//    her manner comes from her codex — the soul never carries mechanics) ──
const SESSION_LAWS = `
[THE SITTING — STRUCTURAL LAWS. These govern HOW the room runs; your codex governs WHO you are.]
- You are the only presence besides the two of them. You hold the room; you do not own it.
- NEVER therapy: do not diagnose, do not label anyone or their patterns with clinical words, do not treat. You are a wise friend holding the room — mirror, structure, ask, reflect. The word "therapy" must never appear.
- SILENCE IS YOUR DEFAULT while they are talking to each other within a phase. Speak only when the sitting needs you: opening a phase, gently re-holding the floor, correcting a clear mishearing when the format asks for it, or the crisis ramp. If the room does not need you this turn, reply with exactly [[SILENT]] and nothing else.
- THE FLOOR IS SOFT. If someone speaks off-turn, their words stand — acknowledge them warmly in one short line and re-hold the floor ("I want to hear that — hold it one moment; NAME hasn't finished"). Never scold, never call it a violation.
- NEVER a verdict. No winner, no who-was-right, no homework framed as prescription. The close is a both-sided reflection: what each said they needed, what was heard, one small thing each could carry out — offered, never assigned.
- PHASES: when the current phase feels genuinely complete — both have had what the phase asks for — end your reply with the tag [[ADVANCE]] on its own last line, and let your reply itself bridge into what comes next. Do not rush phases; do not stall them either.
- THE CLOSE: only in the final phase, when the reflection has been given in full, end with [[CLOSE]] on its own last line instead of [[ADVANCE]].
- THE CRISIS RAMP (overrides everything above): at signs of abuse dynamics, threats, self-harm, or crisis, STOP mediating. Say plainly, in your own warm register, that this room isn't the right help for what's happening; point them to real support (a trusted person, a local helpline, emergency services if anyone is in danger); and offer to end the sitting — the end is one tap away for both of them. Do not continue the format over a crisis. Do not use [[ADVANCE]] in a crisis turn.
- Keep every line short and human. No lists, no headers, no meta-commentary about phases or tags — the machinery is invisible; only the warmth shows.`;

// build the moderator's turn. Static prefix (cache-stable): codex + laws +
// format. Dynamic: state + names + transcript + this turn's situation.
function buildPrompt(s: SessionRow, fmt: SessionFormat, names: { a: string; b: string }) {
  const codex = readContentFile('codex-healer.md');
  const phasesFlat = fmt.phases.map((p, i) => `${i}. ${p.title} — floor: ${p.floor === 'a' ? names.a : p.floor === 'b' ? names.b : 'open'} — your move when opening it: ${p.move.replace(/\{A\}/g, names.a).replace(/\{B\}/g, names.b)}`).join('\n');
  const staticPrefix = `${codex}\n\n${SESSION_LAWS}\n\n[THE FORMAT — "${fmt.title}"]\n${phasesFlat}`;
  return staticPrefix;
}

async function transcript(threadId: string, byUid: Record<string, string>): Promise<string> {
  const { data } = await supabase.from('messages')
    .select('role, content, persona_key, sender_user_id, created_at')
    .eq('thread_id', threadId).order('created_at', { ascending: false }).limit(40);
  const lines = (data ?? []).reverse().map((m: any) =>
    m.role === 'user' ? `${byUid[m.sender_user_id] || 'someone'}: ${m.content}` : `YOU: ${m.content}`);
  return lines.join('\n');
}

const strip = (s: string) => s.replace(/\[\[(SILENT|ADVANCE|CLOSE)\]\]/g, '').trim();

async function speak(s: SessionRow, text: string): Promise<void> {
  // the pacing law: nothing machine-instant — the room takes a breath.
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1800));
  const { data: saved } = await supabase.from('messages').insert({
    thread_id: s.thread_id, user_id: s.initiator, role: 'assistant',
    content: text, persona_key: s.moderator_key,
  }).select('id').maybeSingle();
  await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', s.thread_id);
  await broadcastRoomMessage(s.thread_id, {
    role: 'assistant', content: text, persona_key: s.moderator_key,
    id: (saved as any)?.id ?? null,
    inboxPreviewOverride: 'a session',   // THE WALL: previews never carry content
  });
}

async function moderatorTurn(s: SessionRow, situation: string): Promise<void> {
  const fmt = sessionFormat(s.format);
  if (!fmt) return;
  const names = await namesFor(s);
  const phase = fmt.phases[Math.min(s.phase, fmt.phases.length - 1)];
  const isFinal = s.phase >= fmt.phases.length - 1;
  const holder = floorUid(s, phase.floor);
  const dyn = [
    `[THE SITTING NOW] phase ${s.phase} — "${phase.title}". ${holder ? `The floor is ${names.byUid[holder] || 'theirs'}'s.` : 'The floor is open to both.'} ${isFinal ? 'This is the FINAL phase — it ends with [[CLOSE]], never [[ADVANCE]].' : ''}`,
    `[THE PEOPLE] ${names.a} began the sitting; ${names.b} accepted.`,
    `[THE ROOM SO FAR]\n${await transcript(s.thread_id, names.byUid)}`,
    `[THIS TURN] ${situation}`,
  ].join('\n\n');
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 400,
      system: buildPrompt(s, fmt, names),
      messages: [{ role: 'user', content: dyn }],
    });
    logUsage({ userId: s.initiator, threadId: s.thread_id, personaKey: s.moderator_key, surface: 'other', fn: 'session-mod', model: MODEL, usage: (resp as any).usage });
    const raw = resp.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    const advance = /\[\[ADVANCE\]\]/.test(raw) && !isFinal;
    const close = /\[\[CLOSE\]\]/.test(raw) && isFinal;
    const text = strip(raw);
    if (/^\[\[SILENT\]\]$/.test(raw.trim()) || (!text && !advance && !close)) return;   // the silence law
    if (text) await speak(s, text);
    if (advance) {
      const next = fmt.phases[s.phase + 1];
      await supabase.from('sessions').update({
        phase: s.phase + 1,
        floor_holder: floorUid({ ...s, phase: s.phase + 1 } as SessionRow, next.floor),
      }).eq('id', s.id);
    }
    if (close) {
      await supabase.from('sessions').update({ status: 'closed', closed_at: new Date().toISOString(), floor_holder: null }).eq('id', s.id);
    }
  } catch (e: any) { console.error('[session-mod] turn failed:', e?.message || e); }
}

// the arrival: fires once when the invitee accepts and the room goes live.
export async function openSessionArrival(s: SessionRow): Promise<void> {
  const fmt = sessionFormat(s.format);
  if (!fmt) return;
  await supabase.from('sessions').update({ floor_holder: floorUid(s, fmt.phases[0].floor) }).eq('id', s.id);
  await moderatorTurn({ ...s, phase: 0 }, 'The sitting just went LIVE — both of them are here for the first time. Open the arrival phase per the format.');
}

// every coalesced human turn lands here (the coalescer batches bursts and
// feeds the controller — /chat already persisted + broadcast the words).
export async function runSessionTurn(input: { threadId: string; senderUserId: string; message: string }): Promise<void> {
  const s = await sessionByThread(input.threadId);
  if (!s || s.status !== 'live') return;
  const offTurn = !!(s.floor_holder && s.floor_holder !== input.senderUserId);
  const situation = offTurn
    ? 'Someone just spoke OFF-TURN while the floor was held. Their words stand — acknowledge warmly in one short line and re-hold the floor. Do not advance the phase this turn.'
    : 'They are talking within the phase. Silence is your default — [[SILENT]] unless the phase needs opening, has just become complete ([[ADVANCE]] / [[CLOSE]] per the laws), a clear mishearing needs the gentlest correction, or the crisis ramp applies.';
  await moderatorTurn(s, situation);
}

// the plain room line when either party ends it early — no guilt, no coda.
export async function sessionEndedLine(s: SessionRow): Promise<void> {
  try {
    const { data: saved } = await supabase.from('messages').insert({
      thread_id: s.thread_id, user_id: s.initiator, role: 'assistant',
      content: 'the sitting has ended.', persona_key: s.moderator_key,
    }).select('id').maybeSingle();
    await broadcastRoomMessage(s.thread_id, {
      role: 'assistant', content: 'the sitting has ended.', persona_key: s.moderator_key,
      id: (saved as any)?.id ?? null, inboxPreviewOverride: 'a session',
    });
  } catch (e) { /* best effort */ }
}
