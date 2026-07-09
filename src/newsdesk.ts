// newsdesk.ts — [0057] THE NEWSROOM LEARNS YOUR NAME. Three cheap moves:
//  §6.1 YOUR DESK — the free RSS wire, filtered against what you follow. No model.
//  §6.3 FACT-CHECK — paste a forward, get a verdict card (Haiku + web search), filed.
//  (§6.2 story-tracking lives in the scheduler — a throttled per-user sweep.)
import { supabase } from './db.js';
import { llm, firstText } from './llm.js';
import { logUsage } from './usage.js';
import { getWire, getWireMix, type WireItem } from './wire.js';

const anthropic = llm();
const MODEL = 'claude-haiku-4-5-20251001';

// ── §6.1 follows ─────────────────────────────────────────────────────────────
export async function listFollows(userId: string) {
  const { data } = await supabase.from('news_follows').select('id, kind, term, wire_topic, created_at')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(60);
  return data ?? [];
}
export async function addFollow(userId: string, kind: string, term: string, wireTopic?: string | null) {
  const k = ['topic', 'entity', 'story'].includes(kind) ? kind : 'topic';
  const t = String(term || '').trim().slice(0, 160);
  if (!t) return null;
  const row: any = { user_id: userId, kind: k, term: t, wire_topic: wireTopic ? String(wireTopic).slice(0, 40) : null };
  if (k === 'story') row.last_seen = t;   // seed the tracker with the headline
  const { data } = await supabase.from('news_follows').insert(row).select().single();
  return data ?? null;
}
export async function removeFollow(userId: string, id: string) {
  await supabase.from('news_follows').delete().eq('id', id).eq('user_id', userId);
  return { ok: true };
}

// ── §6.1 YOUR DESK — the wire, filtered by what you follow. NO MODEL BILLED. ──
export async function yourDesk(userId: string): Promise<WireItem[]> {
  const follows = (await listFollows(userId)).filter((f: any) => f.kind !== 'story');
  if (!follows.length) return [];
  // gather the wire: the specific topics they follow, plus a broad mix to match free-text terms
  const topics = Array.from(new Set(follows.map((f: any) => f.wire_topic).filter(Boolean)));
  const [mix, ...topicLists] = await Promise.all([getWireMix(3), ...topics.map((t) => getWire(String(t)))]);
  const pool: WireItem[] = [...mix, ...topicLists.flat()];
  const terms = follows.map((f: any) => String(f.term).toLowerCase()).filter((s: string) => s.length >= 3);
  const seen = new Set<string>();
  const hits: WireItem[] = [];
  for (const it of pool) {
    if (seen.has(it.link)) continue;
    const hay = it.title.toLowerCase();
    if (terms.some((term: string) => hay.includes(term))) { seen.add(it.link); hits.push(it); }
  }
  return hits.slice(0, 12);
}

