import { buildStaticPrefix, readContentFile } from './content.js';
// index.ts — the Z engine HTTP surface. Express. Verifies the Supabase Auth JWT
// the PWA sends, resolves the z.users row, and exposes:
//   POST /threads          create a named companion (persona instance)
//   GET  /threads          list the user's roster
//   POST /chat             one turn (SSE stream of tokens)
//   GET  /healthz          liveness
import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { resolveUser, isRestricted } from './zAccess.js';
import { transcribeAndStore, transcribeAudio, storeJournalText } from './journal.js';
import { runZTurn } from './loop.js';
import { runGroupTurn } from './groupLoop.js';
import { broadcastRoomMessage } from './broadcast.js';
import { harvestRoomMemory, readRoomMemoryBlock } from './roomMemory.js';
import { deterministicCheck } from './doorman.js';
import { seatbeltCheck } from './seatbelt.js';
import { runFollowups, startFollowupScheduler } from './followups.js';
import { myArcs, startArc, ARCS, completeArcIfFinal } from './arcs.js';
import { runStateWriter, currentStates, startStateScheduler } from './personaStates.js';
import { runMorningBriefs, startBriefScheduler } from './morningBrief.js';
import { runEveningProgrammes, startProgrammeScheduler } from './eveningProgramme.js';
import { startPingScheduler, firePings } from './concierge.js';
import { getBulletin, startBulletinScheduler } from './bulletin.js';
import { installSimRoutes, startSimScheduler } from './simFloor.js';
import { installFfRoutes, startFfScheduler } from './fantasyLeague.js';
import { installCustomPersonaRoutes, getCustomPersona } from './customPersonas.js';
import * as LD from './games/liarsdice.js';
import { callbreakAdapter, pusoyAdapter, pokerAdapter, ludoAdapter } from './games/adapters.js';
import { debateDuelAdapter } from './games/debateDuel.js';
import { battlefieldDuelAdapter } from './games/battlefieldDuel.js';
import { triviaDuelAdapter } from './games/triviaDuel.js';
import { logUsage, costSnapshot, costSince, diagEcho, DIAG_USER_ID } from './usage.js';
import { readMemoryBlock } from './memory.js';
import { personaByKey } from './personas.js';
import { PROFILE_BLURBS } from './blurbs.js';
import { supabase } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));   // native picker photos ride as base64 in /chat — 256kb 413'd every real photo

// serve the PWA (single-file B Field surface) from /public
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { finalVerdict as bfVerdict, runningNote as bfNote, adjudicatorReady, DOMAIN_LABELS, type DebateDomain } from './battlefieldAdjudicator.js';
import { grandMasterReady as gmReady } from './grandMaster.js';
const __dirname2 = dirname(fileURLToPath(import.meta.url));
// ONE shared Anthropic client, created at boot (like loop.ts) — reused across requests.
// Per-request `new Anthropic()` via dynamic import was causing "Premature close" on /banter.
// Native fetch (undici) — NOT the SDK's default node-fetch@2, which premature-closes
// streams on Node 22. Same fix as loop.ts; applies to /banter + /dev/echo.
const anthropicShared = new Anthropic({ fetch: globalThis.fetch as any });
startFollowupScheduler();
startStateScheduler();
startBriefScheduler();
startProgrammeScheduler();
startPingScheduler();
startBulletinScheduler();
startSimScheduler();
startFfScheduler();
// no-cache for HTML so a deploy is always reflected on next load (ends stale-cache confusion)
app.use((req, res, next) => {
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});
app.use(express.static(join(__dirname2, 'public')));

// the per-duel watch link: /watch/<sessionId> serves the ungated watch page, which
// reads the id from the path and streams that specific live duel.
app.get('/watch/:sessionId', (_req, res) => {
  res.sendFile(join(__dirname2, 'public', 'watch.html'));
});

// public config for the browser realtime client (anon key is public by design; RLS protects rows)
app.get('/config', (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// verify the caller's Supabase JWT → auth_user_id. Uses anon client just to read the token's user.
const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!);
// OTP uses the anon-key client (the real Supabase phone-auth path; Twilio Verify is the
// configured SMS provider in the Supabase dashboard).
const otpClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!);

// OPEN_MODE: no auth wall yet. The frontend sends a stable anonymous id in the
// x-z-user header; we use it as the auth_user_id directly. Flip OPEN_MODE off
// (and the header path is ignored) once Twilio Verify / Supabase auth is wired —
// one env switch, no rebuild.
// personas allowed in shared multi-human rooms — the safe-social/intellect set only.
// NEVER the crush, self-loathing/self-obsessed, addict, hottie, wingman, stranger (1:1 only).
const SHAREABLE_PERSONAS = new Set([
  'the_guru','the_oracle','the_brainiac','the_brother','the_healer',
  'the_comic','the_mentor','the_colleague','the_philosopher','the_historian',
  'the_cosmologist','the_moderator','the_media_manager','the_teacher',
  'the_economist','the_wannabe','the_screen_junkie','the_orator','the_conspiracy_theorist',
  'the_hippie','the_diva','the_cousin',
]);

const OPEN_MODE = (process.env.OPEN_MODE ?? 'true') === 'true';

async function authUser(req: express.Request): Promise<string | null> {
  if (OPEN_MODE) {
    const anon = (req.headers['x-z-user'] as string | undefined)?.trim();
    if (anon && /^[a-zA-Z0-9_-]{8,64}$/.test(anon)) return `open:${anon}`;
    // fall through to JWT if a real token is present even in open mode
  }
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const { data, error } = await authClient.auth.getUser(h.slice(7));
  if (error || !data?.user) return null;
  return data.user.id;
}

// ════════════════════════════════════════════════════════════════════════
//  FRIENDS v1 — handles + request/accept. Edges are canonical (lo<hi); the
//  engine (service role) owns writes and enforces "only the non-requester accepts".
// ════════════════════════════════════════════════════════════════════════

const HANDLE_RE = /^[a-z0-9_]{3,20}$/;

// set / change your @handle
app.post('/handle', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const raw = String((req.body ?? {}).handle || '').trim().toLowerCase().replace(/^@/, '');
    if (!HANDLE_RE.test(raw)) return res.status(400).json({ error: 'handle must be 3–20 chars: letters, numbers, underscore' });
    // taken by someone else?
    const { data: clash } = await supabase.from('users')
      .select('id').ilike('handle', raw).is('deleted_at', null).maybeSingle();
    if (clash && clash.id !== user.id) return res.status(409).json({ error: 'that handle is taken' });
    const { error } = await supabase.from('users').update({ handle: raw }).eq('id', user.id);
    if (error) return res.status(500).json({ error: 'handle save: ' + error.message });
    res.json({ handle: raw });
  } catch (e: any) { res.status(500).json({ error: 'handle failed: ' + (e?.message || String(e)) }); }
});

// look someone up by handle (to send a request)
app.get('/friends/find', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const raw = String(req.query.handle || '').trim().toLowerCase().replace(/^@/, '');
    if (!HANDLE_RE.test(raw)) return res.status(400).json({ error: 'not a valid handle' });
    const { data: them } = await supabase.from('users')
      .select('id, handle, display_name, avatar_url').ilike('handle', raw).is('deleted_at', null).maybeSingle();
    if (!them) return res.status(404).json({ error: 'no one by that handle' });
    if (them.id === me.id) return res.status(400).json({ error: "that's you" });
    // existing edge?
    const [lo, hi] = me.id < them.id ? [me.id, them.id] : [them.id, me.id];
    const { data: edge } = await supabase.from('friendships')
      .select('status, requested_by').eq('user_lo', lo).eq('user_hi', hi).maybeSingle();
    res.json({ id: them.id, handle: them.handle, display_name: them.display_name, avatar_url: (them as any).avatar_url || null,
      relation: edge ? edge.status : 'none',
      youRequested: edge ? edge.requested_by === me.id : false });
  } catch (e: any) { res.status(500).json({ error: 'find failed: ' + (e?.message || String(e)) }); }
});

// send a friend request (by their user id, from /friends/find)
app.post('/friends/request', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const targetId = String((req.body ?? {}).userId || '');
    if (!targetId || targetId === me.id) return res.status(400).json({ error: 'bad target' });
    const { data: them } = await supabase.from('users').select('id').eq('id', targetId).is('deleted_at', null).maybeSingle();
    if (!them) return res.status(404).json({ error: 'user not found' });
    const [lo, hi] = me.id < targetId ? [me.id, targetId] : [targetId, me.id];
    const { data: existing } = await supabase.from('friendships')
      .select('id, status').eq('user_lo', lo).eq('user_hi', hi).maybeSingle();
    if (existing) {
      if (existing.status === 'accepted') return res.json({ status: 'accepted' });
      if (existing.status === 'blocked') return res.status(403).json({ error: 'unavailable' });
      return res.json({ status: 'pending' }); // already pending, idempotent
    }
    const { error } = await supabase.from('friendships').insert({
      user_lo: lo, user_hi: hi, requested_by: me.id, status: 'pending',
    });
    if (error) return res.status(500).json({ error: 'request: ' + error.message });
    // FCM push to the recipient lands here when the notify layer is wired.
    res.json({ status: 'pending' });
  } catch (e: any) { res.status(500).json({ error: 'request failed: ' + (e?.message || String(e)) }); }
});

// accept (or decline/block) a pending request — only the NON-requester may accept
app.post('/friends/respond', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const { fromId, action } = req.body ?? {};
    if (!fromId || !['accept', 'decline', 'block'].includes(action)) return res.status(400).json({ error: 'bad request' });
    const [lo, hi] = me.id < fromId ? [me.id, fromId] : [fromId, me.id];
    const { data: edge } = await supabase.from('friendships')
      .select('id, status, requested_by').eq('user_lo', lo).eq('user_hi', hi).maybeSingle();
    if (!edge || edge.status !== 'pending') return res.status(404).json({ error: 'no pending request' });
    if (edge.requested_by === me.id) return res.status(403).json({ error: "you can't accept your own request" });
    if (action === 'decline') {
      await supabase.from('friendships').delete().eq('id', edge.id);
      return res.json({ status: 'declined' });
    }
    const status = action === 'block' ? 'blocked' : 'accepted';
    const { error } = await supabase.from('friendships')
      .update({ status, responded_at: new Date().toISOString() }).eq('id', edge.id);
    if (error) return res.status(500).json({ error: 'respond: ' + error.message });
    res.json({ status });
  } catch (e: any) { res.status(500).json({ error: 'respond failed: ' + (e?.message || String(e)) }); }
});

// my friends + pending requests waiting on me
app.get('/friends', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const { data: edges } = await supabase.from('friendships')
      .select('user_lo, user_hi, status, requested_by')
      .or(`user_lo.eq.${me.id},user_hi.eq.${me.id}`);
    const rows = edges ?? [];
    const otherId = (e: any) => (e.user_lo === me.id ? e.user_hi : e.user_lo);
    const friendIds = rows.filter((e: any) => e.status === 'accepted').map(otherId);
    const incoming = rows.filter((e: any) => e.status === 'pending' && e.requested_by !== me.id).map(otherId);
    const outgoing = rows.filter((e: any) => e.status === 'pending' && e.requested_by === me.id).map(otherId);
    const allIds = [...new Set([...friendIds, ...incoming, ...outgoing])];
    const byId: Record<string, any> = {};
    if (allIds.length) {
      const { data: us } = await supabase.from('users').select('id, handle, display_name, avatar_url').in('id', allIds);
      for (const u of (us ?? [])) byId[(u as any).id] = u;
    }
    const shape = (id: string) => ({ id, handle: byId[id]?.handle || null, display_name: byId[id]?.display_name || null, avatar_url: byId[id]?.avatar_url || null });
    res.json({
      friends: friendIds.map(shape),
      incoming: incoming.map(shape),
      outgoing: outgoing.map(shape),
    });
  } catch (e: any) { res.status(500).json({ error: 'friends failed: ' + (e?.message || String(e)) }); }
});

// open (or create) a DM thread with a friend → returns the thread id.
// a DM is a shared thread with two human members and NO persona keys.
app.post('/dm/:friendId', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const friendId = String(req.params.friendId || '');
    if (!friendId || friendId === me.id) return res.status(400).json({ error: 'bad friend' });
    // must actually be accepted friends
    const [lo, hi] = me.id < friendId ? [me.id, friendId] : [friendId, me.id];
    const { data: edge } = await supabase.from('friendships')
      .select('status').eq('user_lo', lo).eq('user_hi', hi).maybeSingle();
    if (!edge || edge.status !== 'accepted') return res.status(403).json({ error: 'not friends' });
    // existing DM? find a shared, persona-less thread where BOTH are members.
    const { data: myShared } = await supabase.from('room_members')
      .select('thread_id').eq('user_id', me.id);
    const myThreadIds = (myShared ?? []).map((r: any) => r.thread_id);
    if (myThreadIds.length) {
      const { data: shared } = await supabase.from('threads')
        .select('id, member_keys, is_shared').in('id', myThreadIds).is('deleted_at', null);
      const { data: theirMems } = await supabase.from('room_members')
        .select('thread_id').eq('user_id', friendId).in('thread_id', myThreadIds);
      const theirSet = new Set((theirMems ?? []).map((r: any) => r.thread_id));
      const dm = (shared ?? []).find((t: any) => t.is_shared && theirSet.has(t.id) && (!t.member_keys || t.member_keys.filter(Boolean).length === 0));
      if (dm) return res.json({ id: dm.id });
    }
    // create it: a shared thread, no persona members, both humans as members
    const { data: friendRow } = await supabase.from('users').select('display_name, handle').eq('id', friendId).maybeSingle();
    const title = (friendRow?.display_name || (friendRow?.handle ? '@' + friendRow.handle : 'a friend'));
    const { data: t, error } = await supabase.from('threads').insert({
      user_id: me.id, is_group: true, is_shared: true, member_keys: [], companion_name: title,
    }).select('id').single();
    if (error || !t) return res.status(500).json({ error: 'dm create: ' + (error?.message || 'failed') });
    await supabase.from('room_members').insert([
      { thread_id: t.id, user_id: me.id, role: 'owner' },
      { thread_id: t.id, user_id: friendId, role: 'member' },
    ]);
    res.json({ id: t.id });
  } catch (e: any) { res.status(500).json({ error: 'dm failed: ' + (e?.message || String(e)) }); }
});

