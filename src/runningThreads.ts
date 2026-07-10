// runningThreads.ts — [§7] THE SHARED STORY. The persona's diary simulates
// THEIR life; this table accrues the one the persona and this person have
// TOGETHER — the brother's family saga, the colleague's office arc, the
// crush's inside joke. Max 3 open per (user, persona): the stalest open
// thread auto-closes when a 4th is filed. Institutions never carry these —
// the same boundary the memory block draws.
import { supabase } from './db.js';
import { gapLabel } from './timegap.js';

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
