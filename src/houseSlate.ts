// ════════════════════════════════════════════════════════════════════════
//  Z — houseSlate · THE CLOCK: programming, or rooms die quiet (R5 · v1 §8)
//  A small weekly slate of HOUSE rooms with real recurring events:
//    · the anchor's 9 o'clock — nightly, the bulletin discussed (21:00 IST)
//    · debate night — Fridays, a motion from the bank, the devil's advocate
//      hosting (20:00 IST)
//    · the trivia gauntlet — Wednesdays, the comic hosting (20:00 IST)
//  Built BESIDE eveningProgramme.ts (the audit ruling) — same doctrine
//  (code chooses, the model only voices), zero shared code paths.
//  Announced, never spammed: the slate feeds the Host's desk brief and ONE
//  opt-in knock (scheduled_pings) for members of tonight's room — and the
//  house-wide one-knock law is enforced at the insert: a user who already
//  had today's knock gets silence, not filler.
//  Never invent: the anchor's opener names only what the bulletin actually
//  carries; the motion comes from the authored bank; if a source is empty,
//  the opener stays general rather than fabricating.
//  Migration-free: house rooms are ensured idempotently at arm time
//  (inhabitation law honoured — personas[0] is the host, doorman alongside).
// ════════════════════════════════════════════════════════════════════════
import { llm, firstText } from './llm.js';
import { supabase } from './db.js';
import { logUsage } from './usage.js';
import { getBulletin } from './bulletin.js';
import { MOTIONS } from './games/battlefieldDuel.js';
import { broadcastRoomMessage } from './broadcast.js';

const anthropic = llm();
const MODEL = 'claude-haiku-4-5-20251001';
const IST_MS = 5.5 * 3600 * 1000;

// ── the slate itself: code-defined, IST. days: 0=Sun…6=Sat; null = nightly.
export interface SlateEvent {
  id: string; slug: string; roomName: string; theme: string;
  host: string; hourIST: number; days: number[] | null; title: string;
}
export const SLATE: SlateEvent[] = [
  {
    id: 'anchors_nine', slug: 'the-nine-oclock', roomName: "the 9 o'clock",
    theme: "the anchor reads the night's bulletin with the room — what actually happened today, argued out loud",
    host: 'the_anchor', hourIST: 21, days: null, title: "the anchor's 9 o'clock",
  },
  {
    id: 'debate_night', slug: 'debate-night', roomName: 'debate night',
    theme: "one motion, every friday — the devil's advocate holds the floor and nobody leaves agreeing",
    host: 'the_brainiac', hourIST: 20, days: [5], title: 'debate night',
  },
  {
    id: 'trivia_gauntlet', slug: 'trivia-gauntlet', roomName: 'the trivia gauntlet',
    theme: 'wednesday nights the comic runs the gauntlet — fast questions, faster heckling',
    host: 'the_comic', hourIST: 20, days: [3], title: 'the trivia gauntlet',
  },
];

const istNow = () => new Date(Date.now() + IST_MS);
const istDayStartUTC = () => {
  const n = istNow();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()) - IST_MS);
};

// what's on tonight (today, IST)
export function tonightOnTheSlate(): SlateEvent[] {
  const dow = istNow().getUTCDay();
  return SLATE.filter((e) => e.days === null || e.days.includes(dow));
}

