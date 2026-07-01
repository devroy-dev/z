// ════════════════════════════════════════════════════════════════════════
//  yourZ — the network layer. Speaks the live engine's exact contract
//  (proven from the PWA): POST /chat with SSE streaming of data: {token}
//  frames, Bearer/x-z-user auth, anon uid for instant no-login use.
//  This is the keystone: once chat is live, rooms/arena/desk follow the same
//  pattern. Base points at Railway.
// ════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API_BASE = 'https://z-production-c79a.up.railway.app';

// ---- identity: real token from phone auth (the live engine requires this) ----
let _uid = null;
let _token = null;

export async function loadSession() {
  try {
    _token = await AsyncStorage.getItem('z_token');
    _uid = await AsyncStorage.getItem('z_real_uid');
  } catch (e) {}
  return { token: _token, userId: _uid };
}

export async function isLoggedIn() {
  if (_token) return true;
  try { _token = await AsyncStorage.getItem('z_token'); } catch (e) {}
  return !!_token;
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (_token) h['Authorization'] = 'Bearer ' + _token;
  return h;
}
export function rawHeaders() { return headers(); }

// ---- in-game persona banter: the RIGHT endpoint (no thread needed) ----
// POST /banter { persona, prompt } → { line }. Purpose-built for game reactions.
export async function banter(persona, prompt) {
  await loadSession();
  const call = async () => fetch(`${API_BASE}/banter`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ persona, prompt }),
  });
  try {
    let r = await call();
    // if the token is stale, refresh once and retry (like the chat paths do)
    if (r.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed) r = await call();
    }
    const bodyText = await r.text().catch(() => '(no body)');
    if (!r.ok) return { line: null, diag: `/banter → ${r.status}: ${bodyText.slice(0, 100)}` };
    let j = {}; try { j = JSON.parse(bodyText); } catch (_) {}
    const line = (j.line || '').trim();
    return { line: line || null, diag: line ? null : `/banter → 200 but no line` };
  } catch (e) { return { line: null, diag: `/banter network error: ${String(e).slice(0, 70)}` }; }
}

// ---- AUTH: phone → OTP → token (the real flow, from the PWA) ----
export async function sendOtp(phone) {
  try {
    const r = await fetch(`${API_BASE}/auth/otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || "couldn't send the code. try again." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'no connection. try again.' };
  }
}

export async function verifyOtp(phone, code) {
  try {
    const r = await fetch(`${API_BASE}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.token) return { ok: false, error: j.error || "that code didn't work." };
    _token = j.token;
    _uid = j.userId || null;
    try {
      await AsyncStorage.setItem('z_token', j.token);
      if (j.refreshToken) await AsyncStorage.setItem('z_refresh', j.refreshToken);
      if (j.expiresIn) await AsyncStorage.setItem('z_exp', String(Date.now() + j.expiresIn * 1000));
      if (j.userId) await AsyncStorage.setItem('z_real_uid', j.userId);
    } catch (e) {}
    return { ok: true, hasName: !!j.hasName, hasPin: !!j.hasPin };
  } catch (e) {
    return { ok: false, error: 'no connection. try again.' };
  }
}

// first-timers set a 4-digit PIN after OTP (uses the Bearer token just obtained)
export async function setPin(pin) {
  try {
    const r = await fetch(`${API_BASE}/auth/pin/set`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ pin }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, error: j.error || 'could not save pin' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'no connection. try again.' };
  }
}

