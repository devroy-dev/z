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
import { logUsage } from './usage.js';
import { readContentFile } from './content.js';

const anthropic = llm();   // provider-routed; vision auto-rides Anthropic (zip54g)
const istDate = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);   // [0056] IST YYYY-MM-DD — the week the instruction is for

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

// ── §5.4 MANUAL NUMBERS + THE DEAL DESK ─────────────────────────────────────
// Screenshots stay primary; this just removes friction when they'd rather type.
export async function manualAnalytics(userId: string, f: any) {
  const row: any = {
    user_id: userId,
    platform: f?.platform ? String(f.platform).slice(0, 30) : null,
    followers: f?.followers ? String(f.followers).slice(0, 60) : null,
    reach: f?.reach ? String(f.reach).slice(0, 60) : null,
    growth: f?.growth ? String(f.growth).slice(0, 60) : null,
    top_content: f?.top_content ? String(f.top_content).slice(0, 240) : null,
    period: f?.period ? String(f.period).slice(0, 60) : null,
  };
  if (!row.platform || (!row.followers && !row.reach)) return null;   // need at least a platform + one number
  const { data } = await supabase.from('mm_analytics').insert(row).select().single();
  return data ?? null;
}

// parse "12.5K" / "1.2M" / "1,20,000" / "500" → a number
function parseNum(s: any): number {
  if (s == null) return 0;
  const str = String(s).trim().toLowerCase().replace(/,/g, '');
  const m = str.match(/([\d.]+)\s*([km])?/);
  if (!m) return 0;
  let n = parseFloat(m[1]) || 0;
  if (m[2] === 'k') n *= 1_000; else if (m[2] === 'm') n *= 1_000_000;
  return Math.round(n);
}

// ── THE RATE CARD — deterministic, NO MODEL. Pure math from the filed ledger. ──
// A branded post is priced off REACH (the real deliverable a brand buys); when
// reach isn't filed we estimate it from followers. The three coefficients below
// are the ONLY judgement in this formula — they're Rs per 1,000 people reached,
// a read on the Indian creator market. TUNE THEM to taste; everything else is
// arithmetic the creator can audit.
const RS_PER_1K_REACH_LOW = 150;    // conservative floor per 1k reached
const RS_PER_1K_REACH_HIGH = 400;   // strong-ask ceiling per 1k reached
const REACH_FROM_FOLLOWERS = 0.30;  // if no reach filed, assume ~30% of followers see a post
const roundRs = (n: number) => (n < 1000 ? Math.round(n / 50) * 50 : Math.round(n / 500) * 500);

