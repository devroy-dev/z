// ════════════════════════════════════════════════════════════════════════
//  yourZ — PERSONA FOLLOW-UPS (#18). The house speaks first.
//  Nightly: for each recently-active user, ONE Haiku call reads their open
//  tasks + memory and either stays silent or drafts ONE in-character ping
//  from the right persona ("so. did you talk to her?"). The ping lands in
//  that persona's thread; the Desk shows it as a note left at the desk.
//
//  LAWS: max ONE ping per user per day (idempotent via ping_log) · silence
//  is always a valid output · the SEATBELT runs in SHADOW MODE — it judges
//  every ping and its verdict is logged, but blocks nothing (calibration
//  corpus per the roadmap amendment; enforcement comes after real data).
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from './llm.js';
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import { seatbeltCheck } from './seatbelt.js';
import { logUsage } from './usage.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';
const RUN_HOUR_IST = 18;                       // ~6pm IST — the evening nudge

const SELECTOR = `You decide whether an AI persona should send ONE short, warm, easy-to-ignore follow-up message to a user tonight — and draft it if so.

You will see the user's open tasks and remembered facts. Look for ONE thing genuinely worth following up on: a task due/overdue, an event that has likely happened (an interview, a date, an exam, a doctor visit), something they said they'd do.

Rules:
- A task DUE within the next ~48 hours, or OVERDUE, ALWAYS warrants the follow-up — that is the clearest case there is. Pick it.
- If nothing rises to that bar and nothing event-like stands out, output exactly: NONE
- Otherwise output EXACTLY two lines and NOTHING else — no preamble, no quotes, no markdown:
PERSONA: <one of the allowed persona keys>
PING: <one short message (under 25 words) in that persona's voice — warm, specific, zero pressure, easy to ignore. Never guilt. Never "why haven't you". Reference the specific thing.>
- Persona fit: a task with a [suggested: X] → X. Otherwise: work/career → the_colleague or the_mentor; dating/crush → the_wingman; health/heavy → the_healer; money → the_economist; study/exam → the_teacher; anything else → the_front_desk.
- Multiple candidates: pick the single most timely one.

Example output:
PERSONA: the_colleague
PING: big pitch tomorrow morning, right? if you want a dry run tonight, I'm at my desk.`;

const ALLOWED = new Set(['the_colleague','the_mentor','the_wingman','the_healer','the_economist','the_teacher','the_front_desk','the_brother']);

const WRITER = `You write ONE short proactive message (under 25 words) from an AI persona to a user, following up on something specific. Warm, casual, zero pressure, easy to ignore. Never guilt, never "why haven't you". Reference the specific thing naturally. Output ONLY the message — no quotes, no preamble.`;