// ════════════════════════════════════════════════════════════════════════
//  COMMUNITIES — public rooms. Curated house rooms anyone can join; the doorman
//  (the_moderator) is always resident. Reuses the shared-thread machinery.
// ════════════════════════════════════════════════════════════════════════

// the directory — every active public room, with live member count + residents
// a user creates a public room (locality, meetup, interest). The CREATOR is its
// moderator. Name/theme run through the deterministic gate so the directory can't
// be named abusively. Residents: 1-2 personas the user picks (the_moderator is
// always added as the doorman).
app.post('/public-rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const name = String((req.body ?? {}).name || '').trim().slice(0, 60);
    const theme = String((req.body ?? {}).theme || '').trim().slice(0, 200);
    if (name.length < 3) return res.status(400).json({ error: 'give your room a name (3+ characters)' });
    // name/theme gate: the deterministic check (slurs/doxx) on the visible text.
    const nameCheck = deterministicCheck(name + ' ' + theme);
    if (nameCheck.action === 'block') return res.status(400).json({ error: "that name won't fly — pick something civil." });
    // residents: up to 2 user-picked personas + the doorman
    let picks: string[] = Array.isArray((req.body ?? {}).personas) ? (req.body as any).personas : [];
    picks = [...new Set(picks.filter((k: any) => typeof k === 'string' && SHAREABLE_PERSONAS.has(k) && k !== 'the_moderator'))].slice(0, 2);
    const residents = [...picks, 'the_moderator'];
    // slug from the name (unique-ish; append a short random if taken)
    let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'room';
    const { data: clash } = await supabase.from('public_rooms').select('id').eq('slug', slug).maybeSingle();
    if (clash) slug = slug + '-' + Math.random().toString(36).slice(2, 6);
    // create the thread + the public_rooms row + creator membership
    const { data: thread, error: te } = await supabase.from('threads').insert({
      user_id: me.id, is_group: true, is_shared: true, member_keys: residents, companion_name: name,
    }).select('id').single();
    if (te || !thread) return res.status(500).json({ error: 'room create: ' + (te?.message || 'failed') });
    const { data: room, error: re } = await supabase.from('public_rooms').insert({
      thread_id: thread.id, slug, name, theme: theme || 'a room for good conversation',
      persona_keys: residents, created_by: me.id, is_house: false, member_count: 1,
      sort_order: 100,
    }).select('id, thread_id').single();
    if (re || !room) return res.status(500).json({ error: 'room register: ' + (re?.message || 'failed') });
    await supabase.from('room_members').insert({ thread_id: thread.id, user_id: me.id, role: 'owner' });
    res.json({ id: room.id, threadId: room.thread_id, name, slug });
  } catch (e: any) { res.status(500).json({ error: 'create failed: ' + (e?.message || String(e)) }); }
});

// the room CREATOR (moderator) kicks a member. 24h kick via room_sanctions.
app.post('/public-rooms/:id/kick', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const targetId = String((req.body ?? {}).userId || '');
    const { data: room } = await supabase.from('public_rooms')
      .select('id, thread_id, created_by, is_house').eq('id', req.params.id).maybeSingle();
    if (!room) return res.status(404).json({ error: 'no such room' });
    // only the creator moderates their own room (house rooms have no user-mod yet)
    if (room.is_house || room.created_by !== me.id) return res.status(403).json({ error: 'only the room’s creator can do that.' });
    if (!targetId || targetId === me.id) return res.status(400).json({ error: 'pick someone else to remove.' });
    // record a 24h kick sanction + remove from the thread
    await supabase.from('room_sanctions').insert({
      room_id: room.id, user_id: targetId, kind: 'kick',
      until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), reason: 'creator-kick',
    });
    await supabase.from('room_members').delete().eq('thread_id', room.thread_id).eq('user_id', targetId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'kick failed: ' + (e?.message || String(e)) }); }
});

app.get('/public-rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const { data: rooms } = await supabase.from('public_rooms')
      .select('id, thread_id, slug, name, theme, persona_keys, member_count, sort_order, created_by, is_house')
      .eq('active', true).order('is_house', { ascending: false }).order('sort_order', { ascending: true });
    // which of these has the user already joined?
    const threadIds = (rooms ?? []).map((r: any) => r.thread_id);
    const joined = new Set<string>();
    if (threadIds.length) {
      const { data: mems } = await supabase.from('room_members')
        .select('thread_id').eq('user_id', me.id).in('thread_id', threadIds);
      for (const m of (mems ?? [])) joined.add((m as any).thread_id);
    }
    res.json((rooms ?? []).map((r: any) => ({
      id: r.id, threadId: r.thread_id, slug: r.slug, name: r.name, theme: r.theme,
      personas: (r.persona_keys || []).filter((k: string) => k !== 'the_moderator'),
      doorman: 'the_moderator',
      memberCount: r.member_count, joined: joined.has(r.thread_id),
      isHouse: !!r.is_house, youCreated: r.created_by === me.id,
    })));
  } catch (e: any) { res.status(500).json({ error: 'public rooms failed: ' + (e?.message || String(e)) }); }
});

// join a public room — adds membership on the underlying thread, bumps member_count
app.post('/public-rooms/:id/join', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const me = await resolveUser(authId);
    const { data: room } = await supabase.from('public_rooms')
      .select('id, thread_id, name, active').eq('id', req.params.id).maybeSingle();
    if (!room || !room.active) return res.status(404).json({ error: 'no such room' });
    // a permanent ban blocks joining outright
    const { data: ban } = await supabase.from('room_sanctions')
      .select('id, kind, until').eq('room_id', room.id).eq('user_id', me.id)
      .eq('kind', 'ban').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (ban) return res.status(403).json({ error: 'the doorman has barred you from this room.' });
    // already a member? idempotent
    const { data: existing } = await supabase.from('room_members')
      .select('thread_id').eq('thread_id', room.thread_id).eq('user_id', me.id).maybeSingle();
    if (!existing) {
      await supabase.from('room_members').insert({ thread_id: room.thread_id, user_id: me.id, role: 'member' });
      // rpc errors surface on the result, not as a rejection — .catch broke the build
      const { error: rpcErr } = await supabase.rpc('increment_public_room_count', { rid: room.id });
      if (rpcErr) {
        // no rpc? fall back to a read-modify-write
        const { data: r2 } = await supabase.from('public_rooms').select('member_count').eq('id', room.id).maybeSingle();
        await supabase.from('public_rooms').update({ member_count: ((r2 as any)?.member_count || 0) + 1 }).eq('id', room.id);
      }
    }
    res.json({ id: room.id, threadId: room.thread_id, name: room.name });
  } catch (e: any) { res.status(500).json({ error: 'join failed: ' + (e?.message || String(e)) }); }
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// create a companion
app.post('/threads', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { personaKey, name, gender, avatarUrl, accent } = req.body ?? {};
    const persona = personaByKey(personaKey);
    // custom personas: only the OWNER may open a thread with their own live custom
    let custom: any = null;
    if (!persona && String(personaKey || '').startsWith('custom_')) {
      custom = await getCustomPersona(String(personaKey), user.id);
      if (!custom || custom.status !== 'live') custom = null;
    }
    if (!persona && !custom) return res.status(400).json({ error: 'unknown persona: ' + personaKey });
    // reuse the user's existing 1:1 thread for this persona if one exists (no duplicates, history stays)
    const resolvedKey = persona ? persona.key : custom.key;
    const { data: existing } = await supabase.from('threads')
      .select('id, persona_key, companion_name, avatar_url, accent')
      .eq('user_id', user.id).eq('persona_key', resolvedKey)
      .eq('is_group', false).is('deleted_at', null)
      .order('last_active', { ascending: false }).limit(1).maybeSingle();
    if (existing) return res.json(existing);
    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id,
      persona_key: persona ? persona.key : custom.key,
      codex_key: persona ? persona.codex : 'custom',
      companion_name: name || (persona ? persona.defaultName : custom.name),
      companion_gender: gender ?? null,
      avatar_url: avatarUrl ?? null,
      accent: accent ?? null,
    }).select('id, persona_key, companion_name, avatar_url, accent').single();
    if (error) return res.status(500).json({ error: 'thread insert: ' + error.message });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'threads failed: ' + (e?.message || String(e)) });
  }
});

// ── ARENA ─────────────────────────────────────────────────────────────────
// start (or resume) a game: reuse the persona's 1:1 thread, set its game_mode.
app.post('/arena/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { game, personaKey } = req.body ?? {};
    const allowed = ['debate', 'trivia', 'dilemma', 'twenty', 'wyr', 'riddle', 'learn'];
    if (!allowed.includes(String(game))) return res.status(400).json({ error: 'unknown game' });
    const persona = personaByKey(personaKey);
    if (!persona) return res.status(400).json({ error: 'unknown persona: ' + personaKey });

    // QUIZ & LEARN is COOPERATIVE — a solo session with the professor, no moderator, no score.
    if (game === 'learn') {
      let lid: string;
      const { data: ex } = await supabase.from('threads')
        .select('id').eq('user_id', user.id).eq('persona_key', persona.key)
        .eq('is_group', false).is('deleted_at', null)
        .order('last_active', { ascending: false }).limit(1).maybeSingle();
      if (ex) { lid = ex.id; await supabase.from('threads').update({ game_mode: 'learn' }).eq('id', lid); }
      else {
        const { data, error } = await supabase.from('threads').insert({
          user_id: user.id, persona_key: persona.key, codex_key: persona.codex,
          companion_name: persona.defaultName, game_mode: 'learn',
        }).select('id').single();
        if (error) return res.status(500).json({ error: 'learn start: ' + error.message });
        lid = data.id;
      }
      return res.json({ threadId: lid, game, persona: persona.key, isGroup: false });
    }

    // The competitive Arena match is a GROUP: the opponent + the moderator (neutral judge).
    const members = [persona.key, 'the_moderator'];
    const arenaName = 'the arena';
    let threadId: string;
    // reuse a prior arena group for THIS game+opponent (so a player's match thread is stable), else create
    const { data: existing } = await supabase.from('threads')
      .select('id').eq('user_id', user.id).eq('is_group', true)
      .contains('member_keys', members).eq('companion_name', arenaName)
      .is('deleted_at', null).order('last_active', { ascending: false }).limit(1).maybeSingle();
    if (existing) {
      threadId = existing.id;
      await supabase.from('threads').update({ game_mode: game, member_keys: members }).eq('id', threadId);
    } else {
      const { data, error } = await supabase.from('threads').insert({
        user_id: user.id, is_group: true, member_keys: members,
        companion_name: arenaName, game_mode: game,
      }).select('id').single();
      if (error) return res.status(500).json({ error: 'arena start: ' + error.message });
      threadId = data.id;
    }
    res.json({ threadId, game, persona: persona.key, members, isGroup: true });
  } catch (e: any) { res.status(500).json({ error: 'arena start failed: ' + (e?.message || String(e)) }); }
});

// ── ROLEPLAY (the Freedom Space) ────────────────────────────────────────────
// start a mission-roleplay: a GROUP thread with a scenario + a cast of personas
// + the moderator (director/judge). The moderator's first turn sets the scene.
app.post('/roleplay/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { scenario, brief, cast } = req.body ?? {};
    // accept any scenario id (the Stage library rotates through many); just sanitize it.
    // the id is passed to the moderator as context; it generates the scene from the premise.
    const scenarioKey = String(scenario || '').replace(/[^a-z0-9_]/gi, '').slice(0, 40);
    if (!scenarioKey) return res.status(400).json({ error: 'unknown scenario' });
    // cast = persona keys that will play the roles (3-5); fall back to a sensible default set
    let castKeys: string[] = Array.isArray(cast) ? cast.filter((k: any) => typeof k === 'string') : [];
    if (castKeys.length < 3) {
      castKeys = ['the_brainiac', 'the_orator', 'the_comic', 'the_brother'];
    }
    castKeys = castKeys.filter((k) => k !== 'the_moderator').slice(0, 5);
    const members = [...castKeys, 'the_moderator'];
    const safeBrief = typeof brief === 'string' ? brief.slice(0, 1000) : '';

    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, member_keys: members,
      companion_name: 'roleplay', scenario_key: scenarioKey, scenario_brief: safeBrief || null,
    }).select('id').single();
    if (error) return res.status(500).json({ error: 'roleplay start: ' + error.message });
    res.json({ threadId: data.id, scenario: scenarioKey, members, isGroup: true });
  } catch (e: any) { res.status(500).json({ error: 'roleplay start failed: ' + (e?.message || String(e)) }); }
});

