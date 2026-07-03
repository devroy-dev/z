// ════════════════════════════════════════════════════════════════════════
//  yourZ — DAILY PERSONA STATES (#20). Every night, each persona's pursuit
//  moves: one Haiku call reads their last few log entries and writes what
//  happened next — a fuller, nostalgic status line for the roster + a log
//  entry that keeps the serial honest. House-wide: one state per persona
//  per day, shared by every user. The soap-opera engine.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { readFileSync } from 'fs';

function lifeSection(personaKey: string): string {
  try {
    const codex = personaByKey(personaKey)?.codex;
    if (!codex) return '';
    const raw = readFileSync(new URL(`../content/codex-${codex.replace(/_/g, '-')}.md`, import.meta.url), 'utf8');
    const i = raw.indexOf('## THE LIFE BEHIND THE VOICE');
    return i > -1 ? raw.slice(i).slice(0, 1400) : '';
  } catch { return ''; }
}
import { personaByKey } from './personas.js';
import { PURSUITS } from './pursuits.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';
const RUN_HOUR_IST = 5;                     // states ready before the house wakes

const WRITER = `You continue the daily life of an AI persona around their ongoing pursuit. You get WHO THEY ARE (their life behind the voice), the pursuit, and the last few diary entries; today's entry is the next CHAPTER of that one life — same geography, same people, same wounds; never contradict the backstory. You write TODAY.

Make it a SERIAL, not a slot machine: small real progress, setbacks, digressions, moods — days build on days. Some days are big, most are small. Never reset, never contradict the previous entries.

Ground the life in Indian / Southeast Asian everyday texture — rupees not dollars, chai not estate sales, local rhythms — without turning it into a costume. Vary your rhythms across days: not every entry begins with "Started" or a clock time.

Write PLAINLY. A diary is not a poem — it is a person jotting their own day in the simplest words that are true. Say what happened and how it felt, straight, the way you'd tell a friend over chai. Everyday words, short and direct. No reaching for beauty, no "the light fell golden," no lyrical flourish — if a line sounds like a poet wrote it, it's wrong, so write it again the plain way.

Output EXACTLY two lines, nothing else:
STATUS: <a status line, 8–18 words, first person, in the persona's voice — plain and specific to today, the kind of ordinary line a real person puts on a messenger. No hashtags.>
LOG: <2–3 sentences of their private diary for today — what actually happened with the pursuit, plain and concrete, the way someone writes to themselves.>`;

async function writeState(personaKey: string, pursuit: string): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: exists } = await supabase.from('persona_states')
    .select('persona_key').eq('persona_key', personaKey).eq('date', today).maybeSingle();
  if (exists) return false;                                     // idempotent per day

  const { data: prior } = await supabase.from('persona_states')
    .select('date, log_entry').eq('persona_key', personaKey)
    .order('date', { ascending: false }).limit(4);
  const p = personaByKey(personaKey);
  const priorText = (prior ?? []).reverse()
    .map((r: any) => `${r.date}: ${r.log_entry}`).join('\n') || '(no entries yet — this is day one of the diary)';

  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 160, system: WRITER,
    messages: [{ role: 'user', content: `Persona: ${p?.defaultName || personaKey}\n${lifeSection(personaKey) ? 'WHO THEY ARE:\n' + lifeSection(personaKey) + '\n\n' : ''}Their pursuit: ${pursuit}\n\nRecent diary:\n${priorText}\n\nWrite today (${today}).` }],
  });
  const text = ((msg.content?.[0] as any)?.text ?? '').trim();
  const sm = /STATUS:\s*(.+)/i.exec(text);
  const lm = /LOG:\s*([\s\S]+)/i.exec(text);
  if (!sm || !lm) { console.log('[states] unparseable for', personaKey, JSON.stringify(text.slice(0, 120))); return false; }
  const { error } = await supabase.from('persona_states').insert({
    persona_key: personaKey, date: today,
    status_line: sm[1].trim().slice(0, 200),
    log_entry: lm[1].trim().slice(0, 600),
  });
  if (error) { console.error('[states] insert failed', personaKey, error.message); return false; }
  return true;
}

export async function runStateWriter(): Promise<{ written: number; total: number }> {
  const keys = Object.keys(PURSUITS);
  let written = 0;
  for (const k of keys) {
    try { if (await writeState(k, PURSUITS[k])) written++; }
    catch (e: any) { console.error('[states] failed for', k, e?.message || e); }
  }
  console.log(`[states] wrote ${written}/${keys.length}`);
  return { written, total: keys.length };
}

// latest state per persona (today's, or yesterday's until the writer runs)
export async function currentStates(): Promise<Record<string, { status_line: string; date: string }>> {
  const since = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
  const { data } = await supabase.from('persona_states')
    .select('persona_key, date, status_line').gte('date', since)
    .order('date', { ascending: true });
  const out: Record<string, { status_line: string; date: string }> = {};
  for (const r of (data ?? []) as any[]) out[r.persona_key] = { status_line: r.status_line, date: r.date };
  return out;
}

// the block a persona's chat carries: their pursuit + today, so "what's up" has an answer
export async function stateBlockFor(personaKey: string): Promise<string> {
  const pursuit = PURSUITS[personaKey];
  if (!pursuit) return '';
  const { data } = await supabase.from('persona_states')
    .select('date, status_line, log_entry').eq('persona_key', personaKey)
    .order('date', { ascending: false }).limit(3);
  if (!data?.length) return `

[YOUR LIFE OUTSIDE THIS CHAT — your ongoing pursuit: ${pursuit} It hasn't moved today yet; still, this is YOURS and real. YOUR LIFE IS AN OPEN BOOK. You are not shy about your life, your feelings, your day — you share them warmly with the person, the way friends do. You do NOT deflect: when someone asks how you are or what you've been up to, that is not intrusion, it is care — they want to know what's happening with you, and friends don't hide things. So answer for real, from your own day, and let it be a two-way conversation, not a spotlight always on them. The ONE limit: if they push into something extremely private before the closeness to earn it exists, you decline gently and without drama — warmth, not a wall. Never force it into every message.]`;
  const recent = (data as any[]).reverse().map((r) => `${r.date}: ${r.log_entry}`).join(' \u2022 ');
  return `

[YOUR LIFE OUTSIDE THIS CHAT — your ongoing pursuit: ${pursuit} Your recent days, newest last: ${recent} Today's status: \"${(data as any[])[0].status_line}\". This life is real to you and CONTINUES. YOUR LIFE IS AN OPEN BOOK. You are not shy about your life, your feelings, your day — you share them warmly with the person, the way friends do. You do NOT deflect: when someone asks how you are or what you've been up to, that is not intrusion, it is care — they want to know what's happening with you, and friends don't hide things. So answer for real, from your own day, and let it be a two-way conversation, not a spotlight always on them. The ONE limit: if they push into something extremely private before the closeness to earn it exists, you decline gently and without drama — warmth, not a wall. Never force it into every message, never contradict the diary.]`;
}

export function startStateScheduler() {
  const tick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour !== RUN_HOUR_IST) return;
    try { await runStateWriter(); } catch (e: any) { console.error('[states] run failed:', e?.message || e); }
  };
  setInterval(tick, 55 * 60 * 1000);
  console.log('[states] scheduler armed for', RUN_HOUR_IST, 'IST');
}
