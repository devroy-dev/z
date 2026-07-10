// ════════════════════════════════════════════════════════════════════════
//  yourZ — realtime for shared rooms. A faithful port of the PWA's proven,
//  end-to-end-tested pattern:
//   • the server broadcasts each saved room message to channel 'room-{threadId}'
//     (event 'msg') — reliable, no WAL/RLS-on-socket dependency.
//   • postgres_changes is a FALLBACK in case a broadcast is missed; the consumer
//     dedups across both paths. THE DEDUPE LAW (H1b, learned twice now):
//       key on the DB MESSAGE ID first ('m:'+id) — it is byte-identical on both
//       transports; the sender's own lines also key on client_id ('cid:'+cid).
//       Check BOTH candidate keys before painting; REGISTER both after — that is
//       what makes the dedupe arrival-order-proof (broadcast-first or pg-first).
//       role:who:content survives ONLY as the last-resort fallback for payloads
//       from an old server build carrying neither id.
//     NEVER key on created_at — it differs between the two transports (broadcast
//     stamps at publish; pg_changes carries the row's insert time). That exact
//     mistake caused double-rendering in the PWA, was written here as a warning,
//     and was made AGAIN in H1 by an author who didn't re-read this header.
//     Read the header. That's what it's for.
//   • NO server-side channel filter — filters silently drop events on the z
//     schema, so we filter by thread_id in the consumer instead.
//  supabase-js needs the URL polyfill in React Native, or the realtime socket
//  never connects. Import it FIRST.
// ════════════════════════════════════════════════════════════════════════
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { API_BASE, loadSession } from './api';

let _sb = null;
let _channel = null;

// lazy singleton client: fetch the public config, create the client, auth the
// realtime socket with the user's token (so RLS-scoped events are delivered).
async function getClient() {
  // [H1c] AUTH LAW: the token is (re)applied on EVERY call, not only at client
  // creation. The old shape set auth once — a cold-start race (first caller
  // winning before session hydration) cached the singleton UNAUTHED FOREVER,
  // and a rotated token was never refreshed. That family produced the field
  // reading `inbox:connecting b:0`.
  try {
    if (!_sb) {
      const r = await fetch(`${API_BASE}/config`);
      const cfg = await r.json();
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
      _sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } });
    }
    const { token } = await loadSession();
    if (token) { try { await _sb.realtime.setAuth(token); } catch (e) {} }
    return _sb;
  } catch (e) { return null; }
}

// subscribe to a room's live feed. onMsg(rawMessage) fires for EVERY delivery
// (broadcast + pg_changes) — the consumer dedups + thread_id-filters. onStatus
// reports the channel state (connecting/SUBSCRIBED/CHANNEL_ERROR/...) so the UI
// can show whether realtime actually connected. returns an unsubscribe fn.
export async function subscribeRoom(threadId, onMsg, onStatus) {
  const sb = await getClient();
  if (!sb) { onStatus && onStatus('no-client'); return () => {}; }
  unsubscribe();
  _channel = sb.channel('room-' + threadId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'msg' }, (payload) => {
      const m = payload && payload.payload; if (m) onMsg(m);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'z', table: 'messages' }, (payload) => {
      if (payload && payload.new) onMsg(payload.new);
    })
    .subscribe((status, err) => { onStatus && onStatus(status, err); });
  return unsubscribe;
}

export function unsubscribe() {
  if (_channel && _sb) { try { _sb.removeChannel(_channel); } catch (e) {} _channel = null; }
}

// ════════════════════════════════════════════════════════════════════════
//  [zip53] THE INBOX CHANNEL — the user's own `user-<id>` topic. The server
//  (zip48) batches an 'inbox' bump onto every room-message fan-out:
//  {thread_id, last_active, preview, persona_key, sender_user_id, sender_name}.
//  Rides ITS OWN singleton (the duel channels' escape from the shared-handle
//  trap) so the chats list and an open room never kill each other's socket.
// ════════════════════════════════════════════════════════════════════════
let _inboxChannel = null;
let _inboxUserId = null;
let _inboxOnBump = null;      // [H1c] handlers live in module refs the channel reads
let _inboxOnStatus = null;    //       through — a remount REWIRES instead of feeding
let _inboxLastStatus = null;  //       a dead closure (the early-return swallow).
let _inboxRetryTimer = null;
let _inboxRetries = 0;
let _inboxJoinWatchdog = null;
const INBOX_MAX_RETRIES = 5;

function _inboxJoin(sb, userId) {
  if (_inboxJoinWatchdog) { clearTimeout(_inboxJoinWatchdog); _inboxJoinWatchdog = null; }
  _inboxChannel = sb.channel('user-' + userId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'inbox' }, (payload) => {
      const b = payload && payload.payload; if (b && _inboxOnBump) _inboxOnBump(b);
    })
    .subscribe((status, err) => {
      _inboxLastStatus = status;
      if (_inboxJoinWatchdog) { clearTimeout(_inboxJoinWatchdog); _inboxJoinWatchdog = null; }
      if (_inboxOnStatus) _inboxOnStatus(status, err);
      if (status === 'SUBSCRIBED') { _inboxRetries = 0; return; }
      // [H1c] RETRY LAW: the old shape subscribed once and a failed join stayed
      // dead until remount. Error/timeout/close now re-joins with backoff, capped.
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') _inboxScheduleRetry(userId);
    });
  // a join that never calls back at all (the 'connecting forever' field reading)
  // is also a failure — watchdog it.
  _inboxJoinWatchdog = setTimeout(() => {
    _inboxJoinWatchdog = null;
    if (_inboxLastStatus !== 'SUBSCRIBED' && _inboxUserId === userId) _inboxScheduleRetry(userId);
  }, 8000);
}