// ── house rooms, ensured idempotently (migration-free per v1 §8) ─────────
const roomIdBySlug: Record<string, { id: string; thread_id: string }> = {};
export async function ensureHouseRooms(): Promise<void> {
  // threads.user_id is NOT NULL (0001 spine): house threads take a NOMINAL
  // owner — the first user, exactly 0030's seed convention. Access is
  // governed by room_members, never this field. (Field bug 2026-07-13: the
  // insert omitted user_id, every ensure failed silently at boot.)
  let owner: string | null = null;
  {
    const { data: u } = await supabase.from('users')
      .select('id').is('deleted_at', null).order('created_at', { ascending: true }).limit(1).maybeSingle();
    owner = (u as any)?.id || null;
  }
  if (!owner) { console.error('[slate] no users yet — house rooms wait for the first account'); return; }
  for (const e of SLATE) {
    try {
      const { data: ex } = await supabase.from('public_rooms')
        .select('id, thread_id').eq('slug', e.slug).maybeSingle();
      if (ex) { roomIdBySlug[e.slug] = ex as any; continue; }
      const { data: thread, error: te } = await supabase.from('threads').insert({
        user_id: owner, is_group: true, is_shared: true, member_keys: [e.host, 'the_moderator'],
        companion_name: e.roomName,
      }).select('id').single();
      if (te || !thread) { console.error('[slate] thread for', e.slug, te?.message); continue; }
      const { data: room, error: re } = await supabase.from('public_rooms').insert({
        thread_id: (thread as any).id, slug: e.slug, name: e.roomName, theme: e.theme,
        persona_keys: [e.host, 'the_moderator'], is_house: true, active: true, sort_order: 5,
      }).select('id, thread_id').single();
      if (re || !room) { console.error('[slate] room for', e.slug, re?.message); continue; }
      roomIdBySlug[e.slug] = room as any;
      console.log('[slate] house room ensured:', e.slug);
    } catch (err: any) { console.error('[slate] ensure failed:', e.slug, err?.message || err); }
  }
}

// ── the opener: code chooses the material, the model only voices it ──────
async function openerMaterial(e: SlateEvent): Promise<string> {
  if (e.id === 'anchors_nine') {
    try {
      const stories: any[] = (await getBulletin('in')) || [];
      const heads = stories.slice(0, 3).map((i: any) => i.title || i.headline || '').filter(Boolean);
      if (heads.length) return `Tonight's bulletin leads: ${heads.join(' · ')}. Open the 9 o'clock on the strongest of these — name it plainly, invite the room's read. Never add facts beyond these headlines.`;
    } catch (err) { /* fall through */ }
    return 'The bulletin is quiet tonight. Open the 9 o\'clock generally — ask the room what actually happened in THEIR day worth arguing about. Do not fabricate any news.';
  }
  if (e.id === 'debate_night') {
    // deterministic weekly pick from the authored bank — same motion for everyone all night
    const week = Math.floor((Date.now() + IST_MS) / (7 * 864e5));
    const m: any = MOTIONS[week % MOTIONS.length];
    const motion = typeof m === 'string' ? m : (m?.motion || '');
    if (motion) return `Tonight's motion, from the house bank: "${motion}". Open debate night: table the motion word for word, take no side yourself yet, and call for the first FOR and the first AGAINST.`;
    return 'Open debate night: ask the room to table tonight\'s motion — the floor picks, you hold it fair.';
  }
  // trivia_gauntlet
  return 'Open the trivia gauntlet hour in your own register: the rules are speed and shamelessness, wrong answers get heckled with love. Invite the first round — the ROOM asks and answers; you keep score loosely and keep it moving. Do not state trivia facts yourself in the opener.';
}

async function hostOpener(e: SlateEvent, room: { thread_id: string }): Promise<void> {
  const material = await openerMaterial(e);
  let line = '';
  try {
    const resp = await anthropic.messages.create({
      model: MODEL, max_tokens: 220,
      system: `You are ${e.host.replace(/^the_/, 'the ')} of a warm house of AI personas, opening tonight's "${e.title}" in a public house room. Write ONE short opening (2–4 sentences, your register, no lists, no headers). Ground yourself ONLY in the material given — never invent facts, headlines, or trivia answers.`,
      messages: [{ role: 'user', content: material }],
    });
    logUsage({ userId: 'house-slate', surface: 'other', fn: 'house-slate', model: MODEL, usage: (resp as any).usage });
    line = firstText(resp).trim();
  } catch (err: any) { console.error('[slate] opener gen failed:', e.id, err?.message || err); return; }
  if (!line) return;
  // messages.user_id is NOT NULL (denormalised for RLS): attribute the row to
  // the room's first member — same convention as doormanSpeak. An EMPTY house
  // room gets no performance: the clock speaks when someone lives there
  // (cost discipline; declared).
  const { data: mem } = await supabase.from('room_members').select('user_id').eq('thread_id', room.thread_id).limit(1).maybeSingle();
  if (!mem) return;
  // pacing law: the room takes a breath even at nine o'clock
  await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
  const { data: saved } = await supabase.from('messages').insert({
    thread_id: room.thread_id, user_id: (mem as any).user_id, role: 'assistant', content: line, persona_key: e.host,
  }).select('id').maybeSingle();
  if (!saved) return;
  await broadcastRoomMessage(room.thread_id, { role: 'assistant', content: line, persona_key: e.host, id: (saved as any).id });
  await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', room.thread_id);
}