// ── §6.3 FACT-CHECK — the WhatsApp-forward desk ──────────────────────────────
const VERDICTS = ['true', 'false', 'misleading', 'unverifiable'];
export async function factCheck(userId: string, claim: string) {
  const c = String(claim || '').trim().slice(0, 1000);
  if (!c) return null;
  const sys = `You are THE ANCHOR — a rigorous newsroom fact-checker with live web search. A reader has pasted a claim or a forwarded message. SEARCH the web, then judge it. Decompose compound claims and verify each part; finding nothing for the whole bundle is not proof the parts are false. The date outranks your memory — verify current-state claims by search, never from what you remember.
Reply with ONLY strict JSON, no fences:
{ "verdict": one of "true" | "false" | "misleading" | "unverifiable", "reasoning": "one tight paragraph — what's accurate, what's twisted, what you could and couldn't confirm", "sources": [ { "title": "source name", "url": "real url from your search" } ] }
Use "misleading" when a real fact is bent or stripped of context; "unverifiable" when the web can't settle it. Never invent a source URL.`;
  const msg: any = await anthropic.messages.create({
    model: MODEL, max_tokens: 1200, __pin: 'anthropic',
    system: sys, messages: [{ role: 'user', content: `Check this:\n\n"${c}"` }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 } as any],
  });
  logUsage({ userId, surface: 'other', fn: 'factcheck', model: MODEL, usage: (msg as any).usage });
  const raw = firstText(msg).replace(/```json|```/g, '');
  let x: any = {};
  try { const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); x = a >= 0 && b > a ? JSON.parse(raw.slice(a, b + 1)) : {}; } catch { /* below */ }
  const verdict = VERDICTS.includes(String(x.verdict)) ? String(x.verdict) : 'unverifiable';
  const reasoning = String(x.reasoning || 'Could not reach a clear verdict.').slice(0, 1200);
  const sources = Array.isArray(x.sources)
    ? x.sources.slice(0, 5).map((s: any) => ({ title: String(s?.title || '').slice(0, 160), url: String(s?.url || '').slice(0, 400) })).filter((s: any) => s.url)
    : [];
  const { data } = await supabase.from('fact_checks').insert({ user_id: userId, claim: c, verdict, reasoning, sources }).select().single();
  return data ?? { claim: c, verdict, reasoning, sources };
}
export async function listFactChecks(userId: string) {
  const { data } = await supabase.from('fact_checks').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(20);
  return data ?? [];
}

// ── §6.2 STORY TRACKING — the throttled sweep. Pinned stories (kind='story') that
// haven't been checked in ~6h get one search: did this develop? If yes, the anchor
// knocks. News flips from pull to push. Per-user, cost-controlled.
export async function trackStories(): Promise<number> {
  const cutoff = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: stories } = await supabase.from('news_follows').select('*')
    .eq('kind', 'story').or(`last_checked.is.null,last_checked.lt.${cutoff}`)
    .order('last_checked', { ascending: true, nullsFirst: true }).limit(30);
  if (!stories?.length) return 0;
  let pinged = 0;
  for (const s of stories as any[]) {
    try {
      const sys = `You are THE ANCHOR checking whether a story a reader is tracking has genuinely DEVELOPED since they last saw it. Search the web for the latest. Reply with ONLY strict JSON, no fences:
{ "developed": true or false, "line": "if developed, ONE sentence on what's actually new; else empty string" }
Set developed=true ONLY for a real new development (a ruling, a result, a decision, a death, a reversal) — never for a rehash, an opinion piece, or coverage of the same facts.`;
      const msg: any = await anthropic.messages.create({
        model: MODEL, max_tokens: 400, __pin: 'anthropic', system: sys,
        messages: [{ role: 'user', content: `The story they're tracking: "${s.term}"\nWhat they last knew: "${s.last_seen || s.term}"\n\nHas it developed?` }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 } as any],
      });
      logUsage({ userId: s.user_id, surface: 'other', fn: 'story_track', model: MODEL, usage: (msg as any).usage });
      const raw = firstText(msg).replace(/```json|```/g, '');
      let x: any = {}; try { const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); x = a >= 0 && b > a ? JSON.parse(raw.slice(a, b + 1)) : {}; } catch { /* below */ }
      const line = String(x.line || '').trim().slice(0, 240);
      const developed = x.developed === true && line.length > 0;
      const patch: any = { last_checked: new Date().toISOString() };
      if (developed) {
        patch.last_seen = line;
        await supabase.from('scheduled_pings').insert({
          user_id: s.user_id, persona_key: 'the_anchor', kind: 'reminder', thread_id: null,
          body: `that story you're tracking moved: ${line} step into the studio if you want it unpacked.`,
          payload: { kind: 'story_track', follow_id: s.id }, due_at: new Date().toISOString(),
        }).then(() => {}, () => {});
        pinged++;
      }
      await supabase.from('news_follows').update(patch).eq('id', s.id);
    } catch (e: any) { console.error('[track] story failed:', e?.message || e); }
  }
  if (pinged) console.log('[track] stories moved:', pinged);
  return pinged;
}
