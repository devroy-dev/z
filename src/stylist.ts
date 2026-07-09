// stylist.ts — [0054] THE STYLIST ACTS. Outfits become filed objects, gaps become
// a stored audit (Haiku + web search, real finds only), wear gets tracked. The
// wardrobe stops being a photo album and starts being a working closet.
import { supabase } from './db.js';
import { llm, firstText } from './llm.js';
import { logUsage } from './usage.js';

const anthropic = llm();
const BUCKET = 'wardrobe';

async function sign(path: string): Promise<string | null> {
  try { const s = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600); return s.data?.signedUrl ?? null; }
  catch { return null; }
}

// ── outfits ────────────────────────────────────────────────────────────────
// Filed by the [[OUTFIT]] tag in her thread loop; the room reads them here, with
// each piece's thumbnail resolved from its id.
export async function listOutfits(userId: string) {
  const { data } = await supabase.from('outfits').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(40);
  const outfits = data ?? [];
  const ids = Array.from(new Set(outfits.flatMap((o: any) => Array.isArray(o.piece_ids) ? o.piece_ids : [])));
  const thumbs: Record<string, string | null> = {};
  if (ids.length) {
    const { data: pcs } = await supabase.from('wardrobe_pieces').select('id, storage_path').in('id', ids as string[]);
    for (const p of pcs ?? []) thumbs[p.id] = await sign(p.storage_path);
  }
  return outfits.map((o: any) => ({
    ...o,
    pieces: (Array.isArray(o.piece_ids) ? o.piece_ids : []).map((id: string) => ({ id, url: thumbs[id] ?? null })),
  }));
}

// ── the gap report (stored, not spoken) ─────────────────────────────────────
// On-demand audit of the FULL wardrobe. Re-run replaces the open rows.
export async function runGapReport(userId: string, region = 'IN'): Promise<any[]> {
  const { data: pieces } = await supabase.from('wardrobe_pieces')
    .select('kind, colors, tags, her_read').eq('user_id', userId).order('created_at', { ascending: false }).limit(300);
  const wardrobe = (pieces ?? []).map((p: any) => `- ${[p.kind, p.colors, p.tags].filter(Boolean).join(' · ')}`).join('\n')
    || '(the closet is nearly empty)';
  const sys = `You are THE DIVA — a sharp, warm fashion stylist auditing a client's FULL wardrobe for what's MISSING. Read the closet below, think about the life a person in ${region} actually dresses for (work, festive/wedding occasions, casual, weather), and name the real gaps — versatile pieces that would unlock the most outfits, not luxuries. You have web search: use it to find REAL, currently-buyable products for each gap (never invent a product or URL). For ${region}, prefer stores that ship there (Myntra, Ajio, Amazon.in, Flipkart, Tata CLiQ, brand .in sites) and quote local currency.

Reply with ONLY strict JSON, no fences:
{ "gaps": [ { "what": "the missing piece, specific", "why": "one line: what it unlocks", "priority": 1-5 (1=fills the biggest hole), "shop_cards": [ { "name": "real product", "price": "with currency", "url": "real product page from your search" } ] } ] }
Give 3 to 6 gaps, highest priority first. Skip a shop_card rather than fake a URL.`;
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 2000, __pin: 'anthropic',
    system: sys,
    messages: [{ role: 'user', content: `THE CLOSET (${(pieces ?? []).length} pieces):\n${wardrobe}\n\nAudit it.` }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 } as any],
  });
  logUsage({ userId, surface: 'other', fn: 'stylist_gaps', model: 'claude-haiku-4-5-20251001', usage: (msg as any).usage });
  const raw = (Array.isArray(msg.content) ? msg.content : []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
  let parsed: any = {};
  try { const a = raw.indexOf('{'), b = raw.lastIndexOf('}'); parsed = a >= 0 && b > a ? JSON.parse(raw.slice(a, b + 1)) : {}; } catch { /* below */ }
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 6) : [];
  if (!gaps.length) return listGaps(userId);   // nothing parsed — leave existing rows intact
  const rows = gaps.map((g: any) => ({
    user_id: userId,
    what: String(g?.what || '').slice(0, 160),
    why: g?.why ? String(g.why).slice(0, 240) : null,
    priority: Math.min(5, Math.max(1, Number(g?.priority) || 3)),
    shop_cards: Array.isArray(g?.shop_cards)
      ? g.shop_cards.slice(0, 4).map((c: any) => ({ name: String(c?.name || '').slice(0, 120), price: String(c?.price || '').slice(0, 40), url: String(c?.url || '').slice(0, 400) })).filter((c: any) => c.name && c.url)
      : null,
    status: 'open',
  })).filter((r: any) => r.what);
  // re-run replaces the open rows (bought/dismissed stay on the record)
  await supabase.from('wardrobe_gaps').delete().eq('user_id', userId).eq('status', 'open');
  if (rows.length) await supabase.from('wardrobe_gaps').insert(rows);
  return listGaps(userId);
}

export async function listGaps(userId: string) {
  const { data } = await supabase.from('wardrobe_gaps').select('*').eq('user_id', userId)
    .neq('status', 'dismissed').order('status', { ascending: true }).order('priority', { ascending: true }).limit(20);
  return data ?? [];
}

export async function setGapStatus(userId: string, id: string, status: 'open' | 'bought' | 'dismissed') {
  const { data } = await supabase.from('wardrobe_gaps').update({ status }).eq('id', id).eq('user_id', userId).select().single();
  return data ?? null;
}

// ── wear tracking ────────────────────────────────────────────────────────────
export async function markWorn(userId: string, pieceId: string) {
  const { data: piece } = await supabase.from('wardrobe_pieces').select('wear_count').eq('id', pieceId).eq('user_id', userId).maybeSingle();
  if (!piece) return null;
  const next = (Number(piece.wear_count) || 0) + 1;
  const { data } = await supabase.from('wardrobe_pieces').update({ wear_count: next, last_worn: new Date().toISOString() })
    .eq('id', pieceId).eq('user_id', userId).select('id, wear_count, last_worn').single();
  return data ?? null;
}
