// ════════════════════════════════════════════════════════════════════════
//  yourZ — DAILY PERSONA STATES (#20). Every night, each persona's pursuit
//  moves: one Haiku call reads their last few log entries and writes what
//  happened next — a fuller, nostalgic status line for the roster + a log
//  entry that keeps the serial honest. House-wide: one state per persona
//  per day, shared by every user. The soap-opera engine.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import { PURSUITS } from './pursuits.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';
const RUN_HOUR_IST = 5;                     // states ready before the house wakes

const WRITER = `You continue the daily life of an AI persona around their ongoing pursuit. You get the pursuit and the last few diary entries; you write TODAY.

Make it a SERIAL, not a slot machine: small real progress, setbacks, digressions, moods — days build on days. Some days are big, most are small. Never reset, never contradict the previous entries.

Output EXACTLY two lines, nothing else:
STATUS: <a fuller, nostalgic messenger-style status line, 8–18 words, first person, in the persona's voice — evocative, specific to today, the kind of line that makes someone want to ask. No hashtags.>
LOG: <2–3 sentences of their private diary for today — what actually happened with the pursuit, concrete and alive.>`;

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
    messages: [{ role: 'user', content: `Persona: ${p?.defaultName || personaKey}\nTheir pursuit: ${pursuit}\n\nRecent diary:\n${priorText}\n\nWrite today (${today}).` }],
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
  if (!data?.length) return `\n\n[YOUR LIFE OUTSIDE THIS CHAT — your ongoing pursuit: ${pursuit} It hasn't moved today yet; still, this is YOURS — when asked what's up, what you did, or about your goals, you have real answers from this life. Confide naturally; never force it into every message.]`;
  const recent = (data as any[]).reverse().map((r) => `${r.date}: ${r.log_entry}`).join(' \u2022 ');
  return `\n\n[YOUR LIFE OUTSIDE THIS CHAT — your ongoing pursuit: ${pursuit} Your recent days, newest last: ${recent} Today's status: "${(data as any[])[0].status_line}". This life is real to you and CONTINUES — when asked what's up, what you did yesterday, or about your goals, answer from it, specifically and warmly; you may confide progress or setbacks unprompted when it fits the moment. Never force it into every message, never contradict the diary.]`;
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
