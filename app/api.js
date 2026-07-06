// ════════════════════════════════════════════════════════════════════════
//  yourZ — the network layer. Speaks the live engine's exact contract
//  (proven from the PWA): POST /chat with SSE streaming of data: {token}
//  frames, Bearer/x-z-user auth, anon uid for instant no-login use.
//  This is the keystone: once chat is live, rooms/arena/desk follow the same
//  pattern. Base points at Railway.
// ════════════════════════════════════════════════════════════════════════
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

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

// does a token merely EXIST in storage? (cheap, local — not a validity check)
export async function hasStoredToken() {
  if (_token) return true;
  try { _token = await AsyncStorage.getItem('z_token'); } catch (e) {}
  return !!_token;
}

// is the session actually USABLE? verifies the token works against the server, so a
// stale/expired token can't fake a logged-in state (that was the blank "you" bug:
// a dead token existed -> app showed the house -> getMe() returned nothing -> "you"
// + empty chats). If the token is dead but a refresh succeeds, we're good; otherwise
// the caller should show the door, not a hollow house.
export async function isLoggedIn() {
  if (!(await hasStoredToken())) return false;
  try {
    const r = await fetch(`${API_BASE}/me`, { headers: headers() });
    if (r.ok) return true;              // token valid
    if (r.status === 401) {             // token dead -> try one refresh
      return await refreshSession();
    }
  } catch (e) {
    // network error: don't nuke a possibly-good session over a blip — treat as logged in
    // and let per-request 401 handling sort it out once connectivity returns.
    return true;
  }
  return false;
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
      if (phone) await AsyncStorage.setItem('z_phone', String(phone));
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

// SINGLE-FLIGHT refresh. Supabase rotates refresh tokens (each is single-use), so
// if several API calls hit 401 at once (e.g. on app open / after an OTA reload) and
// each fires its own refresh, they race: the first consumes the token, the rest send
// an already-used token and Supabase kills the whole session -> silent logout. Guard:
// the first caller runs the refresh and everyone else awaits the SAME promise.
let _refreshInFlight = null;

async function _doRefresh() {
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

export async function refreshSession() {
  // if a refresh is already running, everyone waits on it instead of starting their own
  if (_refreshInFlight) return _refreshInFlight;
  _refreshInFlight = _doRefresh().finally(() => { _refreshInFlight = null; });
  return _refreshInFlight;
}

// set the profile name (server wants it, esp. for rooms)
export async function getMe() {
  try {
    const me = await authedJSON('GET', '/me');
    try {
      if (me && typeof me.displayName === 'string') await AsyncStorage.setItem('z_name', me.displayName);
    } catch (e) {}
    return me;
  } catch (e) { return null; }
}

// last-known display name, read from cache to avoid the "you" placeholder flash.
export async function cachedName() {
  try { return (await AsyncStorage.getItem('z_name')) || ''; } catch (e) { return ''; }
}

// update the user's own profile: display name and/or avatar (data-URI) in one /me call.
// handle is set separately (it has its own uniqueness-checked endpoint).
export async function updateProfile({ displayName, avatarUrl }) {
  try {
    const body = {};
    if (typeof displayName === 'string') body.displayName = displayName;
    if (typeof avatarUrl === 'string') body.avatarUrl = avatarUrl;
    const call = () => fetch(`${API_BASE}/me`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });   // [zip10]
    let r = await call();
    if (r.status === 401 && (await refreshSession())) r = await call();
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'could not save' }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: 'no connection. try again.' }; }
}
export async function setMe(displayName) {
  try {
    const call = () => fetch(`${API_BASE}/me`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ displayName, region: 'IN', sex: 'na' }),
    });
    let r = await call();
    if (r.status === 401 && (await refreshSession())) await call();
  } catch (e) {}
}