async function writePing(userId: string, personaKey: string, about: string): Promise<string | null> {
  const p = personaByKey(personaKey);
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 60, system: WRITER,
    messages: [{ role: 'user', content: `Persona: ${p?.defaultName || personaKey}. Following up on: ${about}` }],
  });
  logUsage({ userId, surface: 'other', fn: 'followup', model: MODEL, usage: (msg as any).usage });
  const text = firstText(msg).trim().replace(/^["']|["']$/g, '').slice(0, 240);
  return text || null;
}

async function draftFor(userId: string): Promise<{ personaKey: string; ping: string } | null> {
  const [{ data: tasks }, { data: mem }] = await Promise.all([
    supabase.from('tasks').select('title, notes, due_at, suggested_persona').eq('user_id', userId).eq('status', 'open').limit(15),
    supabase.from('memory').select('key, value, updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(25),
  ]);
  if (!(tasks?.length) && !(mem?.length)) { console.log('[followups] nothing to consider for', userId); return null; }

  // ── THE CLEAR CASE IS CODE'S JOB: a task due within 48h (or overdue) gets the ping, deterministically ──
  const soon = Date.now() + 48 * 3600e3;
  const dueTask = (tasks ?? [])
    .filter((t: any) => t.due_at && new Date(t.due_at).getTime() <= soon)
    .sort((a: any, b: any) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime())[0];
  if (dueTask) {
    const personaKey = (dueTask.suggested_persona && ALLOWED.has(dueTask.suggested_persona)) ? dueTask.suggested_persona : 'the_front_desk';
    const about = `their task "${dueTask.title}" (due ${String(dueTask.due_at).slice(0, 16)})${dueTask.notes ? ` — ${dueTask.notes}` : ''}`;
    console.log('[followups] deterministic pick for', userId, '→', personaKey, '·', dueTask.title);
    const ping = await writePing(userId, personaKey, about);
    return ping ? { personaKey, ping } : null;
  }

  const today = new Date().toISOString().slice(0, 10);
  const ctx = [
    `Today: ${today}`,
    tasks?.length ? `OPEN TASKS:\n${tasks.map((t: any) => `- ${t.title}${t.due_at ? ` (due ${String(t.due_at).slice(0, 10)})` : ''}${t.suggested_persona ? ` [suggested: ${t.suggested_persona}]` : ''}`).join('\n')}` : '',
    mem?.length ? `REMEMBERED:\n${mem.map((m: any) => `- ${m.key ? m.key + ': ' : ''}${m.value}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  console.log('[followups] selector ctx for', userId, '→', JSON.stringify(ctx.slice(0, 260)));
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 120, system: SELECTOR,
    messages: [{ role: 'user', content: ctx.slice(0, 4000) }],
  });
  logUsage({ userId, surface: 'other', fn: 'followup', model: MODEL, usage: (msg as any).usage });
  const text = firstText(msg).trim();
  console.log('[followups] selector for', userId, '→', JSON.stringify(text.slice(0, 220)));
  if (/^NONE\b/i.test(text)) return null;
  const pm = /PERSONA:\s*(\S+)/i.exec(text);
  const gm = /PING:\s*([\s\S]+)/i.exec(text);
  if (!pm || !gm) { console.log('[followups] unparseable selector output for', userId); return null; }
  const personaKey = pm[1].trim();
  const ping = gm[1].trim().replace(/^["']|["']$/g, '').slice(0, 240);
  if (!ALLOWED.has(personaKey) || !personaByKey(personaKey) || !ping) return null;
  return { personaKey, ping };
}

async function threadFor(userId: string, personaKey: string): Promise<string | null> {
  const p = personaByKey(personaKey)!;
  const { data: ex } = await supabase.from('threads')
    .select('id').eq('user_id', userId).eq('persona_key', personaKey)
    .eq('is_group', false).is('deleted_at', null)
    .order('last_active', { ascending: false }).limit(1).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from('threads').insert({
    user_id: userId, persona_key: personaKey, codex_key: p.codex,
    companion_name: p.defaultName,
  }).select('id').single();
  return error ? null : data.id;
}

const BUZZERS = ['the_comic','the_brother','the_wingman','the_screen_junkie','the_cousin','the_diva','the_wannabe','the_guru'];   // [§3.1] hippie folded — the guru inherits the slot

async function todaysState(personaKey: string): Promise<{ status_line: string; log_entry: string } | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from('persona_states')
    .select('status_line, log_entry').eq('persona_key', personaKey).eq('date', today).maybeSingle();
  return (data as any) ?? null;
}

// a buzz: a short, low-effort nudge — "oi, you alive?" — that now lands in the
// persona's OWN thread (Relocation) so it shows as an unread, not just a desk card.
async function sendBuzz(userId: string): Promise<boolean> {
  const personaKey = BUZZERS[Math.floor(Math.random() * BUZZERS.length)];
  const opener = await writePing(userId, personaKey, 'a quick, low-key nudge just to poke the user — one short line, like texting "oi, you alive?" or "thinking of you, that\'s all" — casual, tiny, zero agenda');
  if (!opener) return false;
  const threadId = await threadFor(userId, personaKey);
  if (threadId) {
    await supabase.from('messages').insert({
      thread_id: threadId, user_id: userId, role: 'assistant', content: opener, persona_key: personaKey,
    });
    await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
  }
  await supabase.from('ping_log').insert({
    user_id: userId, persona_key: personaKey, thread_id: threadId,
    ping: opener, kind: 'buzz', sent: true, status: 'sent', seatbelt_ok: null,
  });
  console.log('[impulse] buzz →', userId, 'from', personaKey, threadId ? '(in-thread)' : '(no thread)');
  return true;
}

// a drop-in: someone's at the door, carrying their day. Opener drafted now,
// delivered into the chat ONLY if the user accepts.
async function offerDropin(userId: string): Promise<boolean> {
  const candidates = BUZZERS.concat(['the_healer','the_philosopher','the_historian']);
  const personaKey = candidates[Math.floor(Math.random() * candidates.length)];
  const st = await todaysState(personaKey);
  const about = st
    ? `they are dropping by unannounced, carrying their day: "${st.log_entry}" — the opener should burst in with THIS, like a friend who needs to tell someone`
    : 'they are dropping by unannounced just to see the user — the opener is warm, casual, zero agenda';
  const opener = await writePing(userId, personaKey, about);
  if (!opener) return false;
  const belt = await seatbeltCheck(opener, { personaKey, userId });   // shadow — logged, never blocks
  // RELOCATION: deliver into the persona's OWN thread so it arrives like a real
  // message — thread jumps to top (last_active), unread badge (thread_reads).
  const threadId = await threadFor(userId, personaKey);
  if (threadId) {
    await supabase.from('messages').insert({
      thread_id: threadId, user_id: userId, role: 'assistant', content: opener, persona_key: personaKey,
    });
    await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
  }
  await supabase.from('ping_log').insert({
    user_id: userId, persona_key: personaKey, thread_id: threadId,
    ping: opener, kind: 'dropin', sent: true, status: 'sent',
    seatbelt_ok: belt.ok, seatbelt_reason: belt.reason ?? null,
  });
  console.log('[impulse] drop-in →', userId, 'from', personaKey, threadId ? '(in-thread)' : '(no thread)');
  return true;
}

export async function runFollowups(opts?: { onlyUserId?: string }): Promise<{ considered: number; sent: number }> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  let userIds: string[];
  if (opts?.onlyUserId) userIds = [opts.onlyUserId];
  else {
    const { data: th } = await supabase.from('threads')
      .select('user_id').gte('last_active', since).limit(2000);
    userIds = Array.from(new Set<string>((th ?? []).map((t: any) => String(t.user_id))));
  }
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  let sent = 0;
  for (const uid of userIds) {
    try {
      // one per day, ever — idempotent across restarts
      const { data: already } = await supabase.from('ping_log')
        .select('id').eq('user_id', uid).neq('kind', 'brief').gte('created_at', dayStart.toISOString()).limit(1).maybeSingle();
      if (already) continue;

      const draft = await draftFor(uid);
      if (!draft) {
        // no reason to follow up — the house may still stir: buzz (~30%) or a drop-in (~15%)
        const roll = Math.random();
        if (roll < 0.30) { if (await sendBuzz(uid)) sent++; }
        else if (roll < 0.45) { if (await offerDropin(uid)) sent++; }
        continue;
      }

      // SHADOW-MODE seatbelt: judge, log, never block
      const belt = await seatbeltCheck(draft.ping, { personaKey: draft.personaKey, userId: uid });

      const threadId = await threadFor(uid, draft.personaKey);
      if (!threadId) continue;
      await supabase.from('messages').insert({
        thread_id: threadId, user_id: uid, role: 'assistant', content: draft.ping, persona_key: draft.personaKey,
      });
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
      await supabase.from('ping_log').insert({
        user_id: uid, persona_key: draft.personaKey, thread_id: threadId, ping: draft.ping,
        seatbelt_ok: belt.ok, seatbelt_reason: belt.reason ?? null, sent: true,
      });
      sent++;
    } catch (e: any) {
      console.error('[followups] user failed:', uid, e?.message || e);
    }
  }
  return { considered: userIds.length, sent };
}

// hourly heartbeat; fires the run once when the IST clock crosses RUN_HOUR
export function startFollowupScheduler() {
  const tick = async () => {
    const istHour = (new Date().getUTCHours() + 5.5) % 24;
    if (Math.floor(istHour) < RUN_HOUR_IST) return;   // [zip33] catch-up — per-user idempotency makes repeats harmless (its own comment says so)
    try {
      const r = await runFollowups();
      console.log(`[followups] nightly run: ${r.sent}/${r.considered} pinged`);
    } catch (e: any) { console.error('[followups] run failed:', e?.message || e); }
  };
  setTimeout(tick, 90 * 1000);   // [zip33] boot tick
  setInterval(tick, 55 * 60 * 1000);            // hourly-ish; per-user idempotency makes double-fires harmless
  console.log('[followups] scheduler armed for', RUN_HOUR_IST, 'IST');
}
