// wanderer.ts — [0055] THE TRAVEL DESK GROWS A BODY AND A CLOCK.
//   1) buildTrip — the coach pattern applied to travel: Haiku + web search turns
//      a trip row (destination + the traveller's own free-text dates/notes) into a
//      real itinerary, a seeded checklist, parsed start/end dates, and flips it to
//      'planned'. Her spoken summary lands in her thread so the plan has a voice.
//   2) syncTripPings — the clock. Pure scheduled_pings, idempotent per trip: T-30
//      (paperwork), T-3 (pack), T-1 (eve). This is the room's retention move.
//   3) tripsFor — the read, with the auto-flip to 'live'/'done' as the window
//      arrives (the "date check in the trips GET").
import { supabase } from './db.js';
import { llm } from './llm.js';
import { logUsage } from './usage.js';
import { personaByKey } from './personas.js';

const anthropic = llm();
const istDate = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);

// get-or-create the traveller's 1:1 thread with the Wanderer (for her spoken summary)
async function wandererThread(userId: string): Promise<string | null> {
  const p = personaByKey('the_wanderer');
  if (!p) return null;
  const { data: ex } = await supabase.from('threads').select('id')
    .eq('user_id', userId).eq('persona_key', 'the_wanderer').eq('is_group', false).is('deleted_at', null)
    .order('last_active', { ascending: false }).limit(1).maybeSingle();
  if (ex) return ex.id;
  const { data, error } = await supabase.from('threads').insert({
    user_id: userId, persona_key: 'the_wanderer', codex_key: p.codex, companion_name: p.defaultName,
  }).select('id').single();
  return error ? null : data.id;
}

// ── 2. THE CLOCK ──────────────────────────────────────────────────────────
// A trip with a start_date grows deadlines. Idempotent: wipe THIS trip's unfired
// pings (never touch a delivered one) and re-lay them from the current dates.
export async function syncTripPings(trip: any): Promise<any[]> {
  if (!trip?.start_date || !trip?.id) return [];
  const tripId = trip.id;
  const userId = String(trip.user_id);
  const dest = trip.destination || 'your trip';
  await supabase.from('scheduled_pings').delete()
    .filter('payload->>trip_id', 'eq', tripId).is('fired_at', null);
  const start = new Date(trip.start_date + 'T09:00:00+05:30');   // 9am IST, day of
  if (isNaN(start.getTime())) return [];
  const now = Date.now();
  const at = (daysBefore: number) => new Date(start.getTime() - daysBefore * 86400000);
  const rows: any[] = [];
  const mk = (dueAt: Date, body: string, tag: string) => {
    if (dueAt.getTime() <= now) return;   // never schedule the past
    rows.push({
      user_id: userId, persona_key: 'the_wanderer', kind: 'reminder', thread_id: null,
      body, payload: { trip_id: tripId, kind: 'trip', tag }, due_at: dueAt.toISOString(),
    });
  };
  // T-30 — the paperwork window: unticked visa/booking/insurance items
  const cl: any[] = Array.isArray(trip.checklist) ? trip.checklist : [];
  const open = cl.filter((c) => c && !c.done && c.item).map((c) => String(c.item));
  const paper = open.filter((i) => /visa|passport|insurance|book|flight|vaccinat|forex|currency/i.test(i));
  mk(at(30), paper.length
      ? `${dest} is a month out. still open on your list: ${paper.slice(0, 4).join(', ')}. want to knock these out?`
      : `${dest} is a month out — the window to lock flights and stays before they climb. want to run through what's left?`,
    'T-30');
  // T-3 — pack (the wardrobe join is a later phase; the nudge stands now)
  mk(at(3), `three days to ${dest}. time to pack — want me to build you a list?`, 'T-3');
  // T-1 — eve of departure. Live weather rides her thread on tap; no stale forecast baked here.
  mk(at(1), `tomorrow's the day — ${dest} awaits. want tomorrow's weather and one last look at the plan?`, 'T-1');
  if (rows.length) await supabase.from('scheduled_pings').insert(rows);
  return rows;
}

