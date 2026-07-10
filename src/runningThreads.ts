// runningThreads.ts — [§7] THE SHARED STORY. The persona's diary simulates
// THEIR life; this table accrues the one the persona and this person have
// TOGETHER — the brother's family saga, the colleague's office arc, the
// crush's inside joke. Max 3 open per (user, persona): the stalest open
// thread auto-closes when a 4th is filed. Institutions never carry these —
// the same boundary the memory block draws.
import { supabase } from './db.js';
import { gapLabel } from './timegap.js';
import { llm, firstText } from './llm.js';
import { logUsage } from './usage.js';

const anthropic = llm();
const HARVEST_MODEL = 'claude-haiku-4-5-20251001';

const norm = (t: string) => t.trim().replace(/\s+/g, ' ');

// the dynamic block — instructions ride even with zero threads filed, or the
// story could never begin. Spec text, verbatim shape.
export async function runningThreadsBlock(userId: string, personaKey: string): Promise<string> {
  let bullets = '';
  try {
    const { data } = await supabase.from('running_threads')
      .select('title, detail, last_touched')
      .eq('user_id', userId).eq('persona_key', personaKey).eq('status', 'open')
      .order('last_touched', { ascending: false }).limit(3);
    if (data?.length) {
      bullets = '\n' + data.map((r: any) => {
        const gap = gapLabel(Date.now() - new Date(r.last_touched).getTime());
        return `• ${r.title}${r.detail ? ' — ' + r.detail : ''}${gap ? ` (last touched ${gap})` : ''}`;
      }).join('\n');
    }
  } catch (e: any) { console.error('[threads] block failed:', e?.message || e); }
  return `\n\n[YOUR RUNNING THREADS with this person — the story you two have going. Pick the threads below back up naturally when the moment fits (the callback, the "did that ever get sorted") — never as a checklist, never all at once.${bullets}]\n\n[FILING THE STORY — when something genuinely ONGOING starts between you two in this conversation (a saga, a hunt, a move, a fight, a project, a recurring joke — a thing with a FUTURE, not small talk), END your reply (after your spoken words) with ONE line, exactly this machine format, which they never see: [[THREAD: short title | one-line detail]]. When one of the filed threads above genuinely RESOLVES in the conversation, END with: [[THREAD_CLOSE: the exact title]]. Emit only when something new starts or truly resolves — never for ordinary talk, never twice for the same thread.]`;
}

// upsert on (user, persona, lower(title)); the unique index is on an
// expression, so the match is done here rather than via onConflict.
export async function fileRunningThread(userId: string, personaKey: string, titleRaw: string, detailRaw: string | null): Promise<void> {
  try {
    const title = norm(titleRaw).slice(0, 120);
    if (!title) return;
    const detail = detailRaw ? norm(detailRaw).slice(0, 300) : null;
    const { data: existing } = await supabase.from('running_threads')
      .select('id, title').eq('user_id', userId).eq('persona_key', personaKey);
    const hit = (existing ?? []).find((r: any) => r.title.toLowerCase() === title.toLowerCase());
    const now = new Date().toISOString();
    if (hit) {
      await supabase.from('running_threads')
        .update({ detail, last_touched: now, status: 'open' }).eq('id', hit.id);
      console.log('[threads] touched:', title);
    } else {
      const { error } = await supabase.from('running_threads')
        .insert({ user_id: userId, persona_key: personaKey, title, detail });
      if (error) { console.error('[threads] insert failed:', error.message, '|', title); return; }
      console.log('[threads] filed:', title);
    }
    // the 4th open thread closes the stalest — the story stays small enough to live in
    const { data: open } = await supabase.from('running_threads')
      .select('id').eq('user_id', userId).eq('persona_key', personaKey).eq('status', 'open')
      .order('last_touched', { ascending: false });
    if (open && open.length > 3) {
      const stale = open.slice(3).map((r: any) => r.id);
      await supabase.from('running_threads').update({ status: 'closed' }).in('id', stale);
      console.log('[threads] auto-closed stalest:', stale.length);
    }
  } catch (e: any) { console.error('[threads] file failed:', e?.message || e); }
}

export async function closeRunningThread(userId: string, personaKey: string, titleRaw: string): Promise<void> {
  try {
    const title = norm(titleRaw);
    if (!title) return;
    const { data: existing } = await supabase.from('running_threads')
      .select('id, title').eq('user_id', userId).eq('persona_key', personaKey).eq('status', 'open');
    const hit = (existing ?? []).find((r: any) => r.title.toLowerCase() === title.toLowerCase());
    if (!hit) return;
    await supabase.from('running_threads').update({ status: 'closed', last_touched: new Date().toISOString() }).eq('id', hit.id);
    console.log('[threads] closed:', title);
  } catch (e: any) { console.error('[threads] close failed:', e?.message || e); }
}

export async function openRunningThreads(userId: string, personaKey: string): Promise<{ title: string; detail: string | null; last_touched: string; created_at: string }[]> {
  try {
    const { data } = await supabase.from('running_threads')
      .select('title, detail, last_touched, created_at')
      .eq('user_id', userId).eq('persona_key', personaKey).eq('status', 'open')
      .order('last_touched', { ascending: false }).limit(3);
    return (data as any) ?? [];
  } catch { return []; }
}