export async function logout() {
  _token = null; _uid = null;
  try {
    await AsyncStorage.removeItem('z_token');
    await AsyncStorage.removeItem('z_refresh');
    await AsyncStorage.removeItem('z_exp');
    await AsyncStorage.removeItem('z_real_uid');
    await AsyncStorage.removeItem('z_name');
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
export async function streamChat({ threadId, message, image, persona, addressed, onToken, onRoutes, onDone, onError }) {
  await loadSession();
  try {
    const doFetch = () => fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ threadId, message, image, persona, addressed }),
    });
    let res = await doFetch();
    // stale token → refresh once and retry (else chat silently fails on expiry)
    if (res.status === 401 && (await refreshSession())) res = await doFetch();

    if (!res.ok) {
      let msg = '(z went quiet — try again)';
      try { const j = await res.json(); if (j.error) msg = '(' + j.error + ')'; } catch (_) {}
      // [zip16] never render provider JSON in a bubble, whatever the server sent
      if (/"type"\s*:\s*"error"|credit balance|rate limit|overloaded/i.test(msg)) msg = "(the house's mind is resting — give it a minute and try again.)";
      onError && onError(msg);
      return;
    }

    // React Native fetch supports streaming via res.body.getReader() on Hermes/新arch;
    // if not available, fall back to full-text read.
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '', acc = '', costMeta;
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
            else if (ev.done) { costMeta = ev.cost || costMeta; onDone && onDone(acc, ev.cost); }
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
      onDone && onDone(acc, costMeta);
    } else {
      // no streaming: read whole body, parse data: frames in one go
      const text = await res.text();
      let acc = '', costMeta;
      text.split('\n\n').forEach((chunk) => {
        chunk.split('\n').forEach((line) => {
          line = line.trim();
          if (!line.startsWith('data:')) return;
          const payload = line.slice(5).trim();
          if (!payload) return;
          let ev; try { ev = JSON.parse(payload); } catch (_) { return; }
          if (typeof ev.token === 'string') { acc += ev.token; onToken && onToken(acc); }
          else if (ev.routes) { onRoutes && onRoutes(ev.routes); }
          else if (ev.done) { costMeta = ev.cost || costMeta; }
          else if (ev.error) { onError && onError('(' + ev.error + ')'); }
        });
      });
      onDone && onDone(acc, costMeta);
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

export async function getPersonaStates() {
  try { const j = await authedJSON('GET', '/persona-states'); return j.states || {}; } catch (e) { return {}; }
}

export async function getArcs() {
  try { return await authedJSON('GET', '/arcs/mine'); } catch (e) { return { arcs: [], catalog: [] }; }
}
export async function startArc(arcId) {
  const r = await authedJSON('POST', '/arcs/start', { arcId });
  return r;
}

// ── multiplayer game sessions ──
export async function startGameSession(roomId, game, personaSeats = [], reserveSeat = false) {
  return authedJSON('POST', '/games/start', { roomId, game, personaSeats, reserveSeat: !!reserveSeat });
}
export async function getLiveGame(roomId) {
  try { return await authedJSON('GET', `/games/room/${roomId}/live`); } catch (e) { return {}; }
}
export async function getGameSession(id) {
  return authedJSON('GET', `/games/session/${id}`);
}
export async function claimGameSeat(id) {
  try { return await authedJSON('POST', `/games/session/${id}/claim`, {}); } catch (e) { return null; }
}
export async function sendGameMove(id, move, version) {
  return authedJSON('POST', `/games/session/${id}/move`, { move, version });
}

// start a practice-vs-house Battlefield duel → { sessionId, version }
export async function startBattlefieldPractice(motion, domain, difficulty) {
  const body = {};
  if (motion) body.motion = motion;
  if (domain) body.domain = domain;
  if (difficulty) body.difficulty = difficulty;
  return authedJSON('POST', '/battlefield/practice/start', body);
}
// the topic bank grouped by domain, for the practice picker → { domains:[{key,label,motions[]}], count }
export async function getBattlefieldMotions(tier) {
  return authedJSON('GET', '/battlefield/motions' + (tier ? ('?tier=' + tier) : ''));
}
// read-only spectator view of a duel (no seat required) → { motion, phase, turns, verdict, ... }
export async function watchBattlefieldDuel(sessionId) {
  return authedJSON('GET', `/battlefield/watch/${sessionId}`);
}

// ── the trading floor (paper trading — phantom money, real prices) ──
export async function simMarket() {
  try { return await authedJSON('GET', '/sim/market'); } catch (e) { return null; }
}
export async function simPortfolio() {
  try { return await authedJSON('GET', '/sim/portfolio'); } catch (e) { return null; }
}
export async function simTrade(symbol, side, qty) {
  return authedJSON('POST', '/sim/trade', { symbol, side, qty });
}
export async function simRemark() {
  try { return await authedJSON('POST', '/sim/remark'); } catch (e) { return null; }
}
export async function simLeaderboard() {
  try { return await authedJSON('GET', '/sim/leaderboard'); } catch (e) { return null; }
}
export async function simOracle() {
  try { return await authedJSON('GET', '/sim/oracle'); } catch (e) { return null; }
}

// ── build-a-persona: your own people ──
export async function composeCustomPersona(answers) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/personas/custom/compose`, { method: 'POST', headers: headers(), body: JSON.stringify(answers) });   // [zip10]
  let r = await call();
  if (r.status === 401 && (await refreshSession())) r = await call();
  return r.json().catch(() => ({ error: 'compose failed' }));
}
export async function saveCustomPersona(name, codex, tone) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/personas/custom`, { method: 'POST', headers: headers(), body: JSON.stringify({ name, codex, tone }) });   // [zip10]
  let r = await call();
  if (r.status === 401 && (await refreshSession())) r = await call();
  return r.json().catch(() => ({ error: 'save failed' }));
}
export async function listCustomPersonas() {
  try { return await authedJSON('GET', '/personas/custom'); } catch (e) { return { personas: [] }; }
}
export async function retireCustomPersona(key) {
  try { return await authedJSON('POST', `/personas/custom/${key}/retire`, {}); } catch (e) { return null; }
}