// the door: a drop-in is accepted (opener lands in the chat) or ignored (they leave)
app.post('/dropin/:id/accept', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: p } = await supabase.from('ping_log')
      .select('id, persona_key, ping, status').eq('id', req.params.id).eq('user_id', user.id).eq('kind', 'dropin').maybeSingle();
    if (!p) return res.status(404).json({ error: 'not at the door' });
    const persona = personaByKey(p.persona_key);
    if (!persona) return res.status(400).json({ error: 'unknown persona' });
    // find-or-create their 1:1 thread, land the opener
    const { data: ex } = await supabase.from('threads')
      .select('id').eq('user_id', user.id).eq('persona_key', p.persona_key)
      .eq('is_group', false).is('deleted_at', null)
      .order('last_active', { ascending: false }).limit(1).maybeSingle();
    let threadId = ex?.id ?? null;
    if (!threadId) {
      const { data: nt } = await supabase.from('threads').insert({
        user_id: user.id, persona_key: p.persona_key, codex_key: persona.codex, companion_name: persona.defaultName,
      }).select('id').single();
      threadId = nt?.id ?? null;
    }
    if (!threadId) return res.status(500).json({ error: 'no thread' });
    if (p.status === 'offered') {
      await supabase.from('messages').insert({ thread_id: threadId, user_id: user.id, role: 'assistant', content: p.ping, persona_key: p.persona_key });
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
      await supabase.from('ping_log').update({ status: 'accepted', thread_id: threadId }).eq('id', p.id);
    }
    res.json({ threadId, personaKey: p.persona_key });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});
app.post('/dropin/:id/ignore', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('ping_log').update({ status: 'ignored' })
      .eq('id', req.params.id).eq('user_id', user.id).eq('kind', 'dropin');
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// dev: leave this morning's brief now
app.post('/dev/morning-brief', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    res.json(await runMorningBriefs(req.body?.userId ? { onlyUserId: req.body.userId } : undefined));
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// dev trigger: sweep due pings now
app.post('/dev/fire-pings', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    res.json(await firePings());
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// dev trigger for the evening programme (works even when the scheduler isn't armed)
app.post('/dev/evening-programme', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    res.json(await runEveningProgrammes(req.body?.userId ? { onlyUserId: req.body.userId } : undefined));
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// the house's day: latest status line per persona (public to any signed-in user)
app.get('/persona-states', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    res.json({ states: await currentStates() });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});
// what z remembers — read + forget (the trust contract, for real)
app.get('/memory', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('memory')
      .select('id, kind, key, value, created_at').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(100);
    res.json({ items: data ?? [] });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});
app.delete('/memory/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { error } = await supabase.from('memory').delete().eq('id', req.params.id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ forgotten: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// one persona's recent diary — the Updates tab's story feed
app.get('/persona-diary/:key', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const key = String(req.params.key || '').replace(/[^a-z_]/g, '').slice(0, 40);
    const { data } = await supabase.from('persona_states')
      .select('date, status_line, log_entry').eq('persona_key', key)
      .order('date', { ascending: false }).limit(10);
    // a SHORT life-story blurb for the profile ("their story"). Prefer the
    // hand-written third-person blurb keyed by the persona's CODEX; fall back to
    // slicing the codex opening (2nd person) only if none is authored. Full life
    // stays engine-private.
    let blurb: string | null = null;
    try {
      const codex = personaByKey(key)?.codex;
      if (codex && PROFILE_BLURBS[codex]) {
        blurb = PROFILE_BLURBS[codex];
      } else if (codex) {
        const raw = readContentFile(`codex-${codex.replace(/_/g, '-')}.md`);
        const i = raw.indexOf('## THE LIFE BEHIND THE VOICE');
        if (i > -1) {
          const after = raw.slice(i + '## THE LIFE BEHIND THE VOICE'.length);
          const para = after.split(/\n\s*\n/).map((s) => s.trim()).find((s) => s && !s.startsWith('**') && !s.startsWith('#'));
          if (para) blurb = para.replace(/\s+/g, ' ').trim().replace(/\*+/g, '').slice(0, 600);
        }
      }
    } catch (e) { /* blurb is best-effort */ }
    res.json({ key, blurb, entries: data ?? [] });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});
// dev: write today's states now
app.post('/dev/persona-states', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    res.json(await runStateWriter());
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// ── learning arcs (#19): list mine, start one ──
app.get('/arcs/mine', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    res.json({ arcs: await myArcs(user.id), catalog: Object.values(ARCS).map((a) => ({ id: a.id, title: a.title, personaKey: a.personaKey, days: a.days, finalTitle: a.finalTitle })) });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});
app.post('/arcs/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const out = await startArc(user.id, String(req.body?.arcId || ''));
    if ((out as any).error) return res.status(400).json(out);
    res.json(out);
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// notes left at the desk: this user's recent proactive pings (last 48h)
app.get('/pings/recent', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const since = new Date(Date.now() - 48 * 3600e3).toISOString();
    const { data } = await supabase.from('ping_log')
      .select('id, persona_key, ping, kind, status, created_at').eq('user_id', user.id).eq('sent', true)
      .neq('status', 'ignored')
      .gte('created_at', since).order('created_at', { ascending: false }).limit(4);
    res.json({ pings: data ?? [] });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// dev trigger: run follow-ups now (for me only, or all) — curl with x-dev-key
app.post('/dev/followups', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    const r = await runFollowups(req.body?.userId ? { onlyUserId: req.body.userId } : undefined);
    res.json(r);
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// ── THE GROWTH LEDGER (#17): every judged moment, one endpoint ──────────────
// Reads what already exists (roleplay_runs + arena_matches); computes a headline.
app.get('/ledger', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const [{ data: runs }, { data: matches }] = await Promise.all([
      supabase.from('roleplay_runs').select('scenario, outcome, notes, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(60),
      supabase.from('arena_matches').select('game, persona_key, you_score, z_score, winner, created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(60),
    ]);
    const feed = [
      ...(runs ?? []).map((r: any) => ({ kind: 'stage', title: r.scenario, outcome: r.outcome, notes: r.notes ?? null, at: r.created_at })),
      ...(matches ?? []).map((m: any) => ({ kind: 'arena', title: m.game, persona: m.persona_key, you: m.you_score, z: m.z_score, outcome: m.winner === 'you' ? 'win' : m.winner === 'z' ? 'loss' : 'draw', at: m.created_at })),
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 80);

    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
    const wkRuns = (runs ?? []).filter((r: any) => r.created_at >= weekAgo);
    const wkMatches = (matches ?? []).filter((m: any) => m.created_at >= weekAgo);
    const sceneWins = wkRuns.filter((r: any) => r.outcome === 'win').length;
    const matchWins = wkMatches.filter((m: any) => m.winner === 'you').length;
    const bestStreak = Math.max(0, ...wkMatches.filter((m: any) => m.game === 'trivia').map((m: any) => m.you_score || 0));
    const bits: string[] = [];
    if (sceneWins) bits.push(`${sceneWins} scene${sceneWins > 1 ? 's' : ''} won`);
    if (bestStreak >= 3) bits.push(`a ${bestStreak}-streak in trivia`);
    if (matchWins) bits.push(`${matchWins} match${matchWins > 1 ? 'es' : ''} taken`);
    const week = { scenes: wkRuns.length, sceneWins, matches: wkMatches.length, matchWins, bestStreak };
    const headline = bits.length ? `this week: ${bits.join(' \u00b7 ')}` : null;
    res.json({ headline, week, feed });
  } catch (e: any) { res.status(500).json({ error: 'ledger failed: ' + (e?.message || String(e)) }); }
});

// the player's win/loss record per game
// ── THE FRONT DESK: tasks (the concierge holds the user's list) ──────────────
// list open (and recently-done) tasks for the user
app.get('/tasks', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('tasks')
      .select('id, title, notes, due_at, status, suggested_persona, created_at, done_at')
      .eq('user_id', user.id)
      .order('status', { ascending: true })       // open first
      .order('due_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100);
    res.json({ tasks: data ?? [] });
  } catch (e: any) { res.status(500).json({ error: 'tasks list failed: ' + (e?.message || String(e)) }); }
});

// add a task
app.post('/tasks', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { title, notes, due_at, suggested_persona } = req.body ?? {};
    const t = typeof title === 'string' ? title.trim().slice(0, 300) : '';
    if (!t) return res.status(400).json({ error: 'a task needs a title' });
    const row: any = { user_id: user.id, title: t, status: 'open' };
    if (typeof notes === 'string' && notes.trim()) row.notes = notes.trim().slice(0, 1000);
    if (due_at) { const d = new Date(due_at); if (!isNaN(d.getTime())) row.due_at = d.toISOString(); }
    if (typeof suggested_persona === 'string') row.suggested_persona = suggested_persona.replace(/[^a-z_]/gi, '').slice(0, 40);
    const { data, error } = await supabase.from('tasks').insert(row).select('id').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ id: data.id });
  } catch (e: any) { res.status(500).json({ error: 'task add failed: ' + (e?.message || String(e)) }); }
});

// toggle done / update a task
app.patch('/tasks/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const id = String(req.params.id);
    const { status, title, due_at } = req.body ?? {};
    const patch: any = {};
    if (status === 'done') { patch.status = 'done'; patch.done_at = new Date().toISOString(); }
    else if (status === 'open') { patch.status = 'open'; patch.done_at = null; }
    if (typeof title === 'string' && title.trim()) patch.title = title.trim().slice(0, 300);
    if (due_at !== undefined) { const d = due_at ? new Date(due_at) : null; patch.due_at = (d && !isNaN(d.getTime())) ? d.toISOString() : null; }
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const { error } = await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'task update failed: ' + (e?.message || String(e)) }); }
});

// delete a task
app.delete('/tasks/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const id = String(req.params.id);
    const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'task delete failed: ' + (e?.message || String(e)) }); }
});

app.get('/arena/record', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('arena_matches')
      .select('game, winner').eq('user_id', user.id);
    const rec: Record<string, { wins: number; losses: number; draws: number }> = {};
    (data ?? []).forEach((m: any) => {
      rec[m.game] = rec[m.game] || { wins: 0, losses: 0, draws: 0 };
      if (m.winner === 'you') rec[m.game].wins++;
      else if (m.winner === 'z') rec[m.game].losses++;
      else rec[m.game].draws++;
    });
    res.json(rec);
  } catch (e: any) { res.status(500).json({ error: 'arena record failed: ' + (e?.message || String(e)) }); }
});

// capture / update the owner's identity (name + region) onto their durable user row.
// called at onboarding and whenever they edit name/region. This is owner binding:
// the AI and the overseer both speak/write knowing who the person actually is.
// the Letters tab: the anecdotes (daily) + letters (weekly) the overseer wrote.
// the user's own file — they read it, mark it read, and can delete any of it.
app.get('/letters', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data, error } = await supabase
      .from('user_summaries')
      .select('id, kind, body, period_start, period_end, created_at, read_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(120);
    if (error) return res.status(500).json({ error: 'letters: ' + error.message });
    res.json(data ?? []);
  } catch (e: any) {
    res.status(500).json({ error: 'letters failed: ' + (e?.message || String(e)) });
  }
});

// mark a letter read
app.post('/letters/:id/read', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('user_summaries').update({ read_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// delete a letter (their file, their call)
app.delete('/letters/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('user_summaries').delete()
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// ── AUDIO JOURNAL ──────────────────────────────────────────────────────────
// "just record." Raw audio in, Sarvam transcribes, we keep the text, discard audio.
// The transcript is overseer material under the same care rules as chat (no separate path).
// Accepts raw body (audio/*) with a small size cap; engine forwards to Sarvam.
import express2 from 'express';
app.post('/journal', express2.raw({ type: 'audio/*', limit: '12mb' }), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const audio = req.body as Buffer;
    if (!audio || !audio.length) return res.status(400).json({ error: 'no audio' });
    const mime = (req.headers['content-type'] as string) || 'audio/wav';
    const result = await transcribeAndStore(user.id, audio, 'journal.wav', mime);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'journal failed: ' + (e?.message || String(e)) });
  }
});

// transcribe a chat voice note via Sarvam — returns TEXT only, stores nothing.
// (the journal stores; chat voice notes just drop text into the composer.)
app.post('/transcribe', express2.raw({ type: 'audio/*', limit: '12mb' }), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    await resolveUser(authId);
    const audio = req.body as Buffer;
    if (!audio || !audio.length) return res.status(400).json({ error: 'no audio' });
    const mime = (req.headers['content-type'] as string) || 'audio/webm';
    const result = await transcribeAudio(audio, mime);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'transcribe failed: ' + (e?.message || String(e)) });
  }
});

// typed journal entry — store text directly, no transcription
app.post('/journal/text', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const text = (req.body?.text ?? '').toString();
    if (!text.trim()) return res.status(400).json({ error: 'no text' });
    const result = await storeJournalText(user.id, text);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'journal text failed: ' + (e?.message || String(e)) });
  }
});

// read the journal (their own entries)
app.get('/journal', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, transcript, lang, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) return res.status(500).json({ error: 'journal read: ' + error.message });
    res.json(data ?? []);
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// delete a journal entry (their file, their call)
app.delete('/journal/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('journal_entries').delete()
      .eq('id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

// ── CLEAR CHAT: wipe the messages in one of the user's threads (keeps the thread + persona).
app.post('/thread/clear', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { threadId } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: 'threadId required' });
    // only the owner may clear; verify ownership
    const { data: th } = await supabase.from('threads')
      .select('id, user_id').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!th || th.user_id !== user.id) return res.status(403).json({ error: 'not your chat' });
    // wipe messages + any per-thread summary/memory derived state for a clean slate
    await supabase.from('messages').delete().eq('thread_id', threadId);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'clear failed: ' + (e?.message || String(e)) }); }
});

