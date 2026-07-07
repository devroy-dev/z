// ════════════════════════════════════════════════════════════════════════
//  yourZ — realtime for shared rooms. A faithful port of the PWA's proven,
//  end-to-end-tested pattern:
//   • the server broadcasts each saved room message to channel 'room-{threadId}'
//     (event 'msg') — reliable, no WAL/RLS-on-socket dependency.
//   • postgres_changes is a FALLBACK in case a broadcast is missed; the consumer
//     dedups across both paths (keyed on role:who:content, NOT created_at, which
//     differs between paths and caused double-rendering in the PWA).
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
  if (_sb) return _sb;
  try {
    const r = await fetch(`${API_BASE}/config`);
    const cfg = await r.json();
    if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return null;
    _sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: false } });
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

export async function subscribeInbox(userId, onBump, onStatus) {
  const sb = await getClient();
  if (!sb) { onStatus && onStatus('no-client'); return () => {}; }
  if (_inboxChannel && _inboxUserId === userId) return unsubscribeInbox; // already live
  unsubscribeInbox();
  _inboxUserId = userId;
  _inboxChannel = sb.channel('user-' + userId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'inbox' }, (payload) => {
      const b = payload && payload.payload; if (b) onBump(b);
    })
    .subscribe((status, err) => { onStatus && onStatus(status, err); });
  return unsubscribeInbox;
}

export function unsubscribeInbox() {
  if (_inboxChannel && _sb) { try { _sb.removeChannel(_inboxChannel); } catch (e) {} _inboxChannel = null; _inboxUserId = null; }
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