// ── thread prefs: pin / favourite / archive (per user) ──
export async function setThreadPrefs(threadId, prefs) {
  try { return await authedJSON('POST', '/thread/prefs', { threadId, ...prefs }); } catch (e) { return null; }
}

// ── fantasy football (house league — EPL + UCL, real data) ──
export async function ffStatus(league = 'epl') {
  try { return await authedJSON('GET', `/ff/status?league=${league}`); } catch (e) { return null; }
}
export async function ffPlayers(league = 'epl', q = '', pos = '') {
  try { return await authedJSON('GET', `/ff/players?league=${league}&q=${encodeURIComponent(q)}&pos=${encodeURIComponent(pos)}`); } catch (e) { return null; }
}
export async function ffSquad(league = 'epl') {
  try { return await authedJSON('GET', `/ff/squad?league=${league}`); } catch (e) { return null; }
}
export async function ffSaveSquad(league, playerIds, captain) {
  return authedJSON('POST', '/ff/squad', { league, playerIds, captain });
}
export async function ffLive(league = 'epl') {
  try { return await authedJSON('GET', `/ff/live?league=${league}`); } catch (e) { return null; }
}
export async function ffLeaderboard(league = 'epl') {
  try { return await authedJSON('GET', `/ff/leaderboard?league=${league}`); } catch (e) { return null; }
}

// ── the anchor's bulletin ──
// ── THE COACH ──
export async function coachStart(topic, days, opts = {}) { return authedJSON('POST', '/coach/start', { topic, days, ...opts }); }
export async function coachGet(id) { return authedJSON('GET', `/coach/${id}`); }
export async function coachLesson(id) { return authedJSON('POST', `/coach/${id}/lesson`); }
export async function coachQuiz(id, n) { return authedJSON('POST', `/coach/${id}/quiz`, { n }); }
export async function coachGrade(id, answers) { return authedJSON('POST', `/coach/${id}/grade`, { answers }); }
export async function coachAsk(id, question) { return authedJSON('POST', `/coach/${id}/ask`, { question }); }
export async function coachMockStart(id, n, minutes) { return authedJSON('POST', `/coach/${id}/mock/start`, { n, minutes }); }
export async function coachMockSubmit(id, mockId, answers) { return authedJSON('POST', `/coach/${id}/mock/${mockId}/submit`, { answers }); }
export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }
export async function coachLibrary() { return authedJSON('GET', '/coach/library'); }
export async function coachMaterial(id, filename, dataB64, mediaType) { return authedJSON('POST', `/coach/${id}/material`, { filename, dataB64, mediaType }); }