// ── BANTER: a single short in-character line (for games like blackjack). No thread/history.
app.post('/banter', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { persona, prompt } = req.body ?? {};
    const p = personaByKey(persona);
    if (!p || !prompt) return res.status(400).json({ error: 'persona and prompt required' });
    const staticPrefix = buildStaticPrefix(p.defaultName, null, [p.codex as any], null);
    // The personas are facets of Z — they share the SAME memory of the user that Z has.
    // Load the shared memory block (exactly like the chat loop) so the game persona
    // knows this person, not a stranger.
    const memoryBlock = await readMemoryBlock(user.id);
    const system: any[] = [{ type: 'text', text: staticPrefix }];
    if (memoryBlock && memoryBlock.trim()) system.push({ type: 'text', text: memoryBlock });
    // mirror the WORKING chat call exactly: stream + finalMessage (non-streaming create
    // dies with "Premature close" on this host; the streaming read survives).
    const stream = anthropicShared.messages.stream({
      model: 'claude-haiku-4-5-20251001', max_tokens: 60,
      system,
      messages: [{ role: 'user', content: String(prompt).slice(0, 600) }],
    });
    // Drain the stream before awaiting the final message — this mirrors the WORKING
    // /chat path in loop.ts, which attaches `stream.on('text', ...)`. Line-by-line, the
    // only difference between working /chat and broken /banter was that /banter awaited
    // finalMessage() with NO stream consumer attached; an un-drained MessageStream is a
    // known trigger for "Premature close" on this host. Attaching a consumer keeps the
    // SSE socket flowing. (Verify on the deployed engine before trusting — see curl note.)
    stream.on('text', () => {});
    stream.on('error', () => {}); // don't let a stream 'error' event go unhandled
    const final = await stream.finalMessage();
    logUsage({ userId: user.id, personaKey: persona, surface: 'banter', fn: 'banter', model: 'claude-haiku-4-5-20251001', usage: (final as any).usage });
    const line = final.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    res.json({ line });
  } catch (e: any) { res.status(500).json({ error: 'banter failed: ' + (e?.message || String(e)) }); }
});

// ── DEV ECHO ── stateless persona probe for voice/codex testing via curl.
// Exercises the REAL persona → codex → buildStaticPrefix path + model, but with
// NO thread, NO DB writes, NO memory harvest. Gated by a server secret (DEV_KEY),
// never a user token. Inert (404) unless DEV_KEY is set in the environment.
//   curl .../dev/echo -H 'x-dev-key: $DEV_KEY' -H 'content-type: application/json' \
//        -d '{"persona":"the_screen_junkie","message":"recommend me something"}'
// Optional: "dob":"2011-01-01" injects the age line (probe the quiet-minor case),
//           "serious":true injects serious mode, "region":"Lucknow" for slang.
// probe the seatbelt: curl .../dev/seatbelt -H 'x-dev-key: $DEV_KEY' -H 'content-type: application/json' \\
//        -d '{"ping":"hey, how did the interview go?","persona":"the_mentor"}'
app.post('/dev/seatbelt', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    const { ping, persona } = req.body ?? {};
    if (!ping) return res.status(400).json({ error: 'need { ping }' });
    const out = await seatbeltCheck(String(ping), { personaKey: persona ?? null });
    res.json(out);
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.post('/dev/echo', async (req, res) => {
  try {
    const key = process.env.DEV_KEY;
    if (!key) return res.status(404).json({ error: 'not found' });
    if (req.headers['x-dev-key'] !== key) return res.status(401).json({ error: 'bad dev key' });
    const { persona, message, region, dob, serious } = req.body ?? {};
    const p = personaByKey(persona);
    if (!p || !message) return res.status(400).json({ error: 'need { persona, message }' });

    const staticPrefix = buildStaticPrefix(p.defaultName, null, [p.codex as any], region ?? null);

    // optional dynamic block — mirrors loop.ts so we can probe age-aware behaviour
    let dyn = '';
    if (dob) {
      const d = new Date(dob);
      if (!isNaN(d.getTime())) {
        const now = new Date(); let age = now.getFullYear() - d.getFullYear();
        const m = now.getMonth() - d.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
        if (age > 0 && age < 120) dyn += `\n\n[WHO YOU'RE TALKING TO: this person is ${age} years old. Meet them at their age; never read this aloud as a label.]`;
      }
    }
    if (serious) dyn += `\n\n[SERIOUS MODE IS ON. Set the bits and deflection aside; be warm, grounded, careful. If real danger shows, steer to real human help.]`;

    const system: any[] = [{ type: 'text', text: staticPrefix }];
    if (dyn) system.push({ type: 'text', text: dyn });
    const msg = await anthropicShared.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: String(message).slice(0, 2000) }],
    });
    const reply = msg.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
    res.json({ persona: p.key, codex: p.codex, model: 'claude-haiku-4-5-20251001', reply });
  } catch (e: any) { res.status(500).json({ error: 'dev echo failed: ' + (e?.message || String(e)) }); }
});

// ── PIN AUTH ──────────────────────────────────────────────────────────────
// hash a pin with a per-app secret salt (sha256). Not bcrypt, but server-side,
// rate-limited by Supabase, and a 4-digit pin's real protection is the phone+OTP gate.
import { createHash } from 'crypto';
function hashPin(pin: string, userId: string): string {
  const salt = process.env.PIN_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'z-pin';
  return createHash('sha256').update(`${salt}:${userId}:${pin}`).digest('hex');
}

// set (or change) the PIN — requires a valid auth token (just verified via OTP)
app.post('/auth/pin/set', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { pin } = req.body ?? {};
    if (!/^[0-9]{4}$/.test(String(pin || ''))) return res.status(400).json({ error: 'pin must be 4 digits' });
    const { error } = await supabase.from('users')
      .update({ pin_hash: hashPin(String(pin), user.id), pin_set_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'pin set failed: ' + (e?.message || String(e)) }); }
});

// verify a PIN for a known account (fast re-login). Takes userId + pin, returns a fresh session.
// NOTE: this re-issues a session WITHOUT OTP, so it's gated by knowing the userId (stored on the
// device after first login) + the correct PIN. Wrong-pin attempts are counted and lock out.
const pinAttempts: Record<string, { n: number; t: number }> = {};
app.post('/auth/pin/verify', async (req, res) => {
  try {
    const { userId, pin, refreshToken } = req.body ?? {};
    if (!userId || !/^[0-9]{4}$/.test(String(pin || ''))) return res.status(400).json({ error: 'userId and 4-digit pin required' });
    // simple lockout: 5 wrong attempts → 60s cooldown
    const a = pinAttempts[userId] || { n: 0, t: 0 };
    if (a.n >= 5 && Date.now() - a.t < 60000) return res.status(429).json({ error: 'too many tries — wait a minute or use OTP' });
    const { data: u } = await supabase.from('users').select('id, pin_hash, auth_user_id, display_name').eq('id', userId).is('deleted_at', null).maybeSingle();
    if (!u || !u.pin_hash) return res.status(404).json({ error: 'no pin set — sign in with OTP' });
    if (u.pin_hash !== hashPin(String(pin), u.id)) {
      pinAttempts[userId] = { n: a.n + 1, t: Date.now() };
      return res.status(401).json({ error: 'wrong pin' });
    }
    delete pinAttempts[userId];
    // PIN correct → mint a fresh session from the stored refresh token (kept on device)
    if (refreshToken) {
      const { data: rs } = await otpClient.auth.refreshSession({ refresh_token: refreshToken });
      if (rs?.session) {
        return res.json({ token: rs.session.access_token, refreshToken: rs.session.refresh_token, expiresIn: rs.session.expires_in, userId: u.id, hasName: !!u.display_name, hasPin: true });
      }
    }
    // no usable refresh token → PIN is correct but session can't be minted; ask for OTP
    return res.status(409).json({ error: 'session expired — sign in with OTP once', needOtp: true });
  } catch (e: any) { res.status(500).json({ error: 'pin verify failed: ' + (e?.message || String(e)) }); }
});

// fetch the stored identity (so the client can hydrate name/region after a cache loss)
app.get('/me', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('users')
      .select('display_name, handle, region, dob, sex, serious_mode, avatar_url')
      .eq('id', user.id).maybeSingle();
    res.json({
      displayName: data?.display_name ?? null,
      handle: (data as any)?.handle ?? null,
      region: data?.region ?? null,
      dob: (data as any)?.dob ?? null,
      sex: (data as any)?.sex ?? null,
      avatarUrl: (data as any)?.avatar_url ?? null,
      seriousMode: !!(data as any)?.serious_mode,
    });
  } catch (e: any) {
    res.status(500).json({ error: 'me fetch failed: ' + (e?.message || String(e)) });
  }
});

app.post('/me', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { displayName, region } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof displayName === 'string' && displayName.trim()) patch.display_name = displayName.trim().slice(0, 80);
    if (typeof req.body?.seriousMode === 'boolean') patch.serious_mode = req.body.seriousMode;
    if (typeof region === 'string') patch.region = region.trim().slice(0, 120) || null;
    if (typeof req.body?.dob === 'string') patch.dob = req.body.dob.trim() || null;   // 'YYYY-MM-DD'
    if (typeof req.body?.sex === 'string' && ['female','male','na'].includes(req.body.sex)) patch.sex = req.body.sex;
    // user profile photo — a data-URI (same pattern as thread avatars). Capped so a
    // huge base64 can't bloat the row; the client downsizes before sending.
    if (typeof req.body?.avatarUrl === 'string') {
      const a = req.body.avatarUrl.trim();
      patch.avatar_url = a ? a.slice(0, 700000) : null;   // ~500KB image ceiling
    }
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('users').update(patch).eq('id', user.id);
      if (error) return res.status(500).json({ error: 'me update: ' + error.message });
    }
    res.json({ id: user.id, displayName: patch.display_name ?? user.display_name, region: patch.region ?? user.region });
  } catch (e: any) {
    res.status(500).json({ error: 'me failed: ' + (e?.message || String(e)) });
  }
});

// ── DATA EXPORT (right to portability). Gathers everything we hold about the
// user into one JSON blob the client can save/share. Read-only. ──
app.post('/me/export', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const uid = user.id;
    const grab = async (table: string, col = 'user_id') => {
      try { const { data } = await supabase.from(table).select('*').eq(col, uid); return data ?? []; }
      catch { return []; }
    };
    const [profile] = await Promise.all([
      supabase.from('users').select('display_name, handle, region, dob, sex, avatar_url, created_at').eq('id', uid).maybeSingle().then((r) => r.data),
    ]);
    const [threads, messages, memory, journal, tasks, matches, roleplay, notes, summaries, customPersonas, friendships] = await Promise.all([
      grab('threads'), grab('messages'), grab('memory'), grab('journal_entries'), grab('tasks'),
      grab('arena_matches'), grab('roleplay_runs'), grab('user_notes'), grab('user_summaries'),
      grab('custom_personas'), grab('friendships', 'a'),
    ]);
    res.json({
      exported_at: new Date().toISOString(),
      account: profile,
      threads, messages, memory, journal, tasks,
      games: { arena_matches: matches, roleplay_runs: roleplay },
      notes, summaries, custom_personas: customPersonas, friendships,
      note: 'This is all the data callmeZ holds about you. Contact help@callmez.app with questions.',
    });
  } catch (e: any) {
    res.status(500).json({ error: 'export failed: ' + (e?.message || String(e)) });
  }
});

// ── ACCOUNT DELETION (soft-delete). Marks the account deleted NOW — it becomes
// inaccessible immediately (every query gates on deleted_at is null) — and a
// purge job removes it permanently after 30 days. Recoverable in that window via
// help@callmez.app. Requires an explicit confirm flag so it can't fire by accident. ──
app.post('/me/delete', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const { confirm } = req.body ?? {};
    if (confirm !== 'DELETE') return res.status(400).json({ error: 'confirmation required' });
    const user = await resolveUser(authId);
    const now = new Date().toISOString();
    const { error } = await supabase.from('users').update({ deleted_at: now }).eq('id', user.id);
    if (error) return res.status(500).json({ error: 'delete failed: ' + error.message });
    // also mark their threads deleted so nothing lingers visibly
    await supabase.from('threads').update({ deleted_at: now }).eq('user_id', user.id);
    res.json({ ok: true, deleted_at: now, purge_after_days: 30 });
  } catch (e: any) {
    res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) });
  }
});

// ── NOTIFICATIONS: store the device's push token + the user's on/off prefs.
// Called on app open (token) and from the settings toggles (prefs). Sending the
// actual pushes rides the scheduled_pings clock + the seatbelt — not here. ──
app.post('/me/push', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { pushToken, prefs } = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (typeof pushToken === 'string' && pushToken.trim()) patch.push_token = pushToken.trim().slice(0, 300);
    if (prefs && typeof prefs === 'object') patch.notif_prefs = prefs;
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('users').update(patch).eq('id', user.id);
      if (error) return res.status(500).json({ error: 'push update: ' + error.message });
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'push failed: ' + (e?.message || String(e)) });
  }
});