export async function rateCard(userId: string) {
  const { data } = await supabase.from('mm_analytics').select('platform, followers, reach, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  const latest: Record<string, any> = {};
  for (const r of (data ?? [])) { const p = String(r.platform || 'other').toLowerCase(); if (!latest[p]) latest[p] = r; }
  const cards = Object.entries(latest).map(([platform, r]: [string, any]) => {
    const followers = parseNum(r.followers);
    const reach = parseNum(r.reach);
    const eff = reach > 0 ? reach : Math.round(followers * REACH_FROM_FOLLOWERS);
    return {
      platform, followers, reach,
      low: roundRs(eff / 1000 * RS_PER_1K_REACH_LOW),
      high: roundRs(eff / 1000 * RS_PER_1K_REACH_HIGH),
      basis: reach > 0 ? 'reach' : 'followers',
    };
  }).filter((c) => c.high > 0).sort((a, b) => b.high - a.high);
  const inr = (n: number) => n.toLocaleString('en-IN');
  const pitch = cards.length
    ? `draft me a short, confident pitch DM to a brand for a paid collaboration. my rates: ${cards.map((c) => `${c.platform} Rs ${inr(c.low)}–${inr(c.high)} per post`).join(', ')}. lead with my strongest platform and keep it specific.`
    : `help me set my rates — I haven't filed my numbers yet. tell me what you need.`;
  return { cards, pitch };
}

export async function deskNotes(userId: string) {
  const { data } = await supabase.from('mm_desk_notes').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(12);
  return data ?? [];
}

// ── 3. the weekly desk note — now a loop that CHECKS ──────────────────────
// [0056] Two shifts turn a newsletter into a manager: (1) he opens by GRADING
// last week's instruction — done, skipped, or moved the numbers — before he
// issues this week's. (2) the note gets EYES: web_search (capped at 2) grounds
// one line in what actually moved in the client's niche this week. This week's
// instruction rides out as a [[TASK]] tag and files into mm_tasks, where the
// room can tick it and next week's note can grade it.
export async function writeDeskNote(userId: string): Promise<boolean> {
  const [{ data: brief }, timeline, prior, { data: weekTasks }] = await Promise.all([
    supabase.from('mm_brief').select('*').eq('user_id', userId).maybeSingle(),
    analyticsTimeline(userId),
    deskNotes(userId),
    // [fixes-B R1] grade the WEEK's commitments (chat-filed [[TASK]]s included), not just the note's own last instruction
    supabase.from('mm_tasks').select('instruction, status, week_of').eq('user_id', userId)
      .gte('week_of', new Date(Date.now() + 5.5 * 3600 * 1000 - 8 * 86400 * 1000).toISOString().slice(0, 10))
      .order('week_of', { ascending: false }).limit(12),
  ]);
  if (!brief) return false;
  const f = (l: string, v: any) => (v ? `\n${l}: ${String(v).slice(0, 300)}` : '');
  const briefTxt = `THE BRIEF:${f('handle', brief.display_name || brief.handle)}${f('platforms', brief.platforms)}${f('niche', brief.niche)}${f('pillars', brief.pillars)}${f('audience', brief.audience)}${f('stage', brief.stage)}${f('goal', brief.goal)}${f('deals', brief.deals)}${f('cadence', brief.cadence)}`;
  const numbersTxt = timeline.length
    ? 'THE NUMBERS (newest first):\n' + timeline.slice(0, 6).map((r: any) =>
        `- ${[r.platform, r.followers && `${r.followers} followers`, r.reach && `reach ${r.reach}`, r.growth, r.period && `(${r.period})`].filter(Boolean).join(', ')}`).join('\n')
    : 'THE NUMBERS: none filed yet — the client has not uploaded analytics.';
  const lastNote = prior[0]?.note ? `YOUR LAST NOTE (do not repeat it; move the thinking forward):\n${String(prior[0].note).slice(0, 600)}` : '';
  const wk = Array.isArray(weekTasks) ? weekTasks : [];
  const lastTaskTxt = wk.length
    ? `THE WEEK'S COMMITMENTS (theirs to grade — some you filed, some they locked in chat):\n${wk.map((t: any) => `- "${String(t.instruction).slice(0, 200)}" [${t.status === 'done' ? 'DONE' : t.status === 'skipped' ? 'SKIPPED' : 'still OPEN'}]`).join('\n')}`
    : '';
  const gradeLaw = wk.length
    ? '\n[GRADE FIRST — open the note by settling the week\'s commitments in one or two honest lines: what they did, what slipped, and if the numbers show any of it moved anything. Do not flatter a skipped task; do not nag a done one. THEN write this week.]'
    : '';
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 500, __pin: 'anthropic',   // [0056] the desk stays on Haiku so its eyes actually open
    system: ADVISOR_SOUL + '\n\n[THE DESK NOTE — once a week you write a short memo on this client: where they stand against the brief and the numbers. 60-120 words, plain Indian English, Rs never the symbol. One honest observation, one concrete instruction for the week. No greeting, no sign-off, no headings — just the memo, as you would leave it on the desk. Where the numbers are missing, say what filing them would unlock — once, without nagging. You have web search: use it at most to ground ONE line in what actually moved in this client\'s niche or platform this week — a real trend, format, or shift. Never invent a trend; if nothing solid turns up, write from the brief alone.]' + gradeLaw + '\n[THIS WEEK\'S INSTRUCTION — after the memo, on its OWN final line, emit exactly ONE machine tag the client never sees, carrying the single concrete thing they should do this week: [[TASK: the one instruction, imperative, under 140 chars]]. Nothing after it.]',
    messages: [{ role: 'user', content: `${briefTxt}\n\n${numbersTxt}\n\n${lastTaskTxt}\n\n${lastNote}\n\nWrite this week's desk note.` }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 } as any],
  });
  logUsage({ userId, surface: 'other', fn: 'mm_desknote', model: 'claude-haiku-4-5-20251001', usage: (msg as any).usage });
  // web_search yields interleaved text blocks — join BY TYPE, never firstText
  const raw = (Array.isArray(msg.content) ? msg.content : [])
    .filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
  const tm = /\[\[TASK:\s*([\s\S]+?)\]\]/i.exec(raw);
  const instruction = tm?.[1]?.trim().replace(/\s+/g, ' ').slice(0, 240) || null;
  const note = raw.replace(/\[\[TASK:[\s\S]*?\]\]/gi, '').replace(/\u20B9\s*/g, 'Rs ')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, 1200);
  if (!note) return false;
  await supabase.from('mm_desk_notes').insert({ user_id: userId, note });
  if (instruction) {
    try { await supabase.from('mm_tasks').insert({ user_id: userId, instruction, week_of: istDate(), status: 'open' }); }
    catch (e: any) { console.error('[mmDesk] task file failed:', e?.message || e); }
  }
  return true;
}

