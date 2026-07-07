// overseer.ts — Z stepping back to read the week and write to the person.
// Runs nightly (3–4am). For each active user:
//   * DAILY  → a short anecdote (one human moment from the day)
//   * WEEKLY → the letter (first person, addressed to them, the week tied together)
// Reads feeling, never mind. Not a persona — no user talks to it. Writes via the
// service-role client (bypasses RLS), into z.user_summaries (kind: daily|weekly).
import Anthropic from '@anthropic-ai/sdk';
import { llm } from './llm.js';
import { supabase } from './db.js';
import { soulFor } from './content.js';
import { runRoomMemoryHarvest } from './roomMemory.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES = [join(__dirname, 'content'), join(__dirname, '..', 'content')];
const CONTENT = CANDIDATES.find((p) => existsSync(p)) ?? CANDIDATES[0];
const OVERSEER_CODEX = (() => {
  try { return readFileSync(join(CONTENT, 'codex-overseer.md'), 'utf8'); } catch { return ''; }
})();

interface DayMsg { role: string; content: string; created_at: string; }

// pull a user's messages across all threads in a time window
async function windowMessages(userId: string, sinceISO: string): Promise<DayMsg[]> {
  const { data } = await supabase
    .from('messages')
    .select('role, content, created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });
  const msgs = (data ?? []) as DayMsg[];
  // fold in voice-journal transcripts from the same window — overseer material under the
  // same codex. marked so the overseer knows it was spoken aloud (rawer, more honest).
  const { data: journals } = await supabase
    .from('journal_entries')
    .select('transcript, created_at')
    .eq('user_id', userId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });
  for (const j of (journals ?? []) as any[]) {
    msgs.push({ role: 'user', content: `(voice journal) ${j.transcript}`, created_at: j.created_at });
  }
  msgs.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return msgs;
}

// render a transcript the overseer can read (only the person's side carries the feeling,
// but assistant turns give context for what they were responding to)
function transcript(msgs: DayMsg[]): string {
  return msgs.map((m) => `${m.role === 'user' ? 'THEM' : 'Z'}: ${m.content}`).join('\n');
}

async function ownerName(userId: string): Promise<string> {
  const { data } = await supabase.from('users').select('display_name').eq('id', userId).maybeSingle();
  return data?.display_name || 'you';
}

// one overseer generation (anecdote or letter)
async function compose(kind: 'daily' | 'weekly', userId: string, msgs: DayMsg[]): Promise<string | null> {
  if (!msgs.length) return null;
  const name = await ownerName(userId);
  const soul = soulFor(name, null);
  const task = kind === 'daily'
    ? `Below is everything ${name} said to you today, across their threads. Write a single short ANECDOTE — one small human moment you noticed today. Two or three sentences. Warm, specific, no verdict, no advice. Just: I saw this. Write it as a note to yourself about them, in your voice. If today held nothing worth noting, reply with exactly: SKIP`
    : `Below is everything ${name} said to you this week, across their threads. Write the weekly LETTER — first person, addressed to ${name} as "you", tying the week together: where it started, where it went, the thread that ran through it, the unexpected light. Honest but kind. End with warmth, never a task. This is the gift that makes them feel seen. Follow your Overseer codex exactly — feeling never diagnosis, no numbers, no appearance, and if real danger or the deeper body/eating signals showed, handle them as the codex says (stay warm, bridge to real region-appropriate help). If the week held too little to write honestly, reply with exactly: SKIP`;

  const system = `${soul}\n\n[YOU ARE THE OVERSEER. This is your preparation — how you read a week and write back. You never name it.]\n${OVERSEER_CODEX}`;
  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: kind === 'daily' ? 220 : 700,
    system,
    messages: [{ role: 'user', content: `${task}\n\n--- TRANSCRIPT ---\n${transcript(msgs)}` }],
  });
  const text = r.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('').trim();
  if (!text || text === 'SKIP' || text.toUpperCase() === 'SKIP') return null;
  return text;
}

function todayRange() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  // "today" = the day that just ended; run at 3am means look back 24h+
  const since = new Date(now.getTime() - 30 * 60 * 60 * 1000); // last 30h, generous
  return { sinceISO: since.toISOString(), periodStart: start, periodEnd: now };
}

export async function runOverseer(opts: { weekly?: boolean; onlyUser?: string } = {}): Promise<{ daily: number; weekly: number }> {
  const doWeekly = !!opts.weekly;
  let daily = 0, weekly = 0;

  // active users = anyone with a message in the last 24h (daily) / 8d (weekly)
  const lookback = doWeekly ? 8 : 2;
  const since = new Date(Date.now() - lookback * 24 * 60 * 60 * 1000).toISOString();
  let userIds: string[];
  if (opts.onlyUser) {
    userIds = [opts.onlyUser];
  } else {
    const { data: actives } = await supabase
      .from('messages').select('user_id').gte('created_at', since);
    userIds = [...new Set<string>((actives ?? []).map((r: any) => String(r.user_id)))];
  }

  for (const userId of userIds) {
    try {
      // DAILY anecdote
      const { sinceISO, periodStart, periodEnd } = todayRange();
      const dayMsgs = await windowMessages(userId, sinceISO);
      const anecdote = await compose('daily', userId, dayMsgs);
      if (anecdote) {
        await supabase.from('user_summaries').insert({
          user_id: userId, kind: 'daily', body: anecdote,
          period_start: periodStart.toISOString().slice(0, 10),
          period_end: periodEnd.toISOString().slice(0, 10),
        });
        daily++;
      }
      // WEEKLY letter (only on the weekly run)
      if (doWeekly) {
        const weekSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekMsgs = await windowMessages(userId, weekSince.toISOString());
        const letter = await compose('weekly', userId, weekMsgs);
        if (letter) {
          await supabase.from('user_summaries').insert({
            user_id: userId, kind: 'weekly', body: letter,
            period_start: weekSince.toISOString().slice(0, 10),
            period_end: new Date().toISOString().slice(0, 10),
          });
          weekly++;
        }
      }
    } catch (e) {
      console.error('[overseer] user', userId, 'failed:', (e as any)?.message || e);
    }
  }
  console.log(`[overseer] done — ${daily} anecdotes, ${weekly} letters`);
  return { daily, weekly };
}

// CLI entry: `node dist/overseer-run.js`        → daily only
//            `node dist/overseer-run.js weekly` → daily + weekly
if (process.argv[1]?.includes('overseer-run')) {
  runOverseer({ weekly: process.argv.includes('weekly') })
    .then(async (r) => { const rm = await runRoomMemoryHarvest(); console.log(r, rm); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
}
