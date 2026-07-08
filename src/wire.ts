// wire.ts — [zip67] THE WIRE. Raw rolling headlines, by topic, from Google News
// RSS (India edition) — free, keyless, and always moving. The anchor's bulletin
// stays his curated editorial product; the wire is the ticker underneath the
// house. Dependency-free parse, per-topic in-memory cache (10 min), so a refresh
// is visible and cheap: no model is ever billed for a headline.
const EDITION = 'hl=en-IN&gl=IN&ceid=IN:en';
const TOPICS: Record<string, string> = {
  world: `https://news.google.com/rss/headlines/section/topic/WORLD?${EDITION}`,
  india: `https://news.google.com/rss/headlines/section/topic/NATION?${EDITION}`,
  business: `https://news.google.com/rss/headlines/section/topic/BUSINESS?${EDITION}`,
  tech: `https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?${EDITION}`,
  sports: `https://news.google.com/rss/headlines/section/topic/SPORTS?${EDITION}`,
  entertainment: `https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?${EDITION}`,
  fashion: `https://news.google.com/rss/search?q=fashion%20style&${EDITION}`,
};

export type WireItem = { topic: string; title: string; link: string; source: string | null; at: string | null };

const unescape = (s: string) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').trim();

export function parseRss(xml: string, topic: string, cap = 12): WireItem[] {
  const items: WireItem[] = [];
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const b of blocks.slice(0, cap)) {
    const t = /<title>([\s\S]*?)<\/title>/.exec(b)?.[1];
    const l = /<link>([\s\S]*?)<\/link>/.exec(b)?.[1];
    if (!t || !l) continue;
    const src = /<source[^>]*>([\s\S]*?)<\/source>/.exec(b)?.[1] ?? null;
    const at = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(b)?.[1] ?? null;
    // Google News titles carry " - Source" tails; keep the title clean when source is known
    let title = unescape(t);
    const srcClean = src ? unescape(src) : null;
    if (srcClean && title.endsWith(' - ' + srcClean)) title = title.slice(0, -(' - ' + srcClean).length);
    items.push({ topic, title, link: unescape(l), source: srcClean, at });
  }
  return items;
}

const cache = new Map<string, { at: number; items: WireItem[] }>();
const TTL = 10 * 60 * 1000;

export async function getWire(topic: string, force = false): Promise<WireItem[]> {
  const key = TOPICS[topic] ? topic : 'world';
  const hit = cache.get(key);
  if (hit && !force && Date.now() - hit.at < TTL) return hit.items;
  try {
    const res = await fetch(TOPICS[key], { headers: { 'user-agent': 'callmeZ-wire/1.0' } });
    if (!res.ok) throw new Error('rss ' + res.status);
    const items = parseRss(await res.text(), key);
    if (items.length) cache.set(key, { at: Date.now(), items });
    return items.length ? items : (hit?.items ?? []);
  } catch (e: any) {
    console.error('[wire]', key, 'failed:', e?.message || e);
    return hit?.items ?? [];   // stale beats silent
  }
}

// the Desk's mixed ribbon: a few from each topic, interleaved so it reads varied
export async function getWireMix(perTopic = 2): Promise<WireItem[]> {
  const topics = Object.keys(TOPICS);
  const lists = await Promise.all(topics.map((t) => getWire(t)));
  const mix: WireItem[] = [];
  for (let i = 0; i < perTopic; i++) for (const l of lists) if (l[i]) mix.push(l[i]);
  return mix;
}