// ── THE BATTLEFIELD: adjudicator diagnostics (temp — for pressure-testing the judge) ──
app.get('/battlefield/ready', (_req, res) => {
  res.json(adjudicatorReady());
});
app.get('/grandmaster/ready', (_req, res) => {
  res.json(gmReady());
});
app.post('/battlefield/test-verdict', async (req, res) => {
  try {
    const { domain, motion, transcript } = req.body ?? {};
    if (!domain || !DOMAIN_LABELS[domain as DebateDomain]) return res.status(400).json({ error: 'bad or missing domain', domains: Object.keys(DOMAIN_LABELS) });
    if (!motion || !Array.isArray(transcript) || !transcript.length) return res.status(400).json({ error: 'motion + transcript[] required' });
    const v = await bfVerdict({ domain: domain as DebateDomain, motion: String(motion), fullTranscript: transcript });
    res.json(v);
  } catch (e: any) {
    res.status(500).json({ error: 'verdict failed: ' + (e?.message || String(e)) });
  }
});

// SPECTATOR watch: a read-only view of a battlefield duel, no seat required.
// This is the ungated audience path — a spectator polls the committed transcript +
// verdict here, and subscribes to the duel channel for the debater's live keystrokes.
// Returns nothing sensitive (a debate is public by nature); only battlefield_duel.
app.get('/battlefield/watch/:sessionId', async (req, res) => {
  try {
    const { data: s } = await supabase.from('game_sessions').select('id, game, version, status, state, thread_id, seats').eq('id', req.params.sessionId).maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such duel' });
    if (s.game !== 'battlefield_duel') return res.status(400).json({ error: 'not a battlefield duel' });
    const st = s.state || {};
    // expose the floor (motion, phase, transcript, notes, verdict) — never seat identities
    res.json({
      id: s.id, version: s.version, status: s.status, threadId: s.thread_id,
      motion: st.motion, domain: st.domain, phase: st.phase,
      turns: st.turns || [], notes: st.notes || [],
      verdict: st.verdict || null, winner: st.winner || null, error: st.error || null,
    });
  } catch (e: any) { res.status(500).json({ error: 'watch failed: ' + (e?.message || String(e)) }); }
});


// seat 1 = the house) that the existing /games/session/:id GET + /move routes serve. The
// house takes its turns inside battlefieldDuel.move(). Optional {motion,domain} to pin.
app.post('/battlefield/practice/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const motion = typeof req.body?.motion === 'string' ? req.body.motion : undefined;
    const domain = req.body?.domain && DOMAIN_LABELS[req.body.domain as DebateDomain] ? req.body.domain as DebateDomain : undefined;
    // a private solo thread to host the practice session (not shared, not a room)
    const { data: thread, error: tErr } = await supabase.from('threads').insert({
      user_id: user.id, is_group: false, is_shared: false, member_keys: [], companion_name: 'the Battlefield · practice',
    }).select('id').single();
    if (tErr || !thread) return res.status(500).json({ error: 'could not open the practice floor: ' + (tErr?.message || '') });
    const seats = [{ kind: 'user', id: user.id }, { kind: 'persona', id: 'the_house' }];
    const state = battlefieldDuelAdapter.create(seats, { motion, domain });
    const { data: sess, error } = await supabase.from('game_sessions').insert({
      thread_id: thread.id, game: 'battlefield_duel', state, seats, created_by: user.id,
    }).select('id, version').single();
    if (error || !sess) return res.status(500).json({ error: error?.message || 'session insert failed' });
    res.json({ sessionId: sess.id, version: sess.version });
  } catch (e: any) { res.status(500).json({ error: 'practice start failed: ' + (e?.message || String(e)) }); }
});

// DIAGNOSTIC: run a full practice-vs-house duel loop end-to-end, no auth/room/DB.
// You are PRO (seat 0), the house is CON (seat 1). Provide your three speeches in
// {openings,rebuttals,closings}-style via `mySpeeches` (array of 3 strings: Opening,
// Rebuttal, Closing). The house generates its three turns; the proven adjudicator rules.
// Proves: state machine + phase advance + turn-lock + house generation + real verdict.
// group-memory test: harvest a room's collective memory on demand + return it (founder-gated)
app.post('/diagnostics/room-memory/:threadId', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });
    const threadId = String(req.params.threadId || '');
    const harvested = await harvestRoomMemory(threadId);
    const block = await readRoomMemoryBlock(threadId);
    res.json({ harvested, block });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.get('/diagnostics/room-memory/:threadId', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });
    const block = await readRoomMemoryBlock(String(req.params.threadId || ''));
    res.json({ block });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.get('/diagnostics/costs', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });
    const days = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? '7'), 10) || 7));
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase.from('usage_log')
      .select('fn, surface, persona_key, user_id, cost_inr, created_at')
      .gte('created_at', since).limit(100000);
    if (error) return res.status(500).json({ error: error.message });
    const rows: any[] = data || [];
    const byFn: Record<string, { inr: number; calls: number }> = {};
    const byPersona: Record<string, { inr: number; calls: number }> = {};
    const byDay: Record<string, number> = {};
    const users = new Set<string>();
    let total = 0;
    for (const r of rows) {
      const inr = Number(r.cost_inr) || 0; total += inr; if (r.user_id) users.add(r.user_id);
      const fk = r.fn || r.surface || 'other';
      (byFn[fk] ||= { inr: 0, calls: 0 }); byFn[fk].inr += inr; byFn[fk].calls += 1;
      const pk = r.persona_key || '\u2014';
      (byPersona[pk] ||= { inr: 0, calls: 0 }); byPersona[pk].inr += inr; byPersona[pk].calls += 1;
      const day = String(r.created_at).slice(0, 10); byDay[day] = (byDay[day] || 0) + inr;
    }
    const r4 = (n: number) => Math.round(n * 10000) / 10000;
    for (const k in byFn) byFn[k].inr = r4(byFn[k].inr);
    for (const k in byPersona) byPersona[k].inr = r4(byPersona[k].inr);
    for (const k in byDay) byDay[k] = r4(byDay[k]);
    const active = users.size;
    res.json({ days, rows: rows.length, total_inr: r4(total), active_users: active,
      cost_per_active_user_inr: active ? r4(total / active) : 0, byFn, byPersona, byDay });
  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }
});

app.post('/battlefield/test-duel', async (req, res) => {
  try {
    const mySpeeches: string[] = Array.isArray(req.body?.mySpeeches) ? req.body.mySpeeches : [];
    if (mySpeeches.length !== 3) return res.status(400).json({ error: 'mySpeeches must be exactly 3 strings: [Opening, Rebuttal, Closing]' });
    // optional: pin the motion+domain so your speeches match the topic (a fair fight)
    const pinMotion = typeof req.body?.motion === 'string' ? req.body.motion : undefined;
    const pinDomain = req.body?.domain && DOMAIN_LABELS[req.body.domain as DebateDomain] ? req.body.domain as DebateDomain : undefined;
    // seats: seat 0 = you (user), seat 1 = the house (persona)
    const seats = [{ kind: 'user', id: 'tester' }, { kind: 'persona', key: 'the_house' }];
    let state: any = (pinMotion && pinDomain)
      ? battlefieldDuelAdapter.create({ motion: pinMotion, domain: pinDomain })
      : battlefieldDuelAdapter.create();
    const steps: any[] = [];
    const costStart = costSnapshot();
    let myIdx = 0; let guard = 0;
    while (!battlefieldDuelAdapter.isOver(state) && guard++ < 12) {
      const toAct = battlefieldDuelAdapter.toActSeat(state);
      if (toAct !== 0) { // shouldn't happen — move() drives the house internally — but guard anyway
        steps.push({ note: 'floor waiting on house but not advanced', toAct }); break;
      }
      const speech = mySpeeches[myIdx++] ?? 'I rest on the case already made.';
      state = await battlefieldDuelAdapter.move(state, 0, { type: 'speech', text: speech }, seats);
      steps.push({ afterMyTurn: myIdx, phase: state.phase, turns: state.turns.length, toAct: battlefieldDuelAdapter.toActSeat(state) });
      if (myIdx >= 3 && battlefieldDuelAdapter.toActSeat(state) === 0 && state.phase !== 'verdict') {
        // safety: if it's still my turn after 3 speeches, something stalled
        steps.push({ note: 'stalled: still my turn after 3 speeches' }); break;
      }
    }
    res.json({
      motion: state.motion, domain: state.domain, phase: state.phase,
      turns: state.turns, notes: state.notes,
      winner: state.winner, error: state.error,
      verdict: state.verdict ? { winner: state.verdict.winner, summary: state.verdict.summary, matter: state.verdict.matter, manner: state.verdict.manner } : null,
      steps,
      cost: costSince(costStart),
    });
  } catch (e: any) {
    res.status(500).json({ error: 'test-duel failed: ' + (e?.message || String(e)) });
  }
});

app.get('/me/push', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('users').select('notif_prefs').eq('id', user.id).maybeSingle();
    res.json({ prefs: (data as any)?.notif_prefs ?? {} });
  } catch (e: any) {
    res.status(500).json({ error: 'push read failed: ' + (e?.message || String(e)) });
  }
});

// list roster
app.get('/threads', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('threads')
      .select('id, persona_key, companion_name, avatar_url, accent, last_active')
      .eq('user_id', user.id).is('deleted_at', null)
      .order('last_active', { ascending: false });
    const threads = data ?? [];
    // unread = messages newer than this user's last_read_at for the thread. One read
    // row per (user, thread); no row = never opened = everything counts as unread.
    const ids = threads.map((t: any) => t.id);
    const reads: Record<string, string> = {};
    const prefs: Record<string, any> = {};
    if (ids.length) {
      const { data: rr } = await supabase.from('thread_reads')
        .select('thread_id, last_read_at, pinned, favourite, archived')
        .eq('user_id', user.id).in('thread_id', ids);
      for (const r of (rr ?? []) as any[]) {
        reads[r.thread_id] = r.last_read_at;
        prefs[r.thread_id] = { pinned: !!r.pinned, favourite: !!r.favourite, archived: !!r.archived };
      }
    }
    const withUnread = await Promise.all(threads.map(async (t: any) => {
      const since = reads[t.id];
      let q = supabase.from('messages').select('id', { count: 'exact', head: true })
        .eq('thread_id', t.id).eq('role', 'assistant');   // only the house's messages count as unread
      if (since) q = q.gt('created_at', since);
      const [{ count }, { data: lastMsg }] = await Promise.all([
        q,
        supabase.from('messages').select('content, role').eq('thread_id', t.id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      // WhatsApp-style single-line preview: last message, whitespace collapsed,
      // "you:" prefix when it was the user's.
      let last_message: string | null = null;
      if (lastMsg?.content) {
        const flat = String((lastMsg as any).content).replace(/\s+/g, ' ').trim().slice(0, 90);
        last_message = (lastMsg as any).role === 'user' ? `you: ${flat}` : flat;
      }
      const p = prefs[t.id] || { pinned: false, favourite: false, archived: false };
      return { ...t, unread: count || 0, last_message, ...p };
    }));
    res.json(withUnread);
  } catch (e: any) {
    res.status(500).json({ error: 'roster failed: ' + (e?.message || String(e)) });
  }
});

// mark a thread read up to now — clears its unread badge
app.post('/threads/:id/read', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const threadId = String(req.params.id || '');
    if (!threadId) return res.status(400).json({ error: 'no thread' });
    await supabase.from('thread_reads')
      .upsert({ user_id: user.id, thread_id: threadId, last_read_at: new Date().toISOString() },
              { onConflict: 'user_id,thread_id' });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'read failed: ' + (e?.message || String(e)) }); }
});

// ── FAVOURITES: pinned personas ─────────────────────────────────────────────
// A favourite lives on the USER as a list of persona keys (not on a thread row),
// so you can star a persona you've never opened, and the pinned shelf survives
// because it's read from the DB — never seeded in app state.
app.get('/pins', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('users').select('pinned_keys').eq('id', user.id).maybeSingle();
    res.json({ pins: ((data as any)?.pinned_keys ?? []).filter(Boolean) });
  } catch (e: any) {
    res.status(500).json({ error: 'pins fetch failed: ' + (e?.message || String(e)) });
  }
});

// toggle (or explicitly set) a favourite. body: { key, pinned? }. pinned true/false
// sets it; omitted flips it. Newest pin goes to the front. Idempotent by design —
// a double-fire of the same set is harmless.
app.post('/pins', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { key, pinned } = req.body ?? {};
    if (typeof key !== 'string' || !key) return res.status(400).json({ error: 'missing persona key' });
    const { data } = await supabase.from('users').select('pinned_keys').eq('id', user.id).maybeSingle();
    const cur: string[] = ((data as any)?.pinned_keys ?? []).filter(Boolean);
    let next: string[];
    if (pinned === false) next = cur.filter((k) => k !== key);
    else if (pinned === true) next = cur.includes(key) ? cur : [key, ...cur];
    else next = cur.includes(key) ? cur.filter((k) => k !== key) : [key, ...cur];
    const { error } = await supabase.from('users').update({ pinned_keys: next }).eq('id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pins: next });
  } catch (e: any) {
    res.status(500).json({ error: 'pin toggle failed: ' + (e?.message || String(e)) });
  }
});