// ── ONE opt-in knock for members of tonight's room — one-knock law at the
//    insert: any knock already scheduled or fired today = silence instead.
async function knockMembers(e: SlateEvent, room: { thread_id: string }): Promise<number> {
  const dayStart = istDayStartUTC().toISOString();
  const { data: mems } = await supabase.from('room_members')
    .select('user_id').eq('thread_id', room.thread_id).limit(500);
  let sent = 0;
  for (const m of (mems ?? []) as any[]) {
    try {
      const [{ count: c1 }, { count: c2 }] = await Promise.all([
        supabase.from('scheduled_pings').select('id', { count: 'exact', head: true })
          .eq('user_id', m.user_id).gte('due_at', dayStart),
        supabase.from('scheduled_pings').select('id', { count: 'exact', head: true })
          .eq('user_id', m.user_id).gte('fired_at', dayStart),
      ]);
      if ((c1 ?? 0) + (c2 ?? 0) > 0) continue;   // the one-knock law — silence over filler
      await supabase.from('scheduled_pings').insert({
        user_id: m.user_id, persona_key: 'the_front_desk', kind: 'house_slate',
        body: `tonight at the house — ${e.title} is starting in ${e.roomName}. the room's open; come sit.`,
        due_at: new Date().toISOString(),
      });
      sent++;
    } catch (err) { /* best-effort per member */ }
  }
  return sent;
}

// ── the clock: fire each of tonight's events once, at its hour ────────────
async function alreadyOpenedToday(e: SlateEvent, room: { thread_id: string }): Promise<boolean> {
  const dayStart = istDayStartUTC().toISOString();
  const { data } = await supabase.from('messages')
    .select('id').eq('thread_id', room.thread_id).eq('persona_key', e.host)
    .eq('role', 'assistant').gte('created_at', dayStart).limit(1);
  return !!(data && data.length);
}

export async function fireSlateTick(): Promise<void> {
  const hour = istNow().getUTCHours();
  for (const e of tonightOnTheSlate()) {
    if (hour !== e.hourIST) continue;
    const room = roomIdBySlug[e.slug];
    if (!room) continue;
    try {
      if (await alreadyOpenedToday(e, room)) continue;   // once per day, ever
      await hostOpener(e, room);
      const knocked = await knockMembers(e, room);
      console.log(`[slate] ${e.id} opened; knocked ${knocked}`);
    } catch (err: any) { console.error('[slate] fire failed:', e.id, err?.message || err); }
  }
}

export function armHouseSlate(): void {
  void ensureHouseRooms();
  setInterval(() => { void fireSlateTick(); }, 5 * 60 * 1000);   // 5-min tick; the hour gate + opened-today guard make it idempotent
  console.log('[slate] the house clock armed (5-min tick, IST slots)');
}

// tonight's line for the Host's desk brief — data only, no model.
export function tonightAtTheHouseLine(): { line: string; host: string } | null {
  const on = tonightOnTheSlate();
  if (!on.length) return null;
  const parts = on.map((e) => `${e.title} · ${e.hourIST > 12 ? e.hourIST - 12 : e.hourIST}pm`);
  return { line: parts.join('  ·  '), host: on[0].host };
}