// ════════════════════════════════════════════════════════════════════════
// [§7 · CE ruling] THE THREAD HARVESTER — the engine records the saga, tag
// or no tag (the zip74 trip precedent, elevated to house law: in-band tags
// where filing is the persona's craft; out-of-band harvest where filing is
// orthogonal to character). Fire-and-forget after every companion turn,
// same run policy as harvestMemory; a failure never touches the reply.
// Kept separate from harvestMemory deliberately: its one-source law (facts
// from the user's message only) is structurally wrong for threads, which
// crystallize from the EXCHANGE.
// ════════════════════════════════════════════════════════════════════════
export async function harvestThreads(
  userId: string, threadId: string, personaKey: string, userMsg: string, reply: string,
): Promise<void> {
  try {
    const open = await openRunningThreads(userId, personaKey);
    const openList = open.length
      ? open.map((t) => `- "${t.title}"${t.detail ? ' — ' + t.detail : ''}`).join('\n')
      : '(none yet)';
    const resp = await anthropic.messages.create({
      model: HARVEST_MODEL, max_tokens: 250, temperature: 0,
      system:
        'You maintain the RUNNING THREADS between a person and their AI friend: the genuinely ONGOING sagas they share (a flat hunt, a family situation, a project, a recurring joke) — things with a FUTURE that will come up again. Ordinary talk, one-off questions, moods, and completed exchanges are NOT threads. Most turns change nothing.\n'
        + 'THE DEDUPE LAW (absolute): if this exchange continues a saga in CURRENT OPEN THREADS, return that thread\'s EXACT title verbatim in "file" (that updates it). A new title means a genuinely NEW saga, never a rewording of an existing one — "flat hunting" when "the flat hunt" is open is the SAME thread and must use the existing title.\n'
        + 'CLOSING: when the exchange makes clear a saga has genuinely RESOLVED (signed, done, over, given up), return its exact open title in "close".\n'
        + 'Titles are short (2-5 words); detail is one plain line of the latest state. At most 1 file and 1 close per turn.\n'
        + 'Return ONLY strict JSON: {"file":[{"title":"...","detail":"..."}],"close":["..."]} — empty arrays are the normal answer. No prose, no markdown.',
      messages: [{ role: 'user', content: `CURRENT OPEN THREADS:\n${openList}\n\nUSER SAID:\n${(userMsg || '').slice(0, 1500)}\n\nFRIEND REPLIED:\n${(reply || '').slice(0, 1500)}` }],
    });
    try { logUsage({ userId, threadId, personaKey, surface: 'other', fn: 'thread-harvest', model: HARVEST_MODEL, usage: (resp as any).usage }); } catch {}
    const clean = String(firstText(resp) || '{}').replace(/```json|```/g, '').trim();
    let j: any = {};
    try { j = JSON.parse(clean); } catch { return; }
    for (const f of (Array.isArray(j.file) ? j.file.slice(0, 1) : [])) {
      if (f?.title) await fileRunningThread(userId, personaKey, String(f.title), f.detail ? String(f.detail) : null);
    }
    for (const c of (Array.isArray(j.close) ? j.close.slice(0, 1) : [])) {
      if (c) await closeRunningThread(userId, personaKey, String(c));
    }
  } catch (e: any) { console.error('[threads] harvest failed:', e?.message || e); }
}

// ── [CE ruling] THE NIGHTLY JANITOR — closure is part of the story. ──────
// Deterministic (no model): auto-close open threads untouched >21 days,
// merge near-duplicate titles the harvester let slip (token-overlap; keep
// the freshest), re-enforce the 3-open cap. Idempotent — safe to run often.
const STOP = new Set(['the', 'a', 'an', 'of', 'my', 'his', 'her', 'our', 'this', 'that', 'and', 'saga']);
const toks = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w) && w.length > 2).map((w) => w.replace(/(ing|s|ed)$/, '')));
const overlap = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return 0;
  let hit = 0; for (const x of a) if (b.has(x)) hit++;
  return hit / Math.min(a.size, b.size);
};

export async function runThreadsJanitor(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 21 * 864e5).toISOString();
    const { data: stale } = await supabase.from('running_threads')
      .select('id').eq('status', 'open').lt('last_touched', cutoff);
    if (stale?.length) {
      await supabase.from('running_threads').update({ status: 'closed' }).in('id', stale.map((r: any) => r.id));
      console.log('[threads-janitor] closed stale >21d:', stale.length);
    }
    const { data: open } = await supabase.from('running_threads')
      .select('id, user_id, persona_key, title, last_touched').eq('status', 'open')
      .order('last_touched', { ascending: false });
    const groups: Record<string, any[]> = {};
    for (const r of open ?? []) (groups[`${r.user_id}:${r.persona_key}`] ??= []).push(r);
    let merged = 0, capped = 0;
    for (const rows of Object.values(groups)) {
      const keep: any[] = [];
      for (const r of rows) {
        const dup = keep.find((k) => overlap(toks(k.title), toks(r.title)) >= 0.6);
        if (dup) { await supabase.from('running_threads').update({ status: 'closed' }).eq('id', r.id); merged++; }
        else keep.push(r);
      }
      if (keep.length > 3) {
        const over = keep.slice(3).map((r) => r.id);
        await supabase.from('running_threads').update({ status: 'closed' }).in('id', over);
        capped += over.length;
      }
    }
    if (merged || capped) console.log('[threads-janitor] merged near-dups:', merged, '| cap-closed:', capped);
  } catch (e: any) { console.error('[threads-janitor] failed:', e?.message || e); }
}

// idempotent janitor → boot tick + every 6h is safe and survives dawn deploys
export function armThreadsJanitor(): void {
  setTimeout(() => void runThreadsJanitor(), 90 * 1000);
  setInterval(() => void runThreadsJanitor(), 6 * 3600 * 1000);
  console.log('[threads-janitor] armed (boot tick + 6h, idempotent)');
}