// ── SHOWS: Traitors + Story Collab ──
export async function traitorsStart(personas, opts) { return authedJSON('POST', '/games/traitors/start', { personas, ...(opts || {}) }); }
export async function traitorsStep(id, move) { return authedJSON('POST', `/games/traitors/${id}/step`, move || {}); }
export async function storyStart(personas, opts) { return authedJSON('POST', '/games/story/start', { personas, ...(opts || {}) }); }
export async function storyStep(id, text) { return authedJSON('POST', `/games/story/${id}/step`, text !== undefined ? { text } : {}); }
export async function storyPublish(id) { return authedJSON('POST', `/games/story/${id}/publish`, {}); }

export async function getBulletinFeed() {
  try { return await authedJSON('GET', '/bulletin'); } catch (e) { return null; }
}
export async function setBulletinCity(city) {
  return authedJSON('POST', '/bulletin/city', { city });
}

export async function acceptDropin(id) {
  return authedJSON('POST', `/dropin/${id}/accept`);
}
export async function ignoreDropin(id) {
  try { return await authedJSON('POST', `/dropin/${id}/ignore`); } catch (e) { return { ok: false }; }
}

export async function getRecentPings() {
  try { const j = await authedJSON('GET', '/pings/recent'); return j.pings || []; } catch (e) { return []; }
}

export async function getMemory() {
  try { const j = await authedJSON('GET', '/memory'); return j.items || []; } catch (e) { return []; }
}
// [zip18] what Z remembers, composed as a story in her voice (the quiet room's view)
export async function getMemoryStory() {
  try { return await authedJSON('GET', '/memory/story'); } catch (e) { return { error: 'no connection' }; }
}
export async function forgetMemory(id) {
  try { return await authedJSON('DELETE', `/memory/${id}`); } catch (e) { return null; }
}
export async function getJournal() {
  try { const j = await authedJSON('GET', '/journal'); return Array.isArray(j) ? j : (j.entries || []); } catch (e) { return []; }
}
export async function postJournalText(text) {
  try { return await authedJSON('POST', '/journal/text', { text }); } catch (e) { return null; }
}
export async function getPersonaDiary(key) {
  try { const j = await authedJSON('GET', `/persona-diary/${key}`); return { blurb: j.blurb || null, entries: j.entries || [] }; } catch (e) { return { blurb: null, entries: [] }; }
}
export async function getLedger() {
  try { return await authedJSON('GET', '/ledger'); } catch (e) { return { headline: null, week: null, feed: [] }; }
}

// ── favourites: pinned personas (persona keys, stored on the user) ──
// getPins → string[] of keys. togglePin(key, pinned) sets it explicitly (idempotent);
// returns the new full list, or null on failure so the caller can roll back.
export async function getPins() {
  try { const j = await authedJSON('GET', '/pins'); return j.pins || []; } catch (e) { return []; }
}
export async function togglePin(key, pinned) {
  try { const j = await authedJSON('POST', '/pins', { key, pinned }); return j.pins || []; } catch (e) { return null; }
}

// ── rename a companion (writes companion_name via the existing PATCH) ──
export async function renameThread(threadId, name) {
  try { return await authedJSON('PATCH', `/threads/${threadId}`, { name }); } catch (e) { return null; }
}

// ── set a custom avatar (a small data-URI string) via the same PATCH ──
export async function setThreadAvatar(threadId, avatar_url) {
  try { return await authedJSON('PATCH', `/threads/${threadId}`, { avatar_url }); } catch (e) { return null; }
}

