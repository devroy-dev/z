// mmDesk.ts — [zip54k] THE DESK THAT WATCHES. Three trades in one module:
//   1) ingestAnalytics — a screenshot of IG insights / YT Studio goes under his eye
//      (vision rides the zip54g route → Anthropic), the numbers file into the ledger,
//      and the brief's audience line self-updates from evidence instead of typing.
//   2) analyticsTimeline / deskNotes — the room's reads.
//   3) the weekly desk note — the scheduler (zip33 pattern: hourly tick, IST gate,
//      per-user idempotency) has him write a short memo on the client vs the brief
//      and the trajectory, in his own voice. His work product accrues; a form never
//      accrues anything. Notes ride the slim advisor soul, never the whole thesis —
//      voice needs the soul, not the 95k-char codex (cost discipline).
import { supabase } from './db.js';
import { llm, firstText } from './llm.js';
import { readContentFile } from './content.js';

const anthropic = llm();   // provider-routed; vision auto-rides Anthropic (zip54g)

const ADVISOR_SOUL = (() => {
  try { return readContentFile('media-manager-soul.md'); } catch { return ''; }
})();

// ── 1. the screenshot goes under his eye ──────────────────────────────────
export async function ingestAnalytics(userId: string, image: { media_type: string; data: string }) {
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 400, temperature: 0,
    system:
      'You are a sharp social media manager reading a client\'s analytics screenshot (Instagram insights, YouTube Studio, or similar). ' +
      'Extract what is actually visible — never invent a number that is not on screen. Reply with ONLY strict JSON, no fences: ' +
      '{"platform": "instagram|youtube|shorts|linkedin|x|other", "followers": "the follower/subscriber count as shown, or null", ' +
      '"reach": "reach/views/impressions for the period as shown, or null", "growth": "any growth/delta figures as shown (e.g. +12.4%), or null", ' +
      '"top_content": "the best-performing post/video if visible, one line, or null", "period": "the time period the screen covers (e.g. last 30 days, June 2026), or null"}',
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
      { type: 'text', text: 'read this analytics screen.' },
    ] }],
  });
  let x: any = {};
  try { x = JSON.parse(firstText(msg).replace(/```json|```/g, '').trim()); } catch { /* filed empty below */ }
  const row: any = {
    user_id: userId,
    platform: String(x.platform || '').slice(0, 30) || null,
    followers: x.followers ? String(x.followers).slice(0, 60) : null,
    reach: x.reach ? String(x.reach).slice(0, 60) : null,
    growth: x.growth ? String(x.growth).slice(0, 60) : null,
    top_content: x.top_content ? String(x.top_content).slice(0, 240) : null,
    period: x.period ? String(x.period).slice(0, 60) : null,
  };
  const ins = await supabase.from('mm_analytics').insert(row).select().single();
  if (ins.error) throw new Error(ins.error.message);
  // the brief self-updates from evidence: latest line per platform, newest first
  try {
    const { data: recent } = await supabase.from('mm_analytics').select('platform, followers, growth, period')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(12);
    const seen = new Set<string>(); const lines: string[] = [];
    for (const r of recent ?? []) {
      const p = r.platform || 'platform';
      if (seen.has(p)) continue; seen.add(p);
      lines.push(`${p}: ${[r.followers, r.growth, r.period ? `(${r.period})` : ''].filter(Boolean).join(' ')}`.trim());
    }
    if (lines.length) {
      await supabase.from('mm_brief').upsert(
        { user_id: userId, audience: lines.join('\n').slice(0, 800), updated_at: new Date().toISOString() },
        { onConflict: 'user_id' });
    }
  } catch (e: any) { console.error('[mmDesk] brief self-update failed:', e?.message || e); }
  return ins.data;
}

export async function analyticsTimeline(userId: string) {
  const { data } = await supabase.from('mm_analytics').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(24);
  return data ?? [];
}

export async function deskNotes(userId: string) {
  const { data } = await supabase.from('mm_desk_notes').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(12);
  return data ?? [];
}

// ── 3. the weekly desk note ───────────────────────────────────────────────
export async function writeDeskNote(userId: string): Promise<boolean> {
  const [{ data: brief }, timeline, prior] = await Promise.all([
    supabase.from('mm_brief').select('*').eq('user_id', userId).maybeSingle(),
    analyticsTimeline(userId),
    deskNotes(userId),
  ]);
  if (!brief) return false;
  const f = (l: string, v: any) => (v ? `\n${l}: ${String(v).slice(0, 300)}` : '');
  const briefTxt = `THE BRIEF:${f('handle', brief.display_name || brief.handle)}${f('platforms', brief.platforms)}${f('niche', brief.niche)}${f('pillars', brief.pillars)}${f('audience', brief.audience)}${f('stage', brief.stage)}${f('goal', brief.goal)}${f('deals', brief.deals)}${f('cadence', brief.cadence)}`;
  const numbersTxt = timeline.length
    ? 'THE NUMBERS (newest first):\n' + timeline.slice(0, 6).map((r: any) =>
        `- ${[r.platform, r.followers && `${r.followers} followers`, r.reach && `reach ${r.reach}`, r.growth, r.period && `(${r.period})`].filter(Boolean).join(', ')}`).join('\n')
    : 'THE NUMBERS: none filed yet — the client has not uploaded analytics.';
  const lastNote = prior[0]?.note ? `YOUR LAST NOTE (do not repeat it; move the thinking forward):\n${String(prior[0].note).slice(0, 600)}` : '';
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 400,
    system: ADVISOR_SOUL + '\n\n[THE DESK NOTE — once a week you write a short memo on this client: where they stand against the brief and the numbers. 60-120 words, plain Indian English, Rs never the symbol. One honest observation, one concrete instruction for the week. No greeting, no sign-off, no headings — just the memo, as you would leave it on the desk. Where the numbers are missing, say what filing them would unlock — once, without nagging.]',
    messages: [{ role: 'user', content: `${briefTxt}\n\n${numbersTxt}\n\n${lastNote}\n\nWrite this week's desk note.` }],
  });
  const note = firstText(msg).replace(/\u20B9\s*/g, 'Rs ').trim().slice(0, 1200);
  if (!note) return false;
  await supabase.from('mm_desk_notes').insert({ user_id: userId, note });
  return true;
}

// ── the scheduler — zip33 pattern: hourly tick, IST gate, per-user idempotency ──
export function startDeskNoteScheduler() {
  const RUN_HOUR_IST = 8;   // the memo waits on the desk before the client's day starts
  const tick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour < RUN_HOUR_IST) return;   // catch-up — the 6-day guard below makes repeats a SELECT
    try {
      const { data: briefs } = await supabase.from('mm_brief').select('user_id').limit(200);
      let wrote = 0;
      for (const b of briefs ?? []) {
        const { data: last } = await supabase.from('mm_desk_notes').select('created_at')
          .eq('user_id', b.user_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const age = last ? Date.now() - new Date(last.created_at).getTime() : Infinity;
        if (age < 6 * 24 * 3600 * 1000) continue;   // a note within 6 days — the week is served
        try { if (await writeDeskNote(b.user_id)) wrote++; } catch (e: any) { console.error('[mmDesk] note failed for', b.user_id, e?.message || e); }
        if (wrote >= 50) break;   // per-tick cap; the hourly tick sweeps the rest
      }
      if (wrote) console.log('[mmDesk] desk notes written:', wrote);
    } catch (e: any) { console.error('[mmDesk] scheduler tick failed:', e?.message || e); }
  };
  setTimeout(tick, 90 * 1000);   // boot tick
  setInterval(tick, 55 * 60 * 1000);
}
