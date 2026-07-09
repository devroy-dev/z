// deskRooms.ts — [DESK COMES ALIVE] the per-room live lines. The desk stops
// being a directory of slogans: each door shows the state of the work behind
// it. Pure SELECTs + string templates — the desk costs ZERO tokens to open;
// any model call in this file is a spec violation.
//
// Contract: assembleDeskRooms(userId) → { [openKind]: { line, hot } | null }
//   line — composed short server-side (< ~60 chars; the tap is the full view)
//   hot  — this room appears in the prioritized brief (it needs you)
//   null — the room has nothing; the surface files it under "the rest of the
//          house" with its soul-line. Never invent state: no row, no line.
import { supabase } from './db.js';
import { assembleDeskBrief } from './deskBrief.js';

export type RoomLine = { line: string; hot: boolean } | null;
export type DeskRooms = Record<string, RoomLine>;

const istToday = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
const daysUntil = (dateStr: string): number => {
  const a = Date.parse(istToday() + 'T00:00:00Z'), b = Date.parse(String(dateStr) + 'T00:00:00Z');
  if (isNaN(b)) return 9999;
  return Math.round((b - a) / 86400000);
};
const clip = (s: any, n: number): string => {
  const str = String(s || '');
  if (str.length <= n) return str;
  const cut = str.slice(0, n);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).trimEnd() + '…';
};

export async function assembleDeskRooms(userId: string): Promise<DeskRooms> {
  const rooms: DeskRooms = { mmroom: null, wanderer: null, stylist: null, bulletin: null, coach: null, panel: null, forge: null, consult: null };

  // [v3] ALL blocks run CONCURRENTLY — sequential awaits cost ~13 round trips
  // (~2s felt on the landing page). Parallel: the slowest single block wins.
  const hotTask = (async () => {
    const hot = new Set<string>();
    try {
      const KIND: Record<string, string> = { trip: 'wanderer', mm: 'mmroom', coach: 'coach', stylist: 'stylist', news: 'bulletin' };
      for (const it of await assembleDeskBrief(userId)) if (KIND[it.key]) hot.add(KIND[it.key]);
    } catch (e: any) { console.error('[deskRooms] brief:', e?.message || e); }
    return hot;
  })();

  const mmTask = (async () => {
    try {
      const { count } = await supabase.from('mm_tasks')
        .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open');
      if (count && count > 0) return { line: `${count} commitment${count === 1 ? '' : 's'} open this week` };
      const { data: note } = await supabase.from('mm_desk_notes').select('created_at')
        .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (note && daysUntil(String(note.created_at).slice(0, 10)) >= -3) return { line: 'a fresh desk note is waiting' };
    } catch (e: any) { console.error('[deskRooms] mm:', e?.message || e); }
    return null;
  })();

  const tripTask = (async () => {
    try {
      const { data: trips } = await supabase.from('trip_files')
        .select('destination, status, start_date, end_date, itinerary')
        .eq('user_id', userId).not('start_date', 'is', null)
        .order('start_date', { ascending: true }).limit(6);
      for (const tr of trips ?? []) {
        const d = daysUntil(tr.start_date);
        const over = tr.end_date ? daysUntil(tr.end_date) < 0 : d < -60;
        if (over || tr.status === 'done') continue;
        const live = tr.status === 'live' || (d <= 0 && tr.end_date && daysUntil(tr.end_date) >= 0);
        if (live) {
          const dayN = 1 - d;
          const today = Array.isArray(tr.itinerary) ? (tr.itinerary as any[])[dayN - 1] : null;
          const base = `day ${dayN} in ${tr.destination}`;
          return { line: today?.title ? clip(`${base} — ${today.title}`, 58) : clip(base, 58) };
        }
        if (d > 0 && d <= 45) return { line: clip(`${tr.destination} in ${d} day${d === 1 ? '' : 's'}`, 58) };
      }
    } catch (e: any) { console.error('[deskRooms] trips:', e?.message || e); }
    return null;
  })();

  const stylistTask = (async () => {
    try {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const [g, w] = await Promise.all([
        supabase.from('wardrobe_gaps').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'open').is('trip_id', null),
        supabase.from('wardrobe_pieces').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('last_worn', weekAgo),
      ]);
      const gaps = g.count || 0, worn = w.count || 0;
      if (gaps > 0) {
        let line = `${gaps} gap${gaps === 1 ? '' : 's'} worth closing`;
        if (worn > 0 && (line.length + 18) <= 58) line += ` · ${worn} worn this week`;
        return { line };
      }
      if (worn > 0) return { line: `${worn} piece${worn === 1 ? '' : 's'} worn this week`, cold: true };
    } catch { /* tables arrive with their phase — silent by design */ }
    return null;
  })();

  const newsTask = (async () => {
    try {
      const [b, t] = await Promise.all([
        supabase.from('bulletins').select('day').eq('scope', 'in').eq('day', istToday()).maybeSingle(),
        supabase.from('news_follows').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('kind', 'story'),
      ]);
      const tracked = t.count || 0;
      if (b.data) {
        let line = "today's edition is up";
        if (tracked > 0) line += ` · ${tracked} tracked`;
        return { line };
      }
      if (tracked > 0) return { line: `${tracked} stor${tracked === 1 ? 'y' : 'ies'} tracked` };
    } catch (e: any) { console.error('[deskRooms] news:', e?.message || e); }
    return null;
  })();

  const coachTask = (async () => {
    try {
      const { data: course } = await supabase.from('coach_courses')
        .select('topic, current_day, total_days').eq('user_id', userId).eq('status', 'active')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (course?.topic) return { line: clip(`${clip(course.topic, 26)}: day ${course.current_day} of ${course.total_days} waiting`, 58) };
    } catch (e: any) { console.error('[deskRooms] coach:', e?.message || e); }
    return null;
  })();

  const [hot, mm, trip, sty, news, coach] = await Promise.all([hotTask, mmTask, tripTask, stylistTask, newsTask, coachTask]);
  if (mm)   rooms.mmroom   = { line: mm.line,   hot: hot.has('mmroom') };
  if (trip) rooms.wanderer = { line: trip.line, hot: hot.has('wanderer') };
  if (sty)  rooms.stylist  = { line: sty.line,  hot: (sty as any).cold ? false : hot.has('stylist') };
  if (news) rooms.bulletin = { line: news.line, hot: hot.has('bulletin') };
  if (coach) rooms.coach   = { line: coach.line, hot: hot.has('coach') };

  // panel · forge · consult carry no per-user state tables — they rest in
  // "the rest of the house" with their soul-lines, by design.
  return rooms;
}