// returning user on a known device unlocks with PIN — no OTP
export async function verifyPin(pin) {
  let userId = null, rt = null;
  try {
    userId = await AsyncStorage.getItem('z_real_uid');
    rt = await AsyncStorage.getItem('z_refresh');
  } catch (e) {}
  try {
    const r = await fetch(`${API_BASE}/auth/pin/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, pin, refreshToken: rt }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.needOtp) return { ok: false, needOtp: true };
    if (!r.ok || !j.token) return { ok: false, error: j.error || 'wrong pin' };
    _token = j.token;
    try {
      await AsyncStorage.setItem('z_token', j.token);
      if (j.refreshToken) await AsyncStorage.setItem('z_refresh', j.refreshToken);
      if (j.expiresIn) await AsyncStorage.setItem('z_exp', String(Date.now() + j.expiresIn * 1000));
    } catch (e) {}
    return { ok: true, hasName: !!j.hasName };
  } catch (e) {
    return { ok: false, error: 'no connection. try again.' };
  }
}

// does this device remember an account (so we can show PIN unlock, not OTP)?
export async function knownDevice() {
  try {
    const uid = await AsyncStorage.getItem('z_real_uid');
    const rt = await AsyncStorage.getItem('z_refresh');
    return !!(uid && rt);
  } catch (e) { return false; }
}

export async function refreshSession() {
  let rt = null;
  try { rt = await AsyncStorage.getItem('z_refresh'); } catch (e) {}
  if (!rt) return false;
  try {
    const r = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.token) {
      _token = j.token;
      try {
        await AsyncStorage.setItem('z_token', j.token);
        if (j.refreshToken) await AsyncStorage.setItem('z_refresh', j.refreshToken);
        if (j.expiresIn) await AsyncStorage.setItem('z_exp', String(Date.now() + j.expiresIn * 1000));
      } catch (e) {}
      return true;
    }
  } catch (e) {}
  return false;
}

// set the profile name (server wants it, esp. for rooms)
export async function setMe(displayName) {
  try {
    await fetch(`${API_BASE}/me`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ displayName, region: 'IN', sex: 'na' }),
    });
  } catch (e) {}
}

export async function logout() {
  _token = null; _uid = null;
  try {
    await AsyncStorage.removeItem('z_token');
    await AsyncStorage.removeItem('z_refresh');
    await AsyncStorage.removeItem('z_exp');
    await AsyncStorage.removeItem('z_real_uid');
  } catch (e) {}
}

// ---- open (or create) the thread for a persona → returns the real thread id ----
export async function openThread(personaKey, name) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/threads`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ personaKey, name: name || personaKey }),
  });
  try {
    let r = await call();
    // stale token → refresh once and retry. Without this the thread never resolves
    // and every send silently no-ops (the "dead send button" bug).
    if (r.status === 401 && (await refreshSession())) r = await call();
    const j = await r.json().catch(() => ({}));
    const id = j.id || j.thread_id || null;
    if (id) return id;
  } catch (e) {}
  return null; // no thread → chat will know not to send
}

// ---- the main event: stream a chat reply ----
// onToken(text) fires per streamed token; onRoutes(arr), onDone(), onError(msg) optional.
export async function streamChat({ threadId, message, image, persona, onToken, onRoutes, onDone, onError }) {
  await loadSession();
  try {
    const doFetch = () => fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ threadId, message, image, persona }),
    });
    let res = await doFetch();
    // stale token → refresh once and retry (else chat silently fails on expiry)
    if (res.status === 401 && (await refreshSession())) res = await doFetch();

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

// ── authed JSON helper: 401 → refresh once → retry (mirrors the chat paths) ──
async function authedJSON(method, path, body) {
  await loadSession();
  const call = () => fetch(`${API_BASE}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let r = await call();
  if (r.status === 401 && (await refreshSession())) r = await call();
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${method} ${path} failed`);
  return j;
}

// ── the roster: the user's personas with THEIR chosen name + dp (custom over default) ──
// GET /threads → [{ id, persona_key, companion_name, avatar_url, accent, last_active }]
export async function listThreads() {
  try { return await authedJSON('GET', '/threads'); } catch (e) { return []; }
}

// ── tasks: the concierge's list (server also adds/completes these from [[TASK_*]] tags) ──
export async function listTasks() {
  try { const j = await authedJSON('GET', '/tasks'); return j.tasks || []; } catch (e) { return []; }
}
export async function addTask(title, extra = {}) {
  try { return await authedJSON('POST', '/tasks', { title, ...extra }); } catch (e) { return null; }
}
export async function setTaskStatus(id, status) {
  try { return await authedJSON('PATCH', `/tasks/${id}`, { status }); } catch (e) { return null; }
}
export async function deleteTask(id) {
  try { return await authedJSON('DELETE', `/tasks/${id}`); } catch (e) { return null; }
}

// ── what Z remembers: durable facts (z.memory) + the overseer's letters (z.user_notes) ──
// GET /notes → { facts: [{id,key,value,created_at}], notes: [{id,body,created_at}] }
export async function getNotes() {
  try { return await authedJSON('GET', '/notes'); } catch (e) { return { facts: [], notes: [] }; }
}
export async function deleteNote(kind, id) {
  try { return await authedJSON('DELETE', `/notes/${kind}/${id}`); } catch (e) { return null; }
}