// ── SUGGESTED ROOMS: daily, web-informed topics + the best-fitting personas ──
// Generated once per day (Haiku + web_search), cached in z.room_suggestions, then
// served instantly. The client's refresh button rerolls from this cached pool —
// no live web call per tap, so refresh is fast and free.
const SHAREABLE_ROSTER: [string, string][] = [
  ['the_guru', 'deep knowledge, learning, the big questions'],
  ['the_oracle', 'quick facts, the "google friend", trivia'],
  ['the_brainiac', 'debate, devil\'s advocate, sharpening ideas'],
  ['the_brother', 'family, loyalty, real talk'],
  ['the_healer', 'heartbreak, love, emotional wounds'],
  ['the_comic', 'humour, jokes, dark wit, levity'],
  ['the_mentor', 'drive, discipline, pushing you (the motivator)'],
  ['the_colleague', 'work, office politics, careers'],
  ['the_philosopher', 'meaning, ethics, existence'],
  ['the_historian', 'history, how we got here'],
  ['the_cosmologist', 'space, science, zoom-out perspective'],
  ['the_moderator', 'keeps debates civil'],
  ['the_media_manager', 'branding, social, image'],
  ['the_teacher', 'explaining hard things simply (the professor)'],
  ['the_economist', 'money, markets, investing, cost of living (the money man)'],
  ['the_wannabe', 'hype, betting, get-rich energy (the wannabe hustler)'],
  ['the_screen_junkie', 'movies, shows, what to watch'],
  ['the_orator', 'speech, persuasion, rhetoric'],
  ['the_hippie', 'calm, nature, anti-rat-race'],
  ['the_diva', 'style, taste, fashion'],
  ['the_cousin', 'shy, relatable, everyday (the awkward cousin)'],
  ['the_conspiracy_theorist', 'conspiracies, cover-ups, aliens, "it\'s all connected" (for fun)'],
];

app.get('/rooms/suggestions', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const today = new Date().toISOString().slice(0, 10);
    // serve today's cache if we already built it
    const { data: cached } = await supabase.from('room_suggestions')
      .select('items').eq('day', today).maybeSingle();
    if (cached && Array.isArray((cached as any).items) && (cached as any).items.length) {
      return res.json({ items: (cached as any).items });
    }
    // build a fresh daily set: web-informed topics + best-fitting personas
    const roster = SHAREABLE_ROSTER.map(([k, d]) => `${k} = ${d}`).join('\n');
    const prompt =
      `It's ${new Date().toDateString()}. Suggest 8 lively "rooms" to gather friends around — ` +
      `each a conversation topic several people would jump into. Mix a few TIMELY ones ` +
      `(use web_search for what's genuinely current: sports, releases, news, cultural moments) ` +
      `with a few evergreen fun ones. For each room, pick the 3 BEST-FITTING personas from this ` +
      `roster (use the exact keys on the left):\n${roster}\n\n` +
      `Return ONLY a JSON array — no prose, no markdown fences. Each item: ` +
      `{"topic":"short room title, max 6 words","why":"one short line on why it's fun right now",` +
      `"personas":["key","key","key"]}.`;
    const msg = await anthropicShared.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as any],
      messages: [{ role: 'user', content: prompt }],
    });
    const text = ((msg.content || []) as any[])
      .filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    let items: any[] = [];
    try {
      const a = text.indexOf('['), b = text.lastIndexOf(']');
      if (a >= 0 && b > a) items = JSON.parse(text.slice(a, b + 1));
    } catch { items = []; }
    // validate: only shareable personas, exactly 3 per room
    items = (Array.isArray(items) ? items : [])
      .map((it: any) => ({
        topic: String(it?.topic || '').slice(0, 60),
        why: String(it?.why || '').slice(0, 140),
        personas: [...new Set((Array.isArray(it?.personas) ? it.personas : [])
          .filter((k: any) => SHAREABLE_PERSONAS.has(k)))].slice(0, 3),
      }))
      .filter((it: any) => it.topic && it.personas.length === 3);
    if (!items.length) return res.json({ items: [] }); // don't cache a dud — retry next call
    await supabase.from('room_suggestions')
      .upsert({ day: today, items, made_at: new Date().toISOString() });
    res.json({ items });
  } catch (e: any) {
    res.status(500).json({ error: 'suggestions failed: ' + (e?.message || String(e)) });
  }
});

// one turn — SSE stream
// ── AUTH: phone OTP (Supabase phone auth, Twilio Verify as SMS provider) ──────
// send a one-time code to the phone number.
app.post('/auth/otp', async (req, res) => {
  try {
    const { phone } = req.body ?? {};
    if (!phone || !/^\+[1-9][0-9]{6,15}$/.test(phone)) return res.status(400).json({ error: 'enter a valid number with country code' });
    const { error } = await otpClient.auth.signInWithOtp({ phone });
    if (error) return res.status(400).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'otp failed: ' + (e?.message || String(e)) }); }
});

// refresh: exchange a refresh token for a fresh access token (silent re-auth)
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: 'no refresh token' });
    const { data, error } = await otpClient.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data?.session) return res.status(401).json({ error: 'session expired' });
    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
    });
  } catch (e: any) { res.status(500).json({ error: 'refresh failed: ' + (e?.message || String(e)) }); }
});

// verify the code → returns a Supabase session token. Optionally claims an anon user's
// existing threads/letters/journal onto the now-verified identity (so nobody loses history).
app.post('/auth/verify', async (req, res) => {
  try {
    const { phone, code, claimAnon } = req.body ?? {};
    if (!phone || !code) return res.status(400).json({ error: 'phone and code required' });
    const { data, error } = await otpClient.auth.verifyOtp({ phone, token: String(code), type: 'sms' });
    if (error || !data?.session || !data?.user) return res.status(400).json({ error: error?.message || 'invalid code' });

    const authId = data.user.id;
    // ensure a z.users row exists for this verified identity
    const realUser = await resolveUser(authId);

    // claim anon history: if the browser had an anon id with data, move it to this user.
    if (claimAnon && /^[a-zA-Z0-9_-]{8,64}$/.test(claimAnon)) {
      const anonAuthId = `open:${claimAnon}`;
      const { data: anonRow } = await supabase.from('users').select('id').eq('auth_user_id', anonAuthId).is('deleted_at', null).maybeSingle();
      if (anonRow && anonRow.id !== realUser.id) {
        // repoint all the anon user's content to the real user, then soft-delete the anon row
        await supabase.from('threads').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('messages').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('user_summaries').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('user_notes').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('journal_entries').update({ user_id: realUser.id }).eq('user_id', anonRow.id);
        await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', anonRow.id);
      }
    }

    res.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      userId: realUser.id,
      hasName: !!realUser.display_name,
      hasPin: !!(realUser as any).pin_hash,
    });
  } catch (e: any) { res.status(500).json({ error: 'verify failed: ' + (e?.message || String(e)) }); }
});

// ── WHAT Z REMEMBERS — the user's own view of their notes (read-only) + delete ──
// returns the durable facts (z.memory) and the overseer's anecdotes (z.user_notes).
// the user can read these and delete any of them — never edit (the record stays honest).
app.get('/notes', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const [facts, notes] = await Promise.all([
      supabase.from('memory').select('id, key, value, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
      supabase.from('user_notes').select('id, body, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(200),
    ]);
    res.json({ facts: facts.data ?? [], notes: notes.data ?? [] });
  } catch (e: any) { res.status(500).json({ error: 'notes failed: ' + (e?.message || String(e)) }); }
});

// delete one remembered item — a fact or an overseer note. kind: 'fact' | 'note'.
app.delete('/notes/:kind/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { kind, id } = req.params;
    const table = kind === 'fact' ? 'memory' : kind === 'note' ? 'user_notes' : null;
    if (!table) return res.status(400).json({ error: 'bad kind' });
    const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) }); }
});

// delete a thread / group (soft-delete, user-scoped)
app.delete('/threads/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { error } = await supabase.from('threads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', req.params.id).eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) }); }
});

// rename a thread (and/or set its avatar) — so the persona actually knows its current name.
app.patch('/threads/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, avatar_url } = req.body ?? {};
    const patch: any = {};
    if (typeof name === 'string' && name.trim()) patch.companion_name = name.trim();
    if (typeof avatar_url === 'string') patch.avatar_url = avatar_url;
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'nothing to update' });
    const { data, error } = await supabase.from('threads')
      .update(patch).eq('id', req.params.id).eq('user_id', user.id).is('deleted_at', null)
      .select('id, companion_name, avatar_url').maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'thread not found' });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: 'rename failed: ' + (e?.message || String(e)) }); }
});

// a thread's saved conversation — so reopening shows the real history (persistent memory, visible)
app.get('/threads/:id/messages', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const threadId = req.params.id;
    // load the thread; for shared rooms, ANY member may read (not just owner)
    const { data: thread } = await supabase
      .from('threads').select('id, is_group, is_shared, user_id').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'thread not found' });
    const isOwner = thread.user_id === user.id;
    if (!isOwner) {
      // not the owner — allowed only if they're a member of this (shared) thread
      if (!thread.is_shared || !(await isRoomMember(threadId, user.id))) {
        return res.status(404).json({ error: 'thread not found' });
      }
    }
    // shared room: return EVERYONE's messages (the whole room). solo thread: just this user's.
    let q = supabase.from('messages')
      .select('role, content, persona_key, created_at, sender_user_id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(200);
    if (!thread.is_shared) q = q.eq('user_id', user.id);
    const { data: msgs } = await q;
    // resolve a roster of member names (id -> display_name) for shared rooms
    let roster: Record<string,string> = {};
    if (thread.is_shared) {
      const { data: mem } = await supabase.from('room_members').select('user_id').eq('thread_id', threadId);
      const ids = (mem ?? []).map((m: any) => m.user_id);
      if (ids.length) {
        const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
        (us ?? []).forEach((u: any) => { roster[u.id] = u.display_name || 'someone'; });
      }
    }
    // attach sender_name to each message
    const out = (msgs ?? []).map((m: any) => ({ ...m, sender_name: m.sender_user_id ? (roster[m.sender_user_id] || 'someone') : null }));
    res.json({ messages: out, is_group: !!thread.is_group, is_shared: !!thread.is_shared, roster, you: user.id });
  } catch (e: any) { res.status(500).json({ error: 'history failed: ' + (e?.message || String(e)) }); }
});

// create a group chat thread with chosen member personas
// is this user a member of this thread/room? (the gate for shared rooms)
async function isRoomMember(threadId: string, userId: string): Promise<boolean> {
  const { data } = await supabase.from('room_members')
    .select('user_id').eq('thread_id', threadId).eq('user_id', userId).maybeSingle();
  return !!data;
}

// create a shared room: one persona, owner auto-joined as a member
app.post('/rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, persona, personas } = req.body ?? {};
    // accept a single persona (back-compat) OR an array of up to 5
    let keys: string[] = Array.isArray(personas) ? personas : (persona ? [persona] : []);
    keys = [...new Set(keys.filter((k: any) => typeof k === 'string' && SHAREABLE_PERSONAS.has(k)))].slice(0, 5);
    if (!keys.length) {
      return res.status(400).json({ error: 'pick at least one persona that can be invited into a shared room' });
    }
    const { data: thread, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, is_shared: true, member_keys: keys,
      companion_name: (name && String(name).trim()) || 'the room',
    }).select('id, companion_name, member_keys').single();
    if (error) return res.status(500).json({ error: 'room create: ' + error.message });
    await supabase.from('room_members').insert({ thread_id: thread.id, user_id: user.id, role: 'owner' });
    res.json({ id: thread.id, name: thread.companion_name, personas: keys, persona: keys[0] });
  } catch (e: any) { res.status(500).json({ error: 'room failed: ' + (e?.message || String(e)) }); }
});

// owner mints (or returns) the room's invite link
app.post('/rooms/:id/invite', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!(await isRoomMember(req.params.id, user.id))) return res.status(403).json({ error: 'not a member' });
    // reuse an existing live invite if present
    const { data: existing } = await supabase.from('room_invites')
      .select('token').eq('thread_id', req.params.id).eq('revoked', false).limit(1).maybeSingle();
    let token = existing?.token;
    if (!token) {
      token = (await import('crypto')).randomBytes(9).toString('base64url');
      const { error } = await supabase.from('room_invites').insert({
        token, thread_id: req.params.id, created_by: user.id,
      });
      if (error) return res.status(500).json({ error: error.message });
    }
    res.json({ token });
  } catch (e: any) { res.status(500).json({ error: 'invite failed: ' + (e?.message || String(e)) }); }
});

// PUBLIC: preview a room from an invite token (no join yet) — for the join screen
app.get('/join/:token', async (req, res) => {
  try {
    const { data: inv } = await supabase.from('room_invites')
      .select('thread_id, revoked, expires_at, max_uses, uses').eq('token', req.params.token).maybeSingle();
    if (!inv || inv.revoked) return res.status(404).json({ error: 'this invite is no longer active' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this invite expired' });
    if (inv.max_uses != null && inv.uses >= inv.max_uses) return res.status(410).json({ error: 'this invite is used up' });
    const { data: thread } = await supabase.from('threads')
      .select('companion_name, member_keys').eq('id', inv.thread_id).is('deleted_at', null).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'room not found' });
    res.json({ name: thread.companion_name, persona: (thread.member_keys || [])[0] || null });
  } catch (e: any) { res.status(500).json({ error: 'preview failed: ' + (e?.message || String(e)) }); }
});

// authed join: add the verified user to the room
app.post('/join/:token', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'sign in first' });
    const user = await resolveUser(authId);
    const { data: inv } = await supabase.from('room_invites')
      .select('thread_id, revoked, expires_at, max_uses, uses').eq('token', req.params.token).maybeSingle();
    if (!inv || inv.revoked) return res.status(404).json({ error: 'this invite is no longer active' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'this invite expired' });
    if (inv.max_uses != null && inv.uses >= inv.max_uses) return res.status(410).json({ error: 'this invite is used up' });
    // add membership (idempotent) + bump uses
    await supabase.from('room_members').insert({ thread_id: inv.thread_id, user_id: user.id, role: 'member' })
      .select().maybeSingle();
    await supabase.from('room_invites').update({ uses: (inv.uses || 0) + 1 }).eq('token', req.params.token);
    res.json({ threadId: inv.thread_id });
  } catch (e: any) { res.status(500).json({ error: 'join failed: ' + (e?.message || String(e)) }); }
});