// ── ROOMS ──
// daily, web-informed suggestions (topic + why + 3 personas), cached server-side.
export async function getRoomSuggestions() {
  try { const j = await authedJSON('GET', '/rooms/suggestions'); return j.items || []; } catch (e) { return []; }
}
// the rooms you're a member of → [{ id, name, personas, persona, last_active }]
export async function getThreads() {
  try { return await authedJSON('GET', '/threads'); } catch (e) { return []; }
}
export async function listRooms() {
  try { return await authedJSON('GET', '/rooms'); } catch (e) { return []; }
}
// create (or reuse) a shared room with these personas → { id, name, personas, persona }
export async function createRoom(name, personas) {
  try { return await authedJSON('POST', '/rooms', { name, personas }); } catch (e) { return null; }
}
// leave a room (removes you from it); delete a room you own (soft-delete the thread)
export async function leaveRoom(roomId) {
  try { return await authedJSON('POST', `/rooms/${roomId}/leave`, {}); } catch (e) { return null; }
}
export async function deleteRoomThread(roomId) {
  try { return await authedJSON('DELETE', `/threads/${roomId}`); } catch (e) { return null; }
}
// an invite link token for a room → { token }
export async function inviteToRoom(roomId) {
  try { return await authedJSON('POST', `/rooms/${roomId}/invite`, {}); } catch (e) { return null; }
}
// who's in the room → { members: { uid: name }, meId }
export async function getRoomMembers(roomId) {
  try { return await authedJSON('GET', `/rooms/${roomId}/members`); } catch (e) { return { members: {}, meId: null }; }
}
// a room's saved conversation → { messages: [...], meId }
export async function getRoomMessages(roomId) {
  try { return await authedJSON('GET', `/threads/${roomId}/messages`); } catch (e) { return { messages: [], meId: null }; }
}

// like openThread, but keeps the thread's saved identity (custom name / avatar)
// instead of discarding it — so a chat can show the name YOU gave, not the default.
export async function openThreadInfo(personaKey, name) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/threads`, {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ personaKey, name: name || personaKey }),
  });
  try {
    let r = await call();
    if (r.status === 401 && (await refreshSession())) r = await call();
    const j = await r.json().catch(() => ({}));
    const id = j.id || j.thread_id || null;
    if (id) return { id, name: j.companion_name || null, avatar: j.avatar_url || null };
  } catch (e) {}
  return null;
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

// ── clear a thread's history: the fix for a poisoned chat (spam loop, fixation) ──
export async function clearThread(threadId) {
  try { return await authedJSON('POST', '/thread/clear', { threadId }); } catch (e) { return null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  THE STAGE — roleplay transport. /roleplay/start creates the group thread;
//  streamStage POSTs the player's line and BUFFERS each speaker's complete
//  message (the beat-reveal law: the client holds beats; the thumb reveals).
//  SSE frames: {speaker,name} · {speaker,token} · {speaker,end} ·
//              {verdict:{outcome}} · {done} · {error}
// ══════════════════════════════════════════════════════════════════════════
export async function roleplayStart({ scenario, brief, cast }) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/roleplay/start`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ scenario, brief, cast }),
  });
  let r = await call();
  if (r.status === 401 && (await refreshSession())) r = await call();
  if (!r.ok) { let m = 'could not raise the curtain'; try { const j = await r.json(); if (j.error) m = j.error; } catch (_) {} throw new Error(m); }
  return r.json();   // { threadId, scenario, members }
}

export async function arenaStart({ game, personaKey }) {
  await loadSession();
  const call = () => fetch(`${API_BASE}/arena/start`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ game, personaKey }),
  });
  let r = await call();
  if (r.status === 401 && (await refreshSession())) r = await call();
  if (!r.ok) { let m = 'could not open the arena'; try { const j = await r.json(); if (j.error) m = j.error; } catch (_) {} throw new Error(m); }
  return r.json();   // { threadId, game, persona, members }
}

