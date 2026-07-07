// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE EVENING PROGRAMME. Around 19:30 IST the front desk drops
//  tonight's bill: 2–3 CURATED cards — one social, one growth, one play —
//  chosen by CODE from recency + the ledger + the dean's catalog; the model
//  only voices the note around them (the doctrine). Cards travel as
//  [[CARD: kind | title | line | goto]] tags the client renders tappable.
//
//  ARMED ONLY WHEN process.env.EVENING_PROGRAMME === '1' — the native card
//  renderer (desk zip 3) must exist first, or users would see raw tags.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from './llm.js';
import { supabase } from './db.js';
import { personaByKey } from './personas.js';
import { logUsage } from './usage.js';
import { ARCS } from './arcs.js';
import { SOLO_GAMES } from './manifest.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';
const RUN_HOUR_IST = 19;

type Card = { kind: 'social' | 'growth' | 'play'; title: string; line: string; goto: string };
const tag = (c: Card) => `[[CARD: ${c.kind} | ${c.title} | ${c.line} | ${c.goto}]]`;

const VOICE = `You are the front desk of a warm house of AI personas, dropping the user TONIGHT'S PROGRAMME — a short evening note with 2–3 cards. You get the chosen cards as data. Write 1–2 warm, unhurried sentences introducing the evening (plain words, no jargon, no lists), then output each card's tag EXACTLY as given, each on its OWN line, in the order given. Do not invent cards, do not alter tags, do not add anything after the last tag.`;

async function programmeFor(userId: string): Promise<string | null> {
  const week = new Date(Date.now() - 7 * 864e5).toISOString();
  const [{ data: threads }, { data: matches }, { data: arcRows }] = await Promise.all([
    supabase.from('threads').select('persona_key, last_active').eq('user_id', userId)
      .eq('is_group', false).is('deleted_at', null).not('persona_key', 'is', null)
      .order('last_active', { ascending: false }).limit(60),
    supabase.from('arena_matches').select('game').eq('user_id', userId).gte('created_at', week).limit(40),
    supabase.from('arc_progress').select('arc_id, day, status').eq('user_id', userId).neq('status', 'done').limit(3),
  ]);

  const cards: Card[] = [];

  // SOCIAL — a resident they haven't spoken to in 7+ days (skip service personas)
  const service = new Set(['the_front_desk', 'the_anchor', 'the_moderator', 'z', 'z_serious']);
  const stale = (threads ?? []).filter((t: any) =>
    !service.has(t.persona_key) && t.last_active && (Date.now() - new Date(t.last_active).getTime()) > 7 * 864e5);
  if (stale.length) {
    const pick: any = stale[Math.floor(Math.random() * Math.min(stale.length, 5))];
    const name = personaByKey(pick.persona_key)?.defaultName || pick.persona_key;
    cards.push({ kind: 'social', title: `catch up with ${name}`, line: `it's been a while — they've had a week of their own`, goto: pick.persona_key });
  }

  // GROWTH — the dean: continue the active course, or offer one they haven't taken
  const active: any = (arcRows ?? [])[0];
  if (active && ARCS[active.arc_id]) {
    const def = ARCS[active.arc_id];
    const coach = personaByKey(def.personaKey)?.defaultName || def.personaKey;
    cards.push(active.status === 'final_ready'
      ? { kind: 'growth', title: `your final: ${def.finalTitle}`, line: `the "${def.title}" course is done — take the exam on the stage`, goto: 'the_stage' }
      : { kind: 'growth', title: `day ${active.day} with ${coach}`, line: `the "${def.title}" course — tonight's session is just a conversation`, goto: def.personaKey });
  } else {
    const taken = new Set((arcRows ?? []).map((r: any) => r.arc_id));
    const candidates = Object.values(ARCS).filter((a) => !taken.has(a.id));
    if (candidates.length) {
      const def = candidates[Math.floor(Math.random() * candidates.length)];
      const coach = personaByKey(def.personaKey)?.defaultName || def.personaKey;
      cards.push({ kind: 'growth', title: `"${def.title}" — ${def.days} days with ${coach}`, line: `a short course; the final is ${def.finalTitle}, graded on the stage`, goto: def.personaKey });
    }
  }

  // PLAY — a game they haven't touched this week
  const played = new Set((matches ?? []).map((m: any) => String(m.game)));
  const freshGames = SOLO_GAMES.filter((g) => !played.has(g.id));
  const g = (freshGames.length ? freshGames : SOLO_GAMES)[Math.floor(Math.random() * (freshGames.length || SOLO_GAMES.length))];
  cards.push({ kind: 'play', title: g.name, line: g.line, goto: `the_arena:${g.id}` });

  if (cards.length < 2) return null;
  const material = cards.map((c) => tag(c)).join('\n');
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 300, system: VOICE,
    messages: [{ role: 'user', content: `Tonight's cards, in order:\n${material}` }],
  });
  logUsage({ userId, surface: 'other', fn: 'evening_programme', model: MODEL, usage: (msg as any).usage });
  let text = firstText(msg).trim();
  // deterministic floor: every chosen tag present verbatim, or we rebuild the note ourselves
  if (!cards.every((c) => text.includes(tag(c)))) {
    text = `tonight's programme —\n${material}`;
  }
  return text || null;
}

export async function runEveningProgrammes(opts?: { onlyUserId?: string }): Promise<{ considered: number; sent: number }> {
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
        .select('id').eq('user_id', uid).eq('kind', 'programme')
        .gte('created_at', dayStart.toISOString()).limit(1).maybeSingle();
      if (already) continue;
      const note = await programmeFor(uid);
      if (!note) { console.log('[programme] nothing to offer', uid); continue; }
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
      await supabase.from('ping_log').insert({ user_id: uid, persona_key: 'the_front_desk', thread_id: threadId, ping: note, kind: 'programme', sent: true });
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
      sent++;
    } catch (e: any) { console.error('[programme] failed for', uid, e?.message || e); }
  }
  return { considered: userIds.length, sent };
}

export function startProgrammeScheduler() {
  if (process.env.EVENING_PROGRAMME !== '1') {
    console.log('[programme] NOT armed — set EVENING_PROGRAMME=1 once the native card renderer (desk zip 3) is live');
    return;
  }
  const tick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour < RUN_HOUR_IST) return;   // [zip33] catch-up — per-day guard makes repeats cheap
    try { const r = await runEveningProgrammes(); console.log('[programme] ran:', r); }
    catch (e: any) { console.error('[programme] run failed:', e?.message || e); }
  };
  setTimeout(tick, 90 * 1000);   // [zip33] boot tick
  setInterval(tick, 55 * 60 * 1000);
  console.log('[programme] scheduler armed: catch-up past', RUN_HOUR_IST, 'IST + boot tick');
}
