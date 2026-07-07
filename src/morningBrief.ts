// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE MORNING BRIEF (#23). Every morning, the front desk leaves
//  one note: what moved in the house overnight, what's due on your list,
//  what yesterday earned you. Code gathers the morning; the model only
//  voices it (the doctrine). Delivered through the existing ping rails —
//  it appears in "left at the desk" and in the front desk's thread.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from './llm.js';
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import { logUsage } from './usage.js';
import { ARCS } from './arcs.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';
const RUN_HOUR_IST = 7;                      // after the diarist (5), before the day

const VOICE = `You are the front desk of a warm, alive house of AI personas, leaving the user their MORNING NOTE. You get raw morning material; write ONE note, 25–55 words, warm and unhurried, morning register, in first person as the desk. Mention at most: one or two house moments (by persona name), the user's due item(s) if any, their course progress if any, and yesterday's win if there was one. THE PLAIN-WORDS LAW: never use system jargon, codes, or countdown formats — say "you're two days into the pitch course with the orator, one session left" like a person would, never "SPEAK UP DAY 2 OF 3". No lists, no headers, no shouting. End with something gently forward-looking (the anchor's bulletin, or the day itself). Output ONLY the note.`;

async function briefFor(userId: string): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  const yday = new Date(Date.now() - 864e5).toISOString();
  const [{ data: states }, { data: tasks }, { data: runs }, { data: matches }, { data: arcRows }] = await Promise.all([
    supabase.from('persona_states').select('persona_key, status_line').eq('date', today).limit(40),
    supabase.from('tasks').select('title, due_at').eq('user_id', userId).eq('status', 'open')
      .not('due_at', 'is', null).lte('due_at', new Date(Date.now() + 36 * 3600e3).toISOString()).limit(3),
    supabase.from('roleplay_runs').select('scenario, outcome').eq('user_id', userId).gte('created_at', yday).limit(5),
    supabase.from('arena_matches').select('game, winner').eq('user_id', userId).gte('created_at', yday).limit(5),
    supabase.from('arc_progress').select('arc_id, day, status').eq('user_id', userId).neq('status', 'done').limit(3),
  ]);
  const arcLines = (arcRows ?? []).map((p: any) => {
    const def = ARCS[p.arc_id]; if (!def) return null;
    const coach = personaByKey(def.personaKey)?.defaultName || def.personaKey;
    if (p.status === 'final_ready') return `their "${def.title}" course with ${coach} is complete — the final, ${def.finalTitle}, is waiting on the stage whenever they're ready`;
    const left = def.days - p.day;
    return `they're on day ${p.day} of the ${def.days}-day "${def.title}" course with ${coach}${left > 0 ? ` — ${left} session${left > 1 ? 's' : ''} to go, today's just a conversation with ${coach}` : ''}`;
  }).filter(Boolean) as string[];
  const pool = (states ?? []).slice();
  const picks: string[] = [];
  while (pool.length && picks.length < 2) {
    const i = Math.floor(Math.random() * pool.length);
    const s: any = pool.splice(i, 1)[0];
    const name = personaByKey(s.persona_key)?.defaultName || s.persona_key;
    picks.push(`${name}: "${s.status_line}"`);
  }
  const wins = [
    ...(runs ?? []).filter((r: any) => r.outcome === 'win').map((r: any) => `won the scene "${String(r.scenario).replace(/_/g, ' ')}"`),
    ...(matches ?? []).filter((m: any) => m.winner === 'you').map((m: any) => `took a ${m.game} match`),
  ];
  const material = [
    picks.length ? `HOUSE THIS MORNING:\n${picks.join('\n')}` : '',
    tasks?.length ? `DUE ON THEIR LIST:\n${tasks.map((t: any) => `- ${t.title} (due ${String(t.due_at).slice(0, 10)})`).join('\n')}` : '',
    wins.length ? `YESTERDAY THEY: ${wins.slice(0, 2).join('; ')}` : '',
    arcLines.length ? `THEIR COURSE (say it in plain words):\n${arcLines.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
  if (!material) return null;

  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 110, system: VOICE,
    messages: [{ role: 'user', content: material.slice(0, 1800) }],
  });
  logUsage({ userId, surface: 'other', fn: 'morning_brief', model: MODEL, usage: (msg as any).usage });
  const text = firstText(msg).trim().replace(/^["']|["']$/g, '').slice(0, 420);
  return text || null;
}

export async function runMorningBriefs(opts?: { onlyUserId?: string }): Promise<{ considered: number; sent: number }> {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  let userIds: string[];
  if (opts?.onlyUserId) userIds = [opts.onlyUserId];
  else {
    const { data: th } = await supabase.from('threads').select('user_id').gte('last_active', since).limit(2000);
    userIds = Array.from(new Set<string>((th ?? []).map((t: any) => String(t.user_id))));
  }
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  let sent = 0;
  for (const uid of userIds) {
    try {
      const { data: already } = await supabase.from('ping_log')
        .select('id').eq('user_id', uid).eq('kind', 'brief')
        .gte('created_at', dayStart.toISOString()).limit(1).maybeSingle();
      if (already) continue;
      const note = await briefFor(uid);
      if (!note) { console.log('[brief] nothing to say to', uid); continue; }
      const { data: ex } = await supabase.from('threads')
        .select('id').eq('user_id', uid).eq('persona_key', 'the_front_desk')
        .eq('is_group', false).is('deleted_at', null)
        .order('last_active', { ascending: false }).limit(1).maybeSingle();
      let threadId = ex?.id ?? null;
      if (!threadId) {
        const p = personaByKey('the_front_desk')!;
        const { data: nt } = await supabase.from('threads').insert({
          user_id: uid, persona_key: 'the_front_desk', codex_key: p.codex, companion_name: p.defaultName,
        }).select('id').single();
        threadId = nt?.id ?? null;
      }
      if (!threadId) continue;
      await supabase.from('messages').insert({ thread_id: threadId, user_id: uid, role: 'assistant', content: note, persona_key: 'the_front_desk' });
      await supabase.from('ping_log').insert({ user_id: uid, persona_key: 'the_front_desk', thread_id: threadId, ping: note, kind: 'brief', sent: true });
      sent++;
    } catch (e: any) { console.error('[brief] user failed:', uid, e?.message || e); }
  }
  console.log(`[brief] morning run: ${sent}/${userIds.length}`);
  return { considered: userIds.length, sent };
}

export function startBriefScheduler() {
  const tick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour !== RUN_HOUR_IST) return;
    try { await runMorningBriefs(); } catch (e: any) { console.error('[brief] run failed:', e?.message || e); }
  };
  setInterval(tick, 55 * 60 * 1000);
  console.log('[brief] scheduler armed for', RUN_HOUR_IST, 'IST');
}