export async function streamStage({ threadId, message, onBeat, onVerdict, onTension, onComplication, onScore, onResult, onDone, onError }) {
  await loadSession();
  try {
    const doFetch = () => fetch(`${API_BASE}/chat`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ threadId, message }),
    });
    let res = await doFetch();
    if (res.status === 401 && (await refreshSession())) res = await doFetch();
    if (!res.ok) { onError && onError('(the stage went dark — try again)'); return; }

    let curKey = null, curName = null, acc = '', verdict = null;
    const pushBeat = () => {
      if (curKey && acc.trim()) onBeat && onBeat({ key: curKey, name: curName, text: acc.trim() });
      acc = '';
    };
    const handle = (ev) => {
      if (ev.speaker && ev.name && !ev.token && !ev.end) { pushBeat(); curKey = ev.speaker; curName = ev.name; }
      else if (ev.speaker && typeof ev.token === 'string') { acc += ev.token; }
      else if (ev.speaker && ev.end) { pushBeat(); curKey = null; }
      else if (ev.verdict) { verdict = ev.verdict; }
      else if (typeof ev.tension === 'number') { onTension && onTension(ev.tension); }
      else if (typeof ev.complication === 'string') { onComplication && onComplication(ev.complication); }
      else if (ev.score) { onScore && onScore(ev.score); }
      else if (ev.result) { onResult && onResult(ev.result); }
      else if (ev.error) { onError && onError('(' + ev.error + ')'); }
    };
    const parse = (text) => {
      text.split('\n\n').forEach((chunk) => chunk.split('\n').forEach((line) => {
        line = line.trim();
        if (!line.startsWith('data:')) return;
        const p = line.slice(5).trim(); if (!p) return;
        let ev; try { ev = JSON.parse(p); } catch (_) { return; }
        handle(ev);
      }));
    };
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader(); const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) { parse(buf.slice(0, i + 2)); buf = buf.slice(i + 2); }
      }
      if (buf) parse(buf + '\n\n');
    } else {
      parse(await res.text());
    }
    pushBeat();
    if (verdict) onVerdict && onVerdict(verdict);
    onDone && onDone();
  } catch (e) {
    onError && onError('(no connection — check your network)');
  }
}

// ---- VOICE: record → send raw audio bytes to the proven Sarvam endpoints ----
// Both /transcribe and /journal take a RAW audio body (express.raw({type:'audio/*'})).
// NATIVE: fetch(uri).blob() crashes on RN ("Creating blobs from 'ArrayBuffer'… not
// supported"), so we use expo-file-system's uploadAsync with BINARY_CONTENT — streams
// the file bytes as the raw body. expo-file-system is pinned by expo itself (in the APK).
// WEB: blob path works fine, kept as the branch.

async function postAudio(path, uri, mime) {
  await loadSession();
  const authHeaders = _token ? { Authorization: 'Bearer ' + _token } : {};

  if (Platform.OS !== 'web') {
    const doUpload = () => FileSystem.uploadAsync(`${API_BASE}${path}`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': mime || 'audio/mp4', ...authHeaders },
    });
    let r = await doUpload();
    if (r.status === 401 && (await refreshSession())) {
      const retryHeaders = _token ? { Authorization: 'Bearer ' + _token } : {};
      r = await FileSystem.uploadAsync(`${API_BASE}${path}`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { 'Content-Type': mime || 'audio/mp4', ...retryHeaders },
      });
    }
    const raw = r.body || '';
    let data = {};
    try { data = JSON.parse(raw); } catch (_) {}
    return { ok: r.status >= 200 && r.status < 300, status: r.status, data, raw };
  }

  // web: blob path (works in browsers; this is what the PWA-equivalent does)
  const res = await fetch(uri);
  const blob = await res.blob();
  const doPost = () => fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': mime || 'audio/mp4', ...(_token ? { Authorization: 'Bearer ' + _token } : {}) },
    body: blob,
  });
  let r = await doPost();
  if (r.status === 401 && (await refreshSession())) r = await doPost();
  const raw = await r.text();
  let data = {};
  try { data = JSON.parse(raw); } catch (_) {}
  return { ok: r.ok, status: r.status, data, raw };
}

// chat voice note: transcribe only, returns text for the composer. stores nothing.
export async function transcribeVoice(uri, mime) {
  const r = await postAudio('/transcribe', uri, mime);
  return { transcript: (r.data && r.data.transcript) || '', ok: r.ok, diag: r.raw ? r.raw.slice(0, 300) : '' };
}

// audio journal: stores AND transcribes server-side, returns the saved entry.
export async function postJournalAudio(uri, mime) {
  const r = await postAudio('/journal', uri, mime);
  return { entry: r.data || null, ok: r.ok, diag: r.raw ? r.raw.slice(0, 300) : '' };
}

// ---- FRIENDS v1 ----
export async function setHandle(handle) {
  try { return await authedJSON('POST', '/handle', { handle }); }
  catch (e) { return { error: String(e?.message || e) }; }
}
export async function findByHandle(handle) {
  try { return await authedJSON('GET', `/friends/find?handle=${encodeURIComponent(handle)}`); }
  catch (e) { return { error: String(e?.message || e) }; }
}
export async function requestFriend(userId) {
  try { return await authedJSON('POST', '/friends/request', { userId }); }
  catch (e) { return { error: String(e?.message || e) }; }
}
export async function respondFriend(fromId, action) {
  try { return await authedJSON('POST', '/friends/respond', { fromId, action }); }
  catch (e) { return { error: String(e?.message || e) }; }
}
export async function getFriends() {
  try { return await authedJSON('GET', '/friends'); }
  catch (e) { return { friends: [], incoming: [], outgoing: [] }; }
}