// rooms the user is a member of (server is source of truth)
app.get('/rooms/:id/members', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (!(await isRoomMember(req.params.id, user.id))) return res.status(403).json({ error: 'not a member' });
    const { data: mems } = await supabase.from('room_members').select('user_id').eq('thread_id', req.params.id);
    const ids = (mems ?? []).map((m: any) => m.user_id);
    const map: Record<string,string> = {};
    const avatars: Record<string,string|null> = {};
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name, avatar_url').in('id', ids);
      (us ?? []).forEach((u: any) => { map[u.id] = u.display_name || 'someone'; avatars[u.id] = u.avatar_url || null; });
    }
    res.json({ members: map, avatars, meId: user.id });
  } catch (e: any) { res.status(500).json({ error: 'members failed: ' + (e?.message || String(e)) }); }
});

// pin / favourite / archive a thread — per user, never touches last_read_at.
// Body: { threadId, pinned?, favourite?, archived? } — only sent keys change.
app.post('/thread/prefs', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { threadId } = req.body ?? {};
    if (!threadId) return res.status(400).json({ error: 'threadId required' });
    const patch: any = { user_id: user.id, thread_id: threadId };
    for (const k of ['pinned', 'favourite', 'archived'] as const) {
      if (typeof (req.body ?? {})[k] === 'boolean') patch[k] = (req.body as any)[k];
    }
    if (Object.keys(patch).length === 2) return res.status(400).json({ error: 'nothing to set' });
    const { error } = await supabase.from('thread_reads')
      .upsert(patch, { onConflict: 'user_id,thread_id' });
    if (error) return res.status(500).json({ error: 'prefs save: ' + error.message });
    res.json({ ok: true, ...patch });
  } catch (e: any) { res.status(500).json({ error: 'prefs failed: ' + (e?.message || String(e)) }); }
});

app.get('/rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: mem } = await supabase.from('room_members').select('thread_id').eq('user_id', user.id);
    const ids = (mem ?? []).map((m: any) => m.thread_id);
    if (!ids.length) return res.json([]);
    const { data: threads } = await supabase.from('threads')
      .select('id, companion_name, member_keys, last_active, user_id')
      .in('id', ids).eq('is_shared', true).is('deleted_at', null)
      .order('last_active', { ascending: false });
    const prefs: Record<string, any> = {};
    {
      const { data: rr } = await supabase.from('thread_reads')
        .select('thread_id, pinned, favourite, archived')
        .eq('user_id', user.id).in('thread_id', ids);
      for (const r of (rr ?? []) as any[]) prefs[r.thread_id] = { pinned: !!r.pinned, favourite: !!r.favourite, archived: !!r.archived };
    }
    const rooms = await Promise.all((threads ?? []).map(async (t: any) => {
      const { data: lastMsg } = await supabase.from('messages').select('content, role, user_id')
        .eq('thread_id', t.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      let last_message: string | null = null;
      if (lastMsg?.content) {
        const flat = String((lastMsg as any).content).replace(/\s+/g, ' ').trim().slice(0, 90);
        last_message = ((lastMsg as any).role === 'user' && (lastMsg as any).user_id === user.id) ? `you: ${flat}` : flat;
      }
      return {
        id: t.id, name: t.companion_name,
        personas: (t.member_keys || []), persona: (t.member_keys || [])[0] || null,
        is_owner: t.user_id === user.id,
        last_active: t.last_active, last_message,
        ...(prefs[t.id] || { pinned: false, favourite: false, archived: false }),
      };
    }));
    res.json(rooms);
  } catch (e: any) { res.status(500).json({ error: 'rooms list failed: ' + (e?.message || String(e)) }); }
});

// leave a room (members remove themselves)
// ════════ MULTIPLAYER GAME SESSIONS (server-authoritative) ════════
const GAME_ENGINES: Record<string, any> = {
  debate_duel: debateDuelAdapter,
  battlefield_duel: battlefieldDuelAdapter,
  trivia_duel: triviaDuelAdapter,
  callbreak: callbreakAdapter,
  pusoy: pusoyAdapter,
  poker: pokerAdapter,
  ludo: ludoAdapter,
  liarsdice: {
    create: (seats: any[]) => { const g = LD.newGame(seats.length); LD.rollRound(g); return g; },
    move: (state: any, seat: number, mv: any) => {
      if (mv.type === 'bid') return LD.placeBid(state, seat, mv.qty | 0, mv.face | 0);
      if (mv.type === 'liar') return LD.callLiar(state, seat);
      if (mv.type === 'next') return LD.nextRound(state);
      throw new Error('unknown move');
    },
    ai: (state: any, seat: number) => LD.aiMove(state, seat),
    view: (state: any, seat: number) => LD.viewFor(state, seat),
    isOver: (state: any) => state.phase === 'over',
    toActSeat: (state: any) => (state.phase === 'bidding' ? state.toAct : -1),
  },
};

async function sessionSeatOf(session: any, userId: string): Promise<number> {
  const seats = session.seats as any[];
  return seats.findIndex((s) => s.kind === 'user' && s.id === userId);
}
// advance persona seats until a human must act, a reveal pauses play, or the game ends
function advanceAI(engine: any, state: any, seats: any[]) {
  let guard = 0;
  while (guard++ < 40) {
    const t = engine.toActSeat(state);
    if (t < 0) break;
    const seat = seats[t];
    if (!seat || seat.kind !== 'persona') break;
    state = engine.ai(state, t, seats) ?? state;
    if (engine.isOver(state)) break;
  }
  return state;
}

// start a session in a room you belong to. seats: humans by user id + personas.
app.post('/games/start', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { roomId, game, personaSeats, reserveSeat, reserveSeats } = req.body ?? {};
    const engine = GAME_ENGINES[game];
    if (!engine) return res.status(400).json({ error: 'unknown game: ' + game });
    const { data: thread } = await supabase.from('threads')
      .select('id, user_id, is_shared').eq('id', roomId).is('deleted_at', null).maybeSingle();
    if (!thread) return res.status(404).json({ error: 'room not found' });
    if (thread.user_id !== user.id && !(await isRoomMember(roomId, user.id))) return res.status(403).json({ error: 'not in this room' });
    // seats: every human member of the room, then the requested personas
    const { data: mem } = await supabase.from('room_members').select('user_id').eq('thread_id', roomId);
    const humanIds = Array.from(new Set([thread.user_id, ...((mem ?? []).map((m: any) => m.user_id))]));
    const seats: any[] = humanIds.map((id) => ({ kind: 'user', id }));
    // reserve OPEN seats for friends joining later: all of them for humans-only
    // games, or as many as the starter asked for (the invited flow asks for 1)
    if (engine.humanOnly) {
      while (seats.length < (engine.maxSeats || 2)) seats.push({ kind: 'open', id: null });
    } else {
      const want = Math.max(0, Math.min(((reserveSeats | 0) || (reserveSeat ? 1 : 0)), (engine.maxSeats || 6) - seats.length - 1));
      for (let k = 0; k < want; k++) seats.push({ kind: 'open', id: null });
    }
    const seatCap = (engine.maxSeats || 6) - seats.length;
    for (const pk of (Array.isArray(personaSeats) ? personaSeats : []).slice(0, Math.max(0, seatCap))) {
      if (personaByKey(pk)) seats.push({ kind: 'persona', id: pk });
    }
    const minSeats = engine.minSeats || 2, maxSeats = engine.maxSeats || 6;
    const FILLERS = ['the_conspiracy_theorist', 'the_diva', 'the_wannabe', 'the_brainiac', 'the_comic'];
    let fi = 0;
    while (seats.length < minSeats && fi < FILLERS.length) {
      const pk = FILLERS[fi++];
      if (!seats.some((s2) => s2.kind === 'persona' && s2.id === pk)) seats.push({ kind: 'persona', id: pk });
    }
    if (seats.length > maxSeats) return res.status(400).json({ error: `too many seats for ${game} (max ${maxSeats})` });

    let state = await engine.create(seats, (req.body ?? {}).options || {});
    state = advanceAI(engine, state, seats);
    const { data: sess, error } = await supabase.from('game_sessions').insert({
      thread_id: roomId, game, state, seats, created_by: user.id,
    }).select('id, version').single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ sessionId: sess.id, version: sess.version });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// the live session in a room (latest)
app.get('/games/room/:roomId/live', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const { data } = await supabase.from('game_sessions')
      .select('id, game, version, status').eq('thread_id', req.params.roomId)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    res.json(data ?? {});
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// your view of a session (hidden info filtered server-side)
app.get('/games/session/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('*').eq('id', req.params.id).maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such session' });
    const engine = GAME_ENGINES[s.game];
    const mySeat = await sessionSeatOf(s, user.id);
    if (mySeat < 0) return res.status(403).json({ error: 'not seated here' });
    res.json({ id: s.id, game: s.game, version: s.version, status: s.status, mySeat, seats: s.seats, roomId: s.thread_id, state: engine.view(s.state, mySeat) });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// claim an open seat (friends joining a humans-only table after creation)
app.post('/games/session/:id/claim', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: s } = await supabase.from('game_sessions').select('*').eq('id', req.params.id).maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such session' });
    const seats = s.seats as any[];
    if (seats.some((x) => x.kind === 'user' && x.id === user.id)) return res.json({ ok: true, seat: seats.findIndex((x) => x.kind === 'user' && x.id === user.id) });
    // must be a member of the room
    const { data: t } = await supabase.from('threads').select('user_id').eq('id', s.thread_id).maybeSingle();
    if (t?.user_id !== user.id && !(await isRoomMember(s.thread_id, user.id))) return res.status(403).json({ error: 'not in this room' });
    const open = seats.findIndex((x) => x.kind === 'open');
    if (open < 0) return res.status(409).json({ error: 'table is full' });
    seats[open] = { kind: 'user', id: user.id };
    const { data: upd } = await supabase.from('game_sessions')
      .update({ seats, version: s.version + 1, updated_at: new Date().toISOString() })
      .eq('id', s.id).eq('version', s.version).select('version').maybeSingle();
    if (!upd) return res.status(409).json({ error: 'lost the race' });
    res.json({ ok: true, seat: open });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// make a move (optimistic concurrency via version)
app.post('/games/session/:id/move', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { move, version } = req.body ?? {};
    const { data: s } = await supabase.from('game_sessions').select('*').eq('id', req.params.id).maybeSingle();
    if (!s) return res.status(404).json({ error: 'no such session' });
    if (s.status !== 'live') return res.status(409).json({ error: 'game over' });
    if ((version | 0) !== s.version) return res.status(409).json({ error: 'stale version', version: s.version });
    const engine = GAME_ENGINES[s.game];
    const mySeat = await sessionSeatOf(s, user.id);
    if (mySeat < 0) return res.status(403).json({ error: 'not seated here' });
    let state = s.state;
    // 'next' (advancing past a reveal) is anyone's; play moves must be yours
    if (move?.type !== 'next') {
      const t = engine.toActSeat(state);
      if (t !== mySeat) return res.status(409).json({ error: 'not your turn', version: s.version });
    }
    try { state = await engine.move(state, mySeat, move, s.seats); }
    catch (err: any) { return res.status(400).json({ error: err?.message || 'illegal move' }); }
    state = advanceAI(engine, state, s.seats);
    const over = engine.isOver(state);
    // a finished duel writes to BOTH duellists' ledgers
    if (over && (s.game === 'debate_duel' || s.game === 'trivia_duel')) {
      try {
        const humanSeats = (s.seats as any[]).map((x2: any, i: number) => ({ ...x2, i })).filter((x2: any) => x2.kind === 'user');
        for (const hs of humanSeats) {
          const w = state.winner === 'draw' ? 'draw' : state.winner === hs.i ? 'you' : 'them';
          const notes = s.game === 'debate_duel'
            ? `motion: ${state.motion} — ${String(state.verdict || '').slice(0, 300)}`
            : `topic: ${state.topic} — ${state.scores?.[hs.i] ?? 0} to ${state.scores?.[1 - hs.i] ?? 0}`;
          await supabase.from('arena_matches').insert({
            user_id: hs.id, game: s.game === 'debate_duel' ? 'debate duel' : 'trivia duel', winner: w, notes,
          });
        }
      } catch (e) { console.error('[duel] ledger write failed', e); }
    }
    const { data: upd, error } = await supabase.from('game_sessions')
      .update({ state, version: s.version + 1, status: over ? 'over' : 'live', updated_at: new Date().toISOString() })
      .eq('id', s.id).eq('version', s.version)      // concurrency fence
      .select('version').maybeSingle();
    if (error || !upd) return res.status(409).json({ error: 'lost the race', version: s.version });
    res.json({ ok: true, version: upd.version, over });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// ════════ THE BULLETIN — the anchor's daily editions ════════
const citySlug = (c: string) => c.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

app.get('/bulletin', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: u } = await supabase.from('users').select('city').eq('id', user.id).maybeSingle();
    const [national, local] = await Promise.all([
      getBulletin('in'),
      u?.city ? getBulletin('city:' + citySlug(u.city), u.city) : Promise.resolve(null),
    ]);
    res.json({ city: u?.city ?? null, local: local ?? [], national: national ?? [] });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// set your city for the local desk
app.post('/bulletin/city', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const city = String(req.body?.city || '').trim().slice(0, 60);
    if (!city) return res.status(400).json({ error: 'name the city' });
    await supabase.from('users').update({ city }).eq('id', user.id);
    res.json({ ok: true, city });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

// owner deletes a thread (room or 1:1): soft delete for everyone
app.delete('/threads/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: t } = await supabase.from('threads')
      .select('id, user_id').eq('id', req.params.id).is('deleted_at', null).maybeSingle();
    if (!t) return res.status(404).json({ error: 'thread not found' });
    if (t.user_id !== user.id) return res.status(403).json({ error: 'only the owner can delete' });
    await supabase.from('threads').update({ deleted_at: new Date().toISOString() }).eq('id', t.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.post('/rooms/:id/leave', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    await supabase.from('room_members').delete().eq('thread_id', req.params.id).eq('user_id', user.id);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: 'leave failed: ' + (e?.message || String(e)) }); }
});

