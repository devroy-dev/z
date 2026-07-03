// doorman.ts — the moderator for public rooms. Public = strangers, so this is the
// license to exist, not a feature. Two layers:
//   Layer 1 (deterministic, SYNC, before insert): hard classes — slurs, sexual-
//     explicit, doxxing patterns, spam floods. A hit blocks the message entirely
//     (never persists, never broadcasts) and records a strike. This is the real
//     safety guarantee, because Layer 2 is async and can't stop a message landing.
//   Layer 2 (the judge, ASYNC, after a clean message lands): one cheap Haiku turn
//     classifying {harassment, hate, sexual, spam, incitement, none} + severity,
//     which writes strikes and can escalate.
// Escalation ladder (automatic): strike 1 -> in-room warning; 2 -> mute 15m;
//   3 -> kick (rejoin after 24h); severe -> instant ban.

import { supabase } from './db.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const JUDGE_MODEL = process.env.MODERATION_MODEL || 'claude-haiku-4-5-20251001';

// ── Layer 1: deterministic classes ──────────────────────────────────────
// These patterns are intentionally conservative on the SEVERE classes (block +
// instant ban) and lighter on spam (strike, ladder handles it). Kept minimal and
// auditable rather than a giant list; the judge (Layer 2) catches the nuance.

// Severe: slurs / hate — a curated set of unambiguous slurs. Matching any = instant
// ban, message blocked. (Stored as a compact list; word-boundary + leetspeak-tolerant.)
const SEVERE_SLUR_STEMS = [
  // racial / ethnic / caste / homophobic slurs — unambiguous, block-on-sight.
  // (compact stems; the regex adds boundaries + common obfuscation.)
  'n1gger', 'nigger', 'n1gga', 'chink', 'sp1c', 'kike', 'faggot', 'f4ggot',
  'tranny', 'retard', 'paki', 'coon', 'wetback', 'gook', 'raghead',
  'bhangi', 'chamar', 'chuhra', // caste slurs (India/SEA target market)
];
function normalizeForSlur(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')      // strip punctuation used to break words
    .replace(/(.)\1{2,}/g, '$1$1');   // collapse elongation (niiiigger -> niiger-ish)
}
function hasSevereSlur(text: string): boolean {
  const n = normalizeForSlur(text);
  for (const stem of SEVERE_SLUR_STEMS) {
    const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${esc}\\b`, 'i').test(n)) return true;
  }
  // letter-spacing evasion ("f a g g o t"): ONLY collapse when the text actually
  // shows spaced single letters — collapsing everything would false-positive
  // ("raccoon"/"tycoon" contain "coon"). Detect a run of 3+ single letters split
  // by spaces, collapse just that, and re-test with word boundaries.
  if (/\b([a-z]\s+){2,}[a-z]\b/i.test(n)) {
    const collapsed = n.replace(/\b(?:[a-z]\s+){2,}[a-z]\b/gi, (m) => m.replace(/\s+/g, ''));
    for (const stem of SEVERE_SLUR_STEMS) {
      const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${esc}\\b`, 'i').test(collapsed)) return true;
    }
  }
  return false;
}

// Sexual-explicit: block-on-sight in a public room (severe → ban). Conservative:
// only unambiguous explicit acts, not profanity or flirtation.
const SEXUAL_EXPLICIT = /\b(cum\s?shot|blow\s?job|deep\s?throat|gang\s?bang|creampie|bukkake|\brape\b|child\s?porn|cp\b|loli|jailbait)\b/i;

// Doxxing: phone/address/ID dumps aimed at a person. Pattern-based (severe → ban).
const PHONE_DUMP = /(\+?\d[\d\s().-]{8,}\d)/;               // a long phone-like run
const ADDRESS_HINT = /\b(lives?\s+at|address\s+is|home\s+address|find\s+(?:him|her|them)\s+at)\b/i;
const ID_DUMP = /\b(aadhaar|aadhar|ssn|social\s+security|pan\s?card)\b.*\d/i;
function hasDoxx(text: string): boolean {
  // a phone/ID dump is doxx; an address hint alone is softer (strike, not ban) —
  // but paired with a number it's a dump.
  if (ID_DUMP.test(text)) return true;
  if (PHONE_DUMP.test(text) && (ADDRESS_HINT.test(text) || /\bhis|her|their|this guy|this girl\b/i.test(text))) return true;
  return false;
}

export type DoormanVerdict =
  | { action: 'allow' }
  | { action: 'block'; severity: 'severe' | 'low'; reason: string; sanction?: 'ban' | 'mute' | 'kick' };

// SYNC deterministic check — runs before insert. Returns a verdict.
export function deterministicCheck(text: string): DoormanVerdict {
  const t = String(text || '');
  if (hasSevereSlur(t)) return { action: 'block', severity: 'severe', reason: 'slur', sanction: 'ban' };
  if (SEXUAL_EXPLICIT.test(t)) return { action: 'block', severity: 'severe', reason: 'sexual-explicit', sanction: 'ban' };
  if (hasDoxx(t)) return { action: 'block', severity: 'severe', reason: 'doxxing', sanction: 'ban' };
  return { action: 'allow' };
}