// ── 1. BUILD ──────────────────────────────────────────────────────────────
export async function buildTrip(userId: string, tripId: string): Promise<any | null> {
  const { data: trip } = await supabase.from('trip_files').select('*').eq('id', tripId).eq('user_id', userId).maybeSingle();
  if (!trip) return null;
  const today = istDate();
  const sys = `You are THE WANDERER planning a real trip. You have web search — use it to ground the plan in what actually exists at the destination (season, a few real anchor sights, rough costs), but NEVER invent a specific bookable place or URL you did not find. Today is ${today} (IST).

Reply with ONLY strict JSON — no fences, no prose before or after:
{
  "start_date": "YYYY-MM-DD, or null if the dates are too vague to pin",
  "end_date": "YYYY-MM-DD, or null",
  "budget": "a short realistic budget line, Rs not the symbol, or null",
  "itinerary": [ { "day": 1, "title": "short day title", "items": ["2-4 concrete things, one line each"] } ],
  "checklist": [ { "item": "visa / insurance / forex / a key booking — 6 to 10 items", "done": false } ],
  "summary": "3-4 sentences in your own warm voice: the shape of the trip and the one thing to lock first. Plain Indian English, Rs never the symbol."
}
Resolve relative dates ("next month", "a week in December") to real calendar dates from today. Keep the itinerary to the actual duration; if the duration is unknown, plan 4-5 days.`;
  const fileTxt = `THE TRIP FILE:\ndestination: ${trip.destination}\ndates (their words): ${trip.dates || 'not given'}\ntravellers: ${trip.travelers || 'not given'}\nnotes / taste: ${trip.notes || 'none'}`;
  const msg: any = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001', max_tokens: 3000, __pin: 'anthropic',
    system: sys,
    messages: [{ role: 'user', content: fileTxt + '\n\nBuild the plan.' }],
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as any],
  });
  logUsage({ userId, surface: 'other', fn: 'trip_build', model: 'claude-haiku-4-5-20251001', usage: (msg as any).usage });
  const raw = (Array.isArray(msg.content) ? msg.content : [])
    .filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('\n');
  let x: any = {};
  try {
    const j = raw.replace(/```json|```/g, '');
    const a = j.indexOf('{'); const b = j.lastIndexOf('}');
    x = a >= 0 && b > a ? JSON.parse(j.slice(a, b + 1)) : {};
  } catch { /* defensive: partial build below */ }
  const isDate = (s: any) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const itinerary = Array.isArray(x.itinerary) ? x.itinerary.slice(0, 30).map((d: any, i: number) => ({
    day: Number(d?.day) || i + 1,
    title: String(d?.title || '').slice(0, 120),
    items: Array.isArray(d?.items) ? d.items.slice(0, 8).map((s: any) => String(s).slice(0, 200)) : [],
  })) : null;
  const checklist = Array.isArray(x.checklist)
    ? x.checklist.slice(0, 20).map((c: any) => ({ item: String(c?.item || '').slice(0, 160), done: !!c?.done })).filter((c: any) => c.item)
    : null;
  // [0055-fix] a build that produced no real itinerary must NOT masquerade as
<<<<<<< ours
  // 'planned'. Bail with the raw model output so a failure is visible, not silent.
  const _debug = { rawLen: raw.length, stop: (msg as any).stop_reason, parsedKeys: Object.keys(x), head: raw.slice(0, 400), tail: raw.slice(-400) };
  const built = Array.isArray(itinerary) && itinerary.length > 0;
  if (!built) return { ...trip, built: false, _debug };
=======
  // 'planned' — leave the trip 'dreaming' rather than write a hollow plan.
  const built = Array.isArray(itinerary) && itinerary.length > 0;
  if (!built) return { ...trip, built: false };
>>>>>>> theirs
  const patch: any = {
    status: 'planned',
    itinerary,
    checklist,
    budget: x.budget ? String(x.budget).replace(/\u20B9\s*/g, 'Rs ').slice(0, 200) : null,
    start_date: isDate(x.start_date) ? x.start_date : null,
    end_date: isDate(x.end_date) ? x.end_date : null,
    updated_at: new Date().toISOString(),
  };
  const { data: updated } = await supabase.from('trip_files').update(patch).eq('id', tripId).eq('user_id', userId).select('*').single();
  // her voice: the plan isn't just JSON — she leaves a spoken summary on the thread
  // [0055-fix] the model sometimes wraps web-search citations as inline <cite> tags
  // inside the summary string — strip the markup, keep the words; her voice stays clean.
  const summary = String(x.summary || '').replace(/<\/?cite[^>]*>/gi, '').replace(/\u20B9\s*/g, 'Rs ').replace(/\s{2,}/g, ' ').trim().slice(0, 1200);
  if (summary) {
    const tid = await wandererThread(userId);
    if (tid) {
      await supabase.from('messages').insert({ thread_id: tid, user_id: userId, role: 'assistant', content: summary, persona_key: 'the_wanderer' });
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', tid);
    }
  }
  const pings = await syncTripPings(updated);
<<<<<<< ours
  return { ...(updated || trip), built: true, pings, _debug };
=======
  return { ...(updated || trip), built: true, pings };
>>>>>>> theirs
}

// ── 3. THE READ (with the clock's flip) ────────────────────────────────────
export async function tripsFor(userId: string): Promise<any[]> {
  const { data } = await supabase.from('trip_files')
    .select('id, destination, dates, travelers, notes, status, start_date, end_date, itinerary, checklist, budget, shop_cards, updated_at')
    .eq('user_id', userId).order('updated_at', { ascending: false }).limit(60);
  const trips = (data ?? []) as any[];
  const today = istDate();
  const flips: { id: string; status: string }[] = [];
  for (const t of trips) {
    if (!t.start_date || t.status === 'done') continue;
    let derived = t.status;
    if (t.end_date && today > t.end_date) derived = 'done';
    else if (today >= t.start_date && (!t.end_date || today <= t.end_date)) derived = 'live';
    if (derived !== t.status && (derived === 'live' || derived === 'done')) {
      t.status = derived;
      flips.push({ id: t.id, status: derived });
    }
  }
  for (const fl of flips) {
    supabase.from('trip_files').update({ status: fl.status }).eq('id', fl.id).eq('user_id', userId)
      .then(({ error }: any) => { if (error) console.error('[trip] live-flip failed:', error.message); });
  }
  return trips;
}
