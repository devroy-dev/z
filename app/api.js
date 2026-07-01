// ════════════════════════════════════════════════════════════════════════
//  yourZ — the network layer. Speaks the live engine's exact contract
//  (proven from the PWA): POST /chat with SSE streaming of data: {token}
//  frames, Bearer/x-z-user auth, anon uid for instant no-login use.
//  This is the keystone: once chat is live, rooms/arena/desk follow the same
//  pattern. Base points at Railway.
// ════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://z-production-c79a.up.railway.app';

// ---- identity: token if logged in, else an anon uid (auto-created) ----
let _uid = null;
let _token = null;

export async function ensureIdentity() {
  if (_token || _uid) return;
  try {
    _token = await AsyncStorage.getItem('z_token');
    _uid = await AsyncStorage.getItem('z_uid');
  } catch (e) {}
  if (!_token && !_uid) {
    _uid = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { await AsyncStorage.setItem('z_uid', _uid); } catch (e) {}
  }
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = 'Bearer ' + _token;
  else if (_uid) h['x-z-user'] = _uid;
  return h;
}

// ---- open (or fetch) the thread for a persona ----
export async function openThread(personaKey) {
  await ensureIdentity();
  try {
    const r = await fetch(`${API_BASE}/threads`, { headers: headers() });
    if (r.ok) {
      const list = await r.json();
      const existing = Array.isArray(list) ? list.find((t) => t.persona === personaKey || t.key === personaKey) : null;
      if (existing && existing.id) return existing.id;
    }
  } catch (e) {}
  // fall back: many backends create-on-first-message; return the persona key as a soft id
  return personaKey;
}

// ---- the main event: stream a chat reply ----
// onToken(text) fires per streamed token; onRoutes(arr), onDone(), onError(msg) optional.
export async function streamChat({ threadId, message, image, persona, onToken, onRoutes, onDone, onError }) {
  await ensureIdentity();
  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ threadId, message, image, persona }),
    });

    if (!res.ok) {
      let msg = '(z went quiet — try again)';
      try { const j = await res.json(); if (j.error) msg = '(' + j.error + ')'; } catch (_) {}
      onError && onError(msg);
      return;
    }

    // React Native fetch supports streaming via res.body.getReader() on Hermes/新arch;
    // if not available, fall back to full-text read.
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', acc = '';
      const drain = () => {
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          chunk.split('\n').forEach((line) => {
            line = line.trim();
            if (!line.startsWith('data:')) return;
            const payload = line.slice(5).trim();
            if (!payload) return;
            let ev; try { ev = JSON.parse(payload); } catch (_) { return; }
            if (typeof ev.token === 'string') { acc += ev.token; onToken && onToken(acc); }
            else if (ev.routes) { onRoutes && onRoutes(ev.routes); }
            else if (ev.done) { onDone && onDone(acc); }
            else if (ev.error) { onError && onError('(' + ev.error + ')'); }
          });
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        drain();
      }
      onDone && onDone(acc);
    } else {
      // no streaming: read whole body, parse data: frames in one go
      const text = await res.text();
      let acc = '';
      text.split('\n\n').forEach((chunk) => {
        chunk.split('\n').forEach((line) => {
          line = line.trim();
          if (!line.startsWith('data:')) return;
          const payload = line.slice(5).trim();
          if (!payload) return;
          let ev; try { ev = JSON.parse(payload); } catch (_) { return; }
          if (typeof ev.token === 'string') { acc += ev.token; onToken && onToken(acc); }
          else if (ev.routes) { onRoutes && onRoutes(ev.routes); }
          else if (ev.error) { onError && onError('(' + ev.error + ')'); }
        });
      });
      onDone && onDone(acc);
    }
  } catch (e) {
    onError && onError('(no connection — check your network)');
  }
}