// ── sanction state ───────────────────────────────────────────────────────
// Is this user currently barred from posting? Returns the active sanction or null.
export async function activeSanction(roomId: string, userId: string):
  Promise<{ kind: 'mute' | 'kick' | 'ban'; until: string | null } | null> {
  const { data } = await supabase.from('room_sanctions')
    .select('kind, until').eq('room_id', roomId).eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(5);
  const now = Date.now();
  for (const s of (data ?? []) as any[]) {
    if (s.kind === 'ban') return { kind: 'ban', until: null };        // permanent
    if (s.until && new Date(s.until).getTime() > now) return { kind: s.kind, until: s.until };
  }
  return null;
}

// ── the escalation ladder ─────────────────────────────────────────────────
// Record a strike, then act on the running count (rolling 24h window):
//   severe -> instant ban. Otherwise: 1 -> warn, 2 -> mute 15m, 3+ -> kick 24h.
// Returns an in-character doorman line to post in-room (or null if silent).
const MUTE_MS = 15 * 60 * 1000;
const KICK_MS = 24 * 60 * 60 * 1000;
const STRIKE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function recordStrikeAndEscalate(
  roomId: string, threadId: string, userId: string,
  severity: 'severe' | 'low', reason: string,
): Promise<{ doormanLine: string | null; sanctioned: 'ban' | 'mute' | 'kick' | null }> {
  await supabase.from('room_strikes').insert({ room_id: roomId, user_id: userId, severity, reason });

  if (severity === 'severe') {
    await supabase.from('room_sanctions').insert({ room_id: roomId, user_id: userId, kind: 'ban', until: null, reason });
    await removeFromThread(threadId, userId);
    return { doormanLine: "that's a hard line. you're out — this isn't the room for it.", sanctioned: 'ban' };
  }

  const since = new Date(Date.now() - STRIKE_WINDOW_MS).toISOString();
  const { count } = await supabase.from('room_strikes')
    .select('id', { count: 'exact', head: true })
    .eq('room_id', roomId).eq('user_id', userId).gte('created_at', since);
  const strikes = count || 1;

  if (strikes === 1) {
    return { doormanLine: 'easy in here — house rules on the wall. keep it civil.', sanctioned: null };
  }
  if (strikes === 2) {
    await supabase.from('room_sanctions').insert({
      room_id: roomId, user_id: userId, kind: 'mute',
      until: new Date(Date.now() + MUTE_MS).toISOString(), reason,
    });
    return { doormanLine: "that's a warning too many — muted for fifteen. cool off.", sanctioned: 'mute' };
  }
  // 3+ -> kick (removed from thread; may rejoin after 24h)
  await supabase.from('room_sanctions').insert({
    room_id: roomId, user_id: userId, kind: 'kick',
    until: new Date(Date.now() + KICK_MS).toISOString(), reason,
  });
  await removeFromThread(threadId, userId);
  return { doormanLine: "you've had your chances. out for the day — come back tomorrow ready to behave.", sanctioned: 'kick' };
}

async function removeFromThread(threadId: string, userId: string): Promise<void> {
  try { await supabase.from('room_members').delete().eq('thread_id', threadId).eq('user_id', userId); } catch (e) { /* best effort */ }
}

// post the doorman's action as a real in-room message (moderation with a face).
// messages.user_id is NOT NULL (denormalised for RLS), so we attribute the row to
// the user whose action triggered it — the content/persona_key mark it as the doorman.
export async function doormanSpeak(threadId: string, userId: string, line: string): Promise<void> {
  try {
    await supabase.from('messages').insert({
      thread_id: threadId, user_id: userId, role: 'assistant',
      content: line, persona_key: 'the_moderator',
    });
  } catch (e) { /* best effort */ }
}

// ── Layer 2: the judge (async) ─────────────────────────────────────────────
// One cheap classifier turn on a message that PASSED Layer 1. Writes a strike if
// it finds harassment/hate/sexual/incitement above a threshold. Never blocks (the
// message already landed); it feeds the ladder for next time / escalation.
export async function judge(roomId: string, threadId: string, userId: string, text: string): Promise<void> {
  try {
    const resp = await anthropic.messages.create({
      model: JUDGE_MODEL,
      max_tokens: 60,
      system:
        'You are a strict but fair chat moderator for a public room. Classify the MESSAGE into exactly one: ' +
        'harassment, hate, sexual, spam, incitement, or none. Also give severity: none, low, or severe. ' +
        'Flirtation, profanity, strong opinions, and heated debate are NOT violations — return none unless it targets or harms someone. ' +
        'Return ONLY compact JSON: {"class":"...","severity":"..."}. No prose.',
      messages: [{ role: 'user', content: `MESSAGE: ${String(text).slice(0, 1000)}` }],
    });
    const raw = resp.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const v = JSON.parse(clean) as { class: string; severity: string };
    if (!v || v.class === 'none' || v.severity === 'none') return;
    const severity = v.severity === 'severe' ? 'severe' : 'low';
    const { doormanLine } = await recordStrikeAndEscalate(roomId, threadId, userId, severity, `judge:${v.class}`);
    if (doormanLine) await doormanSpeak(threadId, userId, doormanLine);
  } catch (e) { /* judge is best-effort; Layer 1 is the hard guarantee */ }
}
