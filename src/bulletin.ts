// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE BULLETIN. The anchor compiles the day: one national+world
//  edition each morning, local editions per city on demand (cached for the
//  day). Stories are structured; the anchor's voice does the writing; the
//  reader can walk into his studio and interrogate any of them.
// ════════════════════════════════════════════════════════════════════════
import Anthropic from '@anthropic-ai/sdk';
import { llm } from './llm.js';
import { supabase } from './db.js';
import { logUsage } from './usage.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

const istToday = () => {
  const d = new Date(Date.now() + 5.5 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

const ANCHOR_SYS = `You are THE ANCHOR — an old-school, straight-backed news anchor with a dry wit, compiling today's bulletin. You have web search: USE IT to find what is ACTUALLY happening today. Never invent stories, names, or numbers — everything must come from what you find.

Write each story as EXACTLY this block, nothing between blocks:
[[STORY]]
KICKER: <one word category: INDIA / WORLD / BUSINESS / TECH / SPORT / CITY>
HEADLINE: <the story in under 12 words, your phrasing>
BRIEF: <two sentences in your anchor's voice: what happened, why it matters. Dry, precise, human.>

Rules: no markdown, no numbering, no preamble or sign-off — only the blocks.`;

export function parseStories(text: string) {
  const out: any[] = [];
  for (const block of text.split('[[STORY]]').slice(1)) {
    const kicker = /KICKER:\s*(.+)/.exec(block)?.[1]?.trim().toUpperCase().slice(0, 12);
    const headline = /HEADLINE:\s*(.+)/.exec(block)?.[1]?.trim().slice(0, 120);
    const brief = /BRIEF:\s*([\s\S]+?)(?=(KICKER:|HEADLINE:|$))/.exec(block)?.[1]?.trim().slice(0, 400);
    if (kicker && headline && brief) out.push({ id: out.length + 1, kicker, headline, brief });
  }
  return out;
}

async function generate(prompt: string): Promise<any[]> {
  const msg = await anthropic.messages.create({
    model: MODEL, max_tokens: 1400, system: ANCHOR_SYS, __pin: 'anthropic',   // [zip54g] the newsroom never leaves Haiku
    messages: [{ role: 'user', content: prompt }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 } as any],
  });
  logUsage({ userId: 'bulletin', surface: 'other', fn: 'bulletin', model: MODEL, usage: (msg as any).usage });
  const text = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseStories(text);
}

export async function getBulletin(scope: string, cityName?: string): Promise<any[] | null> {
  const day = istToday();
  const { data: hit } = await supabase.from('bulletins').select('stories').eq('scope', scope).eq('day', day).maybeSingle();
  if (hit?.stories) return hit.stories as any[];

  const prompt = scope === 'in'
    ? `Compile today's bulletin (${day}). Search the web for today's most important news. Give me 8 stories: 3 INDIA (national), 2 WORLD, 1 BUSINESS, 1 TECH, 1 SPORT. Today's real news only.`
    : `Compile today's LOCAL desk for ${cityName}, India (${day}). Search the web for "${cityName} news today" and related. Give me 3-4 CITY stories that actually matter to someone living there — civic, local events, infrastructure, weather if severe. If genuinely nothing local surfaced, give the most relevant regional stories instead. KICKER for all: CITY.`;

  try {
    const stories = await generate(prompt);
    if (!stories.length) return null;
    await supabase.from('bulletins').insert({ scope, day, stories }).select().maybeSingle();
    return stories;
  } catch (e: any) {
    console.error('[bulletin] generation failed for', scope, e?.message || e);
    return null;
  }
}

// the morning edition, compiled before the house wakes
export function startBulletinScheduler() {
  const RUN_HOUR_IST = 5;
  const tick = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour < RUN_HOUR_IST) return;   // [zip33] catch-up — the day-cache in getBulletin makes repeats a SELECT
    try { await getBulletin('in'); } catch (e: any) { console.error('[bulletin] morning run failed:', e?.message || e); }
  };
  // hourly top-up: the anchor adds up to two stories ONLY if something genuinely
  // new broke since the edition — silence is allowed; filler is not.
  const topUp = async () => {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    if (istHour <= RUN_HOUR_IST || istHour > 23) return;
    await refreshBulletin('in');   // [zip54n] one body, two callers — the old inline body now lives in refreshBulletin
  };
  setTimeout(tick, 90 * 1000);   // [zip33] boot tick
  setInterval(tick, 55 * 60 * 1000);
  setInterval(topUp, 60 * 60 * 1000);
  console.log('[bulletin] the anchor clocks in past', RUN_HOUR_IST, 'IST (catch-up + boot tick), tops up hourly');
}

// [zip54n] refreshBulletin — the topUp's working body, callable on demand: add up to
// two stories ONLY if something genuinely new broke since the edition. Returns count.
export async function refreshBulletin(scope: string): Promise<number> {
  try {
    const istHour = Math.floor((new Date().getUTCHours() + 5.5) % 24);
    const day = istToday();
    const { data: hit } = await supabase.from('bulletins').select('id, stories').eq('scope', scope).eq('day', day).maybeSingle();
    if (!hit) { await getBulletin(scope); return 0; }
    const have = ((hit as any).stories as any[]).map((s) => s.headline).join(' | ');
    const fresh = await generate(`It is now ${istHour}:00 IST on ${day}. The bulletin already carries these headlines: ${have}. Search the web for what has happened in the LAST FEW HOURS only. If — and only if — something genuinely NEW and significant broke that is not already covered, give me up to 2 stories for it. If nothing truly new broke, output nothing at all.`);
    if (!fresh.length) return 0;
    const merged = [...((hit as any).stories as any[]), ...fresh.map((s, i) => ({ ...s, id: ((hit as any).stories as any[]).length + i + 1 }))].slice(0, 16);
    await supabase.from('bulletins').update({ stories: merged }).eq('id', (hit as any).id);
    console.log('[bulletin] refresh added', fresh.length);
    return fresh.length;
  } catch (e: any) { console.error('[bulletin] refresh failed:', e?.message || e); return 0; }
}