// list the user's groups (server is the source of truth, not localStorage)
app.get('/groups', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data } = await supabase.from('threads')
      .select('id, companion_name, member_keys, last_active')
      .eq('user_id', user.id).eq('is_group', true).eq('is_shared', false).is('deleted_at', null)
      .order('last_active', { ascending: false });
    const groups = (data ?? []).map((g: any) => ({ id: g.id, name: g.companion_name, members: g.member_keys || [] }));
    res.json(groups);
  } catch (e: any) { res.status(500).json({ error: 'groups list failed: ' + (e?.message || String(e)) }); }
});

app.post('/groups', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { name, members } = req.body ?? {};
    const keys: string[] = Array.isArray(members) ? members.filter((m: any) => typeof m === 'string') : [];
    if (keys.length < 2) return res.status(400).json({ error: 'a group needs at least 2 members' });
    const { data, error } = await supabase.from('threads').insert({
      user_id: user.id, is_group: true, member_keys: keys,
      companion_name: (name && String(name).trim()) || 'the group',
    }).select('id, is_group, member_keys, companion_name').single();
    if (error) return res.status(500).json({ error: 'group create: ' + error.message });
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: 'group failed: ' + (e?.message || String(e)) }); }
});

app.post('/chat', express.json({ limit: '8mb' }), async (req, res) => {
  let user;
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    user = await resolveUser(authId);
    if (await isRestricted(user.id)) return res.status(403).json({ error: 'restricted' });
  } catch (e: any) {
    return res.status(500).json({ error: 'chat setup failed: ' + (e?.message || String(e)) });
  }

  const { threadId, message, image, addressed } = req.body ?? {};
  const hasImage = !!image && typeof image === 'object' && typeof image.data === 'string';
  if (!threadId || (!message && !hasImage)) return res.status(400).json({ error: 'threadId and message (or image) required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    // look up the thread. shared rooms: any MEMBER may chat (not just owner).
    const { data: th } = await supabase.from('threads')
      .select('is_group, is_shared, user_id, member_keys').eq('id', threadId).is('deleted_at', null).maybeSingle();
    if (!th) { res.write(`data: ${JSON.stringify({ error: 'thread not found' })}\n\n`); return res.end(); }
    const isOwner = th.user_id === user.id;
    // A DM is a shared thread with NO persona members — two humans, no one to "generate"
    // a reply. Persist the message + broadcast it to the other device; never call
    // runGroupTurn (which needs persona members and would throw / try to summon one).
    const isDM = th.is_shared && (!th.member_keys || th.member_keys.filter(Boolean).length === 0);
    if (isDM) {
      if (!isOwner && !(await isRoomMember(threadId, user.id))) {
        res.write(`data: ${JSON.stringify({ error: 'not your conversation' })}\n\n`); return res.end();
      }
      if (!message || !String(message).trim()) {
        res.write(`data: ${JSON.stringify({ error: 'empty message' })}\n\n`); return res.end();
      }
      const { data: saved } = await supabase.from('messages')
        .insert({ thread_id: threadId, user_id: user.id, role: 'user', content: String(message), sender_user_id: user.id })
        .select('id, created_at').maybeSingle();
      await supabase.from('threads').update({ last_active: new Date().toISOString() }).eq('id', threadId);
      // fire-and-forget: don't make the sender wait on the fan-out (REST broadcast,
      // best-effort + already persisted; client has a pg_changes fallback).
      void broadcastRoomMessage(threadId, {
        role: 'user', content: String(message), sender_user_id: user.id,
        sender_name: user.display_name || 'someone',
      });
      res.write(`data: ${JSON.stringify({ done: true, saved: saved?.id || null })}\n\n`);
      return res.end();
    }
    if (th.is_shared) {
      // membership gate: only members of the room may post
      if (!isOwner && !(await isRoomMember(threadId, user.id))) {
        res.write(`data: ${JSON.stringify({ error: 'you are not in this room' })}\n\n`); return res.end();
      }
      await runGroupTurn({
        userId: user.id, threadId, message, image: image ?? null, senderName: user.display_name || 'someone',
        addressed: Array.isArray(addressed) ? addressed : undefined,
        onPersonaStart: (key, name) => res.write(`data: ${JSON.stringify({ speaker: key, name })}\n\n`),
        onToken: (key, t) => res.write(`data: ${JSON.stringify({ speaker: key, token: t })}\n\n`),
        onPersonaEnd: (key, full) => res.write(`data: ${JSON.stringify({ speaker: key, end: true })}\n\n`),
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } else if (th.is_group && isOwner) {
      // ARENA support in groups: strip score tags from the moderator's visible stream,
      // and after its turn, parse + emit score/result + persist the match.
      const tagRe = /\[\[(SCORE|RESULT|VERDICT|TENSION|COMPLICATION|COMMIT|NOTES)[^\]]*\]\]/g;
      const tails: Record<string, string> = {};
      const flushVisible = (key: string, chunk: string, final = false) => {
        let buf = (tails[key] || '') + chunk;
        buf = buf.replace(tagRe, '');
        if (!final) {
          const lastOpen = buf.lastIndexOf('[[');
          if (lastOpen !== -1 && buf.indexOf(']]', lastOpen) === -1) { tails[key] = buf.slice(lastOpen); buf = buf.slice(0, lastOpen); }
          else { tails[key] = ''; }
        } else { tails[key] = ''; }
        if (buf) res.write(`data: ${JSON.stringify({ speaker: key, token: buf })}\n\n`);
      };
      await runGroupTurn({
        userId: user.id, threadId, message,
        onPersonaStart: (key, name) => res.write(`data: ${JSON.stringify({ speaker: key, name })}\n\n`),
        onToken: (key, t) => flushVisible(key, t),
        onPersonaEnd: (key, full) => {
          flushVisible(key, '', true);
          res.write(`data: ${JSON.stringify({ speaker: key, end: true })}\n\n`);
          // only the moderator carries score/result/verdict tags
          if (key === 'the_moderator') {
            const score = /\[\[SCORE\s+you=(\d+)\s+z=(\d+)\]\]/.exec(full);
            const r2 = /\[\[RESULT\s+winner=(you|z|draw)\s+you=(\d+)\s+z=(\d+)\]\]/.exec(full);
            const verdict = /\[\[VERDICT\s+outcome=(win|loss|draw)\]\]/.exec(full);
            // the pressure dial: last TENSION wins; complications carry a label
            const tMatches = [...full.matchAll(/\[\[TENSION\s+(\d{1,2})\]\]/g)];
            if (tMatches.length) {
              const n = Math.max(1, Math.min(10, parseInt(tMatches[tMatches.length - 1][1], 10)));
              res.write(`data: ${JSON.stringify({ tension: n })}\n\n`);
            }
            const comp = /\[\[COMPLICATION:\s*([^\]]+)\]\]/.exec(full);
            if (comp) res.write(`data: ${JSON.stringify({ complication: comp[1].trim().slice(0, 80) })}\n\n`);
            if (score) res.write(`data: ${JSON.stringify({ score: { you: +score[1], z: +score[2] } })}\n\n`);
            if (r2) {
              res.write(`data: ${JSON.stringify({ result: { winner: r2[1], you: +r2[2], z: +r2[3] } })}\n\n`);
              supabase.from('threads').select('game_mode, member_keys').eq('id', threadId).maybeSingle().then(({ data: thg }: any) => {
                const opp = (thg?.member_keys || []).find((k: string) => k !== 'the_moderator') || null;
                supabase.from('arena_matches').insert({
                  user_id: user.id, game: thg?.game_mode || 'unknown', persona_key: opp,
                  you_score: +r2[2], z_score: +r2[3], winner: r2[1],
                }).then(() => {});
                supabase.from('threads').update({ game_mode: null }).eq('id', threadId).then(() => {});
              });
            }
            if (verdict) {
              const outcome = verdict[1];
              const notesM = /\[\[NOTES:\s*([^\]]+)\]\]/.exec(full);
              const notes = notesM ? notesM[1].trim().slice(0, 400) : null;
              res.write(`data: ${JSON.stringify({ verdict: { outcome, notes } })}\n\n`);
              supabase.from('threads').select('scenario_key, scenario_brief').eq('id', threadId).maybeSingle().then(({ data: thr }: any) => {
                const runRow: any = {
                  user_id: user.id, scenario: thr?.scenario_key || 'unknown',
                  player_role: thr?.scenario_brief || null, outcome,
                };
                if (notes) runRow.notes = notes;
                supabase.from('roleplay_runs').insert(runRow).then(() => {});
                if (thr?.scenario_key) void completeArcIfFinal(user.id, thr.scenario_key, outcome);
                // scene over — clear the scenario so the thread returns to normal
                supabase.from('threads').update({ scenario_key: null, scenario_brief: null }).eq('id', threadId).then(() => {});
              });
            }
          }
        },
      });
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } else if (isOwner) {
      // ARENA: if a game is active, strip score tags from the player-visible stream.
      // Tags can split across tokens, so we hold back a small tail buffer.
      const tagRe = /\[\[(SCORE|RESULT|TASK_ADD|TASK_DONE|GOTO)[^\]]*\]\]/g;
      let tail = '';
      const flushVisible = (chunk: string, final = false) => {
        let buf = tail + chunk;
        buf = buf.replace(tagRe, '');                 // drop any complete tags
        if (!final) {
          // hold back a trailing partial "[[..." so we don't leak half a tag
          const lastOpen = buf.lastIndexOf('[[');
          if (lastOpen !== -1 && buf.indexOf(']]', lastOpen) === -1) {
            tail = buf.slice(lastOpen); buf = buf.slice(0, lastOpen);
          } else { tail = ''; }
        } else { tail = ''; }
        if (buf) res.write(`data: ${JSON.stringify({ token: buf })}\n\n`);
      };
      const result = await runZTurn({
        userId: user.id, threadId, message, image: image ?? null,
        onToken: (t) => flushVisible(t),
      });
      flushVisible('', true);
      // optional source pills for web-enabled personas (Z still speaks in her own voice)
      if (result.sources && result.sources.length) {
        res.write(`data: ${JSON.stringify({ sources: result.sources.slice(0, 4) })}\n\n`);
      }
      // the Front Desk's routing suggestions → tappable persona chips
      if ((result as any).routes && (result as any).routes.length) {
        res.write(`data: ${JSON.stringify({ routes: (result as any).routes })}\n\n`);
      }
      // parse score/result tags from the full reply, persist + tell the UI
      const score = /\[\[SCORE\s+you=(\d+)\s+z=(\d+)\]\]/.exec(result.reply);
      const res2  = /\[\[RESULT\s+winner=(you|z|draw)\s+you=(\d+)\s+z=(\d+)\]\]/.exec(result.reply);
      if (score) res.write(`data: ${JSON.stringify({ score: { you: +score[1], z: +score[2] } })}\n\n`);
      if (res2) {
        res.write(`data: ${JSON.stringify({ result: { winner: res2[1], you: +res2[2], z: +res2[3] } })}\n\n`);
        // persist the match + clear game_mode (match over)
        const { data: th } = await supabase.from('threads').select('game_mode, persona_key').eq('id', threadId).maybeSingle();
        await supabase.from('arena_matches').insert({
          user_id: user.id, game: (th as any)?.game_mode || 'unknown',
          persona_key: (th as any)?.persona_key || null,
          you_score: +res2[2], z_score: +res2[3], winner: res2[1],
        });
        await supabase.from('threads').update({ game_mode: null }).eq('id', threadId);
      }
      logUsage({ userId: user.id, threadId, surface: 'chat', fn: 'chat', model: 'claude-haiku-4-5-20251001', usage: result.usage });
      const _diag = diagEcho(user.id, { usage: result.usage, model: 'claude-haiku-4-5-20251001', fn: 'chat' });
      res.write(`data: ${JSON.stringify({ done: true, usage: result.usage, ...(_diag ? { cost: _diag } : {}) })}\n\n`);
      res.end();
    }
  } catch (e: any) {
    // DIAGNOSTIC: the reason "Premature close" was never diagnosable is THIS — the error was
    // written into the SSE and never logged, so Railway logs were empty on it. Log it fully.
    console.error('[chat] handler error', 'name=', e?.name, 'code=', e?.code, 'msg=', e?.message);
    if (e?.cause) console.error('[chat] cause=', e.cause);
    if (e?.stack) console.error(e.stack);
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

const port = Number(process.env.PORT) || 3000;
installSimRoutes(app, authUser);
installFfRoutes(app, authUser);
installCustomPersonaRoutes(app, authUser);

app.listen(port, () => console.log(`[z] engine on :${port}`));