// [fixes-B MM-B] the room's manual refresh (↻). Same generator, gated to once per
// IST day per user so it can't be spun for repeated model spend.
export async function refreshDeskNote(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const { data: last } = await supabase.from('mm_desk_notes').select('created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last?.created_at) {
    const istOf = (t: any) => new Date(new Date(t).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
    if (istOf(last.created_at) === istDate()) return { ok: false, reason: 'already_today' };
  }
  const wrote = await writeDeskNote(userId);
  return wrote ? { ok: true } : { ok: false, reason: 'no_brief' };
}

// ── 4. the loop's reads/writes: the checked instruction + the content pipeline ──
export async function mmTasks(userId: string) {
  const { data } = await supabase.from('mm_tasks').select('*').eq('user_id', userId)
    .order('week_of', { ascending: false }).limit(12);
  return data ?? [];
}

// the room's tick — the instruction toggles between done and open
export async function toggleMmTask(userId: string, id: string) {
  const { data: row } = await supabase.from('mm_tasks').select('status').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!row) return null;
  const next = row.status === 'done' ? 'open' : 'done';
  const { data } = await supabase.from('mm_tasks').update({ status: next }).eq('id', id).eq('user_id', userId).select().single();
  return data ?? null;
}

export async function mmIdeas(userId: string) {
  const { data } = await supabase.from('mm_ideas').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(60);
  return data ?? [];
}

// [0056] DRAFT THIS — the coach pattern on a filed idea: brief + real numbers +
// the idea → he writes the hook/caption/script in his own voice, and the idea
// flips idea → drafted. His counsel stops evaporating into chat.
export async function draftIdea(userId: string, id: string) {
  const { data: idea } = await supabase.from('mm_ideas').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  if (!idea) return null;
  const [{ data: brief }, timeline] = await Promise.all([
    supabase.from('mm_brief').select('*').eq('user_id', userId).maybeSingle(),
    analyticsTimeline(userId),
  ]);
  const f = (l: string, v: any) => (v ? `\n${l}: ${String(v).slice(0, 240)}` : '');
  const briefTxt = brief
    ? `THE BRIEF:${f('handle', brief.display_name || brief.handle)}${f('platforms', brief.platforms)}${f('niche', brief.niche)}${f('pillars', brief.pillars)}${f('audience', brief.audience)}${f('goal', brief.goal)}`
    : 'THE BRIEF: thin — work from the idea.';
  const numbersTxt = timeline.length
    ? 'WHAT WORKS FOR THEM (their filed numbers):\n' + timeline.slice(0, 5).map((r: any) =>
        `- ${[r.platform, r.followers && `${r.followers} followers`, r.growth, r.top_content && `top: ${r.top_content}`].filter(Boolean).join(', ')}`).join('\n')
    : '';
  const ideaTxt = `THE IDEA to draft:\ntitle: ${idea.title}${idea.format ? `\nformat: ${idea.format}` : ''}${idea.hook ? `\nhook: ${idea.hook}` : ''}`;
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 600,
    system: ADVISOR_SOUL + '\n\n[DRAFT THIS — the client picked one filed idea and wants it written. Draft it FROM their brief and their real numbers, for their platform and audience — not a generic template. Give them a scroll-stopping hook, the caption or script body, and 4-6 hashtags if the platform uses them. Plain Indian English, Rs never the symbol. No preamble, no "here is your draft" — just the draft itself, ready to post.]',
    messages: [{ role: 'user', content: `${briefTxt}\n\n${numbersTxt}\n\n${ideaTxt}\n\nDraft it.` }],
  });
  logUsage({ userId, surface: 'other', fn: 'mm_draft', model: 'claude-haiku-4-5-20251001', usage: (msg as any).usage });
  const draft = firstText(msg).replace(/\u20B9\s*/g, 'Rs ').trim().slice(0, 4000);
  const { data } = await supabase.from('mm_ideas').update({ draft: draft || null, status: 'drafted' })
    .eq('id', id).eq('user_id', userId).select().single();
  return data ?? null;
}

// [0056] the pipeline's last hop — a drafted idea marked posted; completes the
// idea → drafted → posted ladder 0056 defines so no card dead-ends.
export async function markIdeaPosted(userId: string, id: string) {
  const { data } = await supabase.from('mm_ideas').update({ status: 'posted' })
    .eq('id', id).eq('user_id', userId).select().single();
  return data ?? null;
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
