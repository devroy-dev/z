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
// (broadcast + pg_changes) — the consumer is responsible for dedup + thread_id
// filtering. returns an unsubscribe fn (also call unsubscribe() directly).
export async function subscribeRoom(threadId, onMsg) {
  const sb = await getClient();
  if (!sb) return () => {};
  unsubscribe();
  _channel = sb.channel('room-' + threadId, { config: { broadcast: { self: false } } })
    .on('broadcast', { event: 'msg' }, (payload) => {
      const m = payload && payload.payload; if (m) onMsg(m);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'z', table: 'messages' }, (payload) => {
      if (payload && payload.new) onMsg(payload.new);
    })
    .subscribe();
  return unsubscribe;
}

export function unsubscribe() {
  if (_channel && _sb) { try { _sb.removeChannel(_channel); } catch (e) {} _channel = null; }
}
