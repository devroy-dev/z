// deskBrief.ts — [0058] THE HOUSE BRIEF. One cheap, model-free assembly of the
// REAL state the Host should be holding: a trip counting down, a task about to
// come due, this week's unmoved instruction, the coaching day that's waiting,
// today's lead. The marquee stops being theatre; the desk reads its own house.
// Every source is guarded on its own — a table that arrives in a later phase
// (stylist's wardrobe_gaps, §3/0054) simply contributes nothing until it exists.
import { supabase } from './db.js';

export type BriefItem = { key: string; kicker: string; line: string; route: string; prio: number };

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysUntil = (dateStr: string): number => {
  const t = istToday();
  const a = Date.parse(t + 'T00:00:00Z'), b = Date.parse(dateStr + 'T00:00:00Z');
  if (isNaN(b)) return 9999;
  return Math.round((b - a) / 86400000);
};
const whenLabel = (iso: string): string => {
  const d = new Date(iso); if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
};

// Assembles the brief, priority-ordered (lower prio = more urgent), capped at 5.
export async function assembleDeskBrief(userId: string): Promise<BriefItem[]> {
  const items: BriefItem[] = [];

  // ── trips counting down (trip_files v2) ──────────────────────────────────
  try {
    const { data: trips } = await supabase.from('trip_files')
      .select('destination, status, start_date, end_date, checklist')
      .eq('user_id', userId).not('start_date', 'is', null)
      .order('start_date', { ascending: true }).limit(6);
    for (const tr of trips ?? []) {
      const d = daysUntil(tr.start_date);
      if (d < -1 || d > 14) continue;   // only the near window
      const live = tr.status === 'live' || (d <= 0 && tr.end_date && daysUntil(tr.end_date) >= 0);
      const open = Array.isArray(tr.checklist) ? tr.checklist.filter((c: any) => c && !c.done && c.item) : [];
      const line = live
        ? `you're in ${tr.destination} — enjoy it`
        : `${tr.destination} in ${d} day${d === 1 ? '' : 's'}${open.length ? ` — ${String(open[0].item).slice(0, 40)} still open` : ''}`;
      items.push({ key: 'trip', kicker: live ? 'on your trip' : 'coming up', line, route: 'the_wanderer', prio: Math.max(0, d) });
      break;   // the nearest trip only
    }
  } catch (e: any) { console.error('[brief] trips:', e?.message || e); }

  // ── a task about to come due (next 48h) ──────────────────────────────────
  try {
    const soon = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const { data: tasks } = await supabase.from('tasks')
      .select('title, due_at, suggested_persona')
      .eq('user_id', userId).eq('status', 'open').not('due_at', 'is', null)
      .lte('due_at', soon).order('due_at', { ascending: true }).limit(1);
    const tk = tasks?.[0];
    if (tk) {
      const hrs = (Date.parse(tk.due_at) - Date.now()) / 3600000;
      items.push({
        key: 'task', kicker: 'on your list', line: `${String(tk.title).slice(0, 60)} — due ${whenLabel(tk.due_at)}`,
        route: tk.suggested_persona || 'the_front_desk', prio: Math.max(0, hrs / 24),
      });
    }
  } catch (e: any) { console.error('[brief] tasks:', e?.message || e); }

  // ── the Media Manager: this week's unmoved instruction, or a fresh memo ───
  try {
    const { data: task } = await supabase.from('mm_tasks').select('instruction, status')
      .eq('user_id', userId).order('week_of', { ascending: false }).limit(1).maybeSingle();
    if (task?.instruction && task.status === 'open') {
      items.push({ key: 'mm', kicker: "this week's move", line: String(task.instruction).slice(0, 90), route: 'the_media_manager', prio: 5 });
    } else {
      const { data: note } = await supabase.from('mm_desk_notes').select('created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (note && daysUntil(String(note.created_at).slice(0, 10)) >= -3) {
        items.push({ key: 'mm', kicker: 'from your manager', line: 'a fresh desk note is waiting', route: 'the_media_manager', prio: 6 });
      }
    }
  } catch (e: any) { console.error('[brief] mm:', e?.message || e); }

  // ── the coaching day that's waiting ──────────────────────────────────────
  try {
    const { data: course } = await supabase.from('coach_courses')
      .select('topic, current_day, total_days').eq('user_id', userId).eq('status', 'active')
      .order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (course?.topic) {
      items.push({
        key: 'coach', kicker: 'class is in session',
        line: `${course.topic}: day ${course.current_day} of ${course.total_days} is waiting`,
        route: 'the_coach', prio: 7,
      });
    }
  } catch (e: any) { console.error('[brief] coach:', e?.message || e); }

  // ── stylist gaps — arrives with §3 (migration 0054); guarded until then ───
  try {
    const { count } = await supabase.from('wardrobe_gaps')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('resolved', false);
    if (count && count > 0) {
      items.push({ key: 'stylist', kicker: 'your stylist noticed', line: `${count} gap${count === 1 ? '' : 's'} in your wardrobe worth closing`, route: 'the_stylist', prio: 8 });
    }
  } catch { /* table not present yet — silent by design */ }

  // ── today's lead (day-cached bulletin; no model billed) ──────────────────
  try {
    const { data: bul } = await supabase.from('bulletins').select('stories')
      .eq('scope', 'in').eq('day', istToday()).maybeSingle();
    const top = Array.isArray(bul?.stories) ? (bul!.stories as any[])[0] : null;
    if (top?.headline) {
      items.push({ key: 'news', kicker: "today's lead", line: String(top.headline).slice(0, 90), route: 'the_anchor', prio: 9 });
    }
  } catch (e: any) { console.error('[brief] news:', e?.message || e); }

  return items.sort((a, b) => a.prio - b.prio).slice(0, 5);
}

// Compact text form for the Front Desk's context block — so Z speaks the house.
export async function deskBriefText(userId: string): Promise<string> {
  const items = await assembleDeskBrief(userId);
  if (!items.length) return '';
  const lines = items.map((it) => `  • (${it.kicker}) ${it.line}  [→ ${it.route}]`).join('\n');
  return `\n\n[THE HOUSE RIGHT NOW — the real state you hold for them, freshest and most pressing first. Weave the ONE that fits when it fits, in your own voice, and offer the door in the bracket; never recite the whole list, never nag.\n${lines}]`;
}