// ---- DM: open/create a 1:1 human chat with a friend, then it behaves like any thread ----
export async function openDM(friendId) {
  try { return await authedJSON('POST', `/dm/${encodeURIComponent(friendId)}`); }
  catch (e) { return { error: String(e?.message || e) }; }
}

export async function markThreadRead(threadId) {
  try { return await authedJSON('POST', `/threads/${threadId}/read`); } catch (e) { return null; }
}

// ---- PUBLIC ROOMS (communities) ----
export async function getPublicRooms() {
  try { return await authedJSON('GET', '/public-rooms'); } catch (e) { return []; }
}
export async function joinPublicRoom(roomId) {
  try { return await authedJSON('POST', `/public-rooms/${roomId}/join`); }
  catch (e) { return { error: String(e?.message || e) }; }
}

export async function createPublicRoom({ name, theme, personas }) {
  try { return await authedJSON('POST', '/public-rooms', { name, theme, personas }); }
  catch (e) { return { error: String(e?.message || e) }; }
}
export async function kickFromRoom(roomId, userId) {
  try { return await authedJSON('POST', `/public-rooms/${roomId}/kick`, { userId }); }
  catch (e) { return { error: String(e?.message || e) }; }
}

// TEMP DIAGNOSTIC — dumps the exact auth-storage state so we can see why PIN
// is / isn't offered. knownDevice() needs BOTH z_real_uid AND z_refresh.
export async function authDiag() {
  const g = async (k) => { try { return await AsyncStorage.getItem(k); } catch (e) { return null; } };
  const uid = await g('z_real_uid');
  const rt = await g('z_refresh');
  const tok = await g('z_token');
  const exp = await g('z_exp');
  const known = !!(uid && rt);
  return {
    z_real_uid: uid ? uid.slice(0, 8) + '…' : 'MISSING',
    z_refresh: rt ? 'present (' + rt.length + ' chars)' : 'MISSING',
    z_token: tok ? 'present' : 'MISSING',
    z_exp: exp ? new Date(Number(exp)).toLocaleTimeString() : 'MISSING',
    knownDevice: known ? 'YES → should offer PIN' : 'NO → forces OTP',
    why: known ? 'ok' : (!uid ? 'z_real_uid missing' : 'z_refresh missing'),
  };
}

// ── PRIVACY & DATA ──
// export everything we hold about the user (right to portability).
export async function exportMyData() {
  try {
    const call = () => fetch(`${API_BASE}/me/export`, { method: 'POST', headers: headers() });   // [zip10]
    let r = await call();
    if (r.status === 401 && (await refreshSession())) r = await call();
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'export failed' }; }
    return { ok: true, data: await r.json() };
  } catch (e) { return { ok: false, error: 'no connection. try again.' }; }
}

// soft-delete the account (inaccessible now, purged after 30 days). Needs confirm.
export async function deleteMyAccount() {
  try {
    const r = await fetch(`${API_BASE}/me/delete`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ confirm: 'DELETE' }),
    });
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'delete failed' }; }
    return { ok: true };
  } catch (e) { return { ok: false, error: 'no connection. try again.' }; }
}

// ── NOTIFICATIONS ──
export async function savePush({ pushToken, prefs }) {
  try {
    const body = {};
    if (pushToken) body.pushToken = pushToken;
    if (prefs) body.prefs = prefs;
    const r = await fetch(`${API_BASE}/me/push`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}
export async function getPushPrefs() {
  try { const j = await authedJSON('GET', '/me/push'); return j?.prefs || {}; } catch (e) { return {}; }
}

// the caller's phone (stored at login) — consult passes it to thedreamai for the meter
export async function myPhone() {
  try { return (await AsyncStorage.getItem('z_phone')) || ''; } catch (e) { return ''; }
}
