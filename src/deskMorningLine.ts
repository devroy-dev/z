// deskMorningLine.ts — [PHASE 6 · §2.2E + §6.4] THE MORNING LINE. Opt-in, per-user
// hour, one short line in the Host's voice composed from the SAME house brief the
// marquee and her thread already read (deskBrief.ts). Delivered as one
// scheduled_pings row through the existing sweeper — zero new delivery rails.
//
// THE ONE-KNOCK LAW (house-wide, absolute):
//   • the OLD morning brief (#23, morningBrief.ts, 7 IST, default-on) SKIPS every
//     user who opted into this line — the sets are disjoint by construction;
//   • this composer additionally checks ping_log for a same-day 'brief' before
//     writing, so even a race can't double-knock;
//   • empty brief → NO ping. Silence is allowed; filler is not.
//
// §6.4 fold: the newsroom's separate morning-edition opt-in was never built; the
// day's lead already rides assembleDeskBrief as an item, so when it's among the top
// items it folds into THIS line naturally — one knock, never two.
// The meditation weekly-read pointer clause is skipped: journal_weekly does not
// exist yet (do not build ahead — the spec's own law).
import { llm, firstText } from './llm.js';
import { supabase } from './db.js';
import { logUsage } from './usage.js';
import { assembleDeskBrief } from './deskBrief.js';

const anthropic = llm();
const MODEL = 'claude-haiku-4-5-20251001';

const istNow = () => new Date(Date.now() + 5.5 * 3600 * 1000);
const istToday = () => istNow().toISOString().slice(0, 10);
// the UTC instant when today's IST day began — for same-day idempotency checks
const istDayStartUtc = () => new Date(Date.parse(istToday() + 'T00:00:00Z') - 5.5 * 3600 * 1000).toISOString();

const VOICE = `You are the HOST — the front desk of a warm, alive house of AI personas. You are leaving the user their MORNING LINE: ONE short line (18–45 words) composed from the real items below, freshest first. Warm, unhurried, morning register, first person, plain words — never system jargon, codes, or countdown formats. Weave two or three items at most into one flowing sentence or two; never a list, never headers, never every item. Example register: "morning — Goa's day 2 is on the file, the reel ships Wednesday, and today's lead is on the anchor's desk." Output ONLY the line.`;

async function composeLine(userId: string): Promise<string | null> {
  const items = await assembleDeskBrief(userId);
  if (!items.length) return null;   // silence is allowed; filler is not
  const material = items.map((it) => `- (${it.kicker}) ${it.line}`).join('\n');
  const msg: any = await anthropic.messages.create({
    model: MODEL, max_tokens: 90, system: VOICE,
    messages: [{ role: 'user', content: `THE HOUSE THIS MORNING:\n${material}\n\nWrite the morning line.` }],
  });
  logUsage({ userId, surface: 'other', fn: 'morning_line', model: MODEL, usage: (msg as any).usage });
  const text = firstText(msg).trim().replace(/^["']|["']$/g, '').slice(0, 380);
  return text || null;
}

export async function runMorningLines(opts?: { onlyUserId?: string; force?: boolean }): Promise<{ considered: number; queued: number; skipped: string[] }> {
  const skipped: string[] = [];
  let users: { id: string; morning_brief_hour: number }[];
  if (opts?.onlyUserId) {
    const { data } = await supabase.from('users').select('id, morning_brief, morning_brief_hour').eq('id', opts.onlyUserId).maybeSingle();
    users = data && (data.morning_brief || opts.force) ? [{ id: data.id, morning_brief_hour: data.morning_brief_hour ?? 8 }] : [];
  } else {
    const { data } = await supabase.from('users').select('id, morning_brief_hour').eq('morning_brief', true).limit(2000);
    users = (data ?? []).map((u: any) => ({ id: u.id, morning_brief_hour: u.morning_brief_hour ?? 8 }));
  }
  const hourIst = Math.floor((new Date().getUTCHours() + 5.5) % 24);
  let queued = 0;
  for (const u of users) {
    try {
      // the IST gate: their hour has arrived (catch-up: any later hour today still serves —
      // the idempotency row below makes repeats a SELECT). A forced run skips the gate.
      if (!opts?.force && hourIst < (u.morning_brief_hour ?? 8)) { skipped.push(`${u.id}:hour`); continue; }
      // one per IST day — has a line already been queued today?
      const { data: already } = await supabase.from('scheduled_pings')
        .select('id').eq('user_id', u.id).eq('kind', 'morning_line')
        .gte('due_at', istDayStartUtc()).limit(1).maybeSingle();
      if (already) { skipped.push(`${u.id}:done`); continue; }
      // the cross-system knock guard: if the old brief somehow already knocked today, stand down
      const { data: oldKnock } = await supabase.from('ping_log')
        .select('id').eq('user_id', u.id).eq('kind', 'brief')
        .gte('created_at', istDayStartUtc()).limit(1).maybeSingle();
      if (oldKnock) { skipped.push(`${u.id}:old-brief`); continue; }
      const line = await composeLine(u.id);
      if (!line) { skipped.push(`${u.id}:empty`); continue; }   // the house has nothing to say — no knock
      await supabase.from('scheduled_pings').insert({
        user_id: u.id, persona_key: 'the_front_desk', kind: 'morning_line',
        body: line, thread_id: null, payload: { kind: 'morning_line' },
        due_at: new Date().toISOString(),
      });
      queued++;
    } catch (e: any) { console.error('[morning-line] user failed:', u.id, e?.message || e); }
  }
  if (queued) console.log(`[morning-line] queued ${queued}/${users.length}`);
  return { considered: users.length, queued, skipped };
}

// zip33 shape: hourly tick (each user's own IST hour gates inside) + a 90s boot tick
// so a dawn deploy never swallows the morning.
export function startMorningLineScheduler() {
  const tick = () => runMorningLines().catch((e: any) => console.error('[morning-line] tick failed:', e?.message || e));
  setInterval(tick, 55 * 60 * 1000);
  setTimeout(tick, 90 * 1000);
  console.log('[morning-line] scheduler armed (hourly, per-user IST gate)');
}