function _inboxScheduleRetry(userId) {
  if (_inboxRetryTimer || _inboxUserId !== userId) return;
  if (_inboxRetries >= INBOX_MAX_RETRIES) { if (_inboxOnStatus) _inboxOnStatus('gave-up'); return; }
  const wait = Math.min(15000, 1500 * Math.pow(2, _inboxRetries));
  _inboxRetries += 1;
  if (_inboxOnStatus) _inboxOnStatus('retrying-' + _inboxRetries);
  _inboxRetryTimer = setTimeout(async () => {
    _inboxRetryTimer = null;
    if (_inboxUserId !== userId) return;
    if (_inboxChannel && _sb) { try { _sb.removeChannel(_inboxChannel); } catch (e) {} _inboxChannel = null; }
    const sb = await getClient();   // re-applies auth (the AUTH LAW above)
    if (!sb) { _inboxScheduleRetry(userId); return; }
    _inboxJoin(sb, userId);
  }, wait);
}

export async function subscribeInbox(userId, onBump, onStatus) {
  _inboxOnBump = onBump; _inboxOnStatus = onStatus;   // [H1c] rewire FIRST, every call
  const sb = await getClient();
  if (!sb) { onStatus && onStatus('no-client'); return () => {}; }
  if (_inboxChannel && _inboxUserId === userId) {
    // already live: replay the real status instead of leaving the new mount on
    // its initial 'connecting' (the exact zip56 field reading), and the rewire
    // above already points bumps at the LIVE closure.
    if (onStatus && _inboxLastStatus) onStatus(_inboxLastStatus);
    return unsubscribeInbox;
  }
  unsubscribeInbox();
  _inboxUserId = userId;
  _inboxRetries = 0;
  _inboxJoin(sb, userId);
  return unsubscribeInbox;
}

export function unsubscribeInbox() {
  if (_inboxRetryTimer) { clearTimeout(_inboxRetryTimer); _inboxRetryTimer = null; }
  if (_inboxJoinWatchdog) { clearTimeout(_inboxJoinWatchdog); _inboxJoinWatchdog = null; }
  if (_inboxChannel && _sb) { try { _sb.removeChannel(_inboxChannel); } catch (e) {} }
  _inboxChannel = null; _inboxUserId = null; _inboxOnBump = null; _inboxOnStatus = null; _inboxLastStatus = null; _inboxRetries = 0;
}

// ════════════════════════════════════════════════════════════════════════
//  THE BATTLEFIELD — live keystroke streaming. A debater's composition is
//  broadcast to the room as throttled full-textbox-state (client→client, never
//  persisted): pauses show as no-change, deletes as text-shrink, bursts as
//  big-jumps — the "watch them write it" drama at ~4-6 events/sec, not per-key.
//  Rides a SEPARATE channel from chat (its own singleton) so the two never
//  collide. Only the active debater sends; opponent + spectators receive.
// ════════════════════════════════════════════════════════════════════════
let _duelChannel = null;
let _duelThreadId = null;
let _duelSendChannel = null;
let _duelSendThreadId = null;

// join a duel's live channel. onKeys({seat,phase,text,done}) fires on every
// keystroke-state broadcast. Returns an unsubscribe fn. Idempotent per thread.
export async function subscribeDuelKeys(threadId, onKeys, onStatus) {
  const sb = await getClient();
  if (!sb) { onStatus && onStatus('no-client'); return () => {}; }
  unsubscribeDuel();
  _duelThreadId = threadId;
  _duelChannel = sb.channel('duel-' + threadId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'keys' }, (payload) => {
      const k = payload && payload.payload; if (k) onKeys(k);
    })
    .subscribe((status, err) => { onStatus && onStatus(status, err); });
  return unsubscribeDuel;
}

// open a persistent SEND channel for the active debater (call once when their
// turn begins). Held open for the turn so throttled sends reuse one socket
// instead of a handshake per keystroke frame. closeDuelSender() when the turn ends.
export async function openDuelSender(threadId) {
  try {
    const sb = await getClient();
    if (!sb) return;
    if (_duelSendChannel && _duelSendThreadId === threadId) return; // already open
    closeDuelSender();
    _duelSendThreadId = threadId;
    _duelSendChannel = sb.channel('duel-' + threadId, { config: { broadcast: { ack: false, self: false } } });
    await new Promise((resolve) => { _duelSendChannel.subscribe(() => resolve()); setTimeout(resolve, 1200); });
  } catch (e) { /* best-effort */ }
}

// broadcast the debater's current textbox state on the open sender (or the
// subscribed channel, whichever is live for this thread). Fire-and-forget.
export async function broadcastDuelKeys(threadId, payload) {
  try {
    const ch = (_duelSendChannel && _duelSendThreadId === threadId) ? _duelSendChannel
             : (_duelChannel && _duelThreadId === threadId) ? _duelChannel
             : null;
    if (!ch) return;
    await ch.send({ type: 'broadcast', event: 'keys', payload });
  } catch (e) { /* a missed keystroke frame is harmless */ }
}

export function closeDuelSender() {
  if (_duelSendChannel && _sb) { try { _sb.removeChannel(_duelSendChannel); } catch (e) {} _duelSendChannel = null; _duelSendThreadId = null; }
}

export function unsubscribeDuel() {
  if (_duelChannel && _sb) { try { _sb.removeChannel(_duelChannel); } catch (e) {} _duelChannel = null; _duelThreadId = null; }
}
