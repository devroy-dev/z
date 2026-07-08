// ════════════════════════════════════════════════════════════════════════
//  yourZ — useRoomFeed · THE CHAT CORE, LIFTED (R0)
//  RoomChat's device-proven realtime heart, moved verbatim: instant-paint from
//  the message snapshot, members+history load, broadcast subscribe with dedupe
//  (key = role:who:content), own-echo skip, typing-bubble fill-or-append with
//  the 2.5s Director-silence grace, floor tracking, rt diagnostics, debounced
//  snapshot writeback, and the send path (home-cache bump, @mention resolution
//  against the persona set, optimistic you-line).
//  Every room-shaped surface — DM, curated, public — rides this one hook.
// ════════════════════════════════════════════════════════════════════════
import { useEffect, useState, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { subscribeRoom, unsubscribe } from './realtime';
import { streamChat, getRoomMembers, getRoomMessages } from './api';
import { nameOf } from './roomTheme';

// [zip11] stamp last_active on this thread inside the home-list cache so the list
// paints in the right order the moment ChatHome remounts (fresh fetch reconciles).
async function bumpHomeCache(threadId) {
  if (!threadId) return;
  try {
    const c = await AsyncStorage.getItem('z_home_cache');
    if (!c) return;
    const s = JSON.parse(c);
    const now = new Date().toISOString();
    let hit = false;
    for (const t of (s.t || [])) if (t.id === threadId) { t.last_active = now; hit = true; }
    for (const r of (s.r || [])) if (r.id === threadId) { r.last_active = now; hit = true; }
    if (hit) await AsyncStorage.setItem('z_home_cache', JSON.stringify(s));
  } catch (e) {}
}

export default function useRoomFeed(roomId, { personas = [], isDM = false } = {}) {
  const [lines, setLines] = useState([]);
  const [booted, setBooted] = useState(false);
  const [members, setMembers] = useState({});
  const [avatars, setAvatars] = useState({});
  const [meId, setMeId] = useState(null);
  const [floor, setFloor] = useState(null);
  const [rt, setRt] = useState('connecting');
  const [rtCount, setRtCount] = useState(0);
  const [rtLast, setRtLast] = useState('');
  const [rtRendered, setRtRendered] = useState(0);
  const [sending, setSending] = useState(false);

  const renderedRef = useRef(new Set());
  const meIdRef = useRef(null);
  const pendingRef = useRef(null);
  const sendingRef = useRef(false);
  const graceRef = useRef(null);

  // load members + history, then subscribe. teardown on unmount / room change.
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    renderedRef.current = new Set();
    setBooted(false);
    AsyncStorage.getItem('z_msgs_room_' + roomId).then((c) => {
      try {
        if (c) {
          const cached = JSON.parse(c);
          if (Array.isArray(cached) && cached.length) setLines((cur) => (cur.length ? cur : cached));
        }
      } catch (e) {}
      setBooted(true);
    }).catch(() => setBooted(true));
    (async () => {
      const mem = await getRoomMembers(roomId);
      if (!alive) return;
      setMembers(mem.members || {});
      setAvatars(mem.avatars || {});
      meIdRef.current = mem.meId || null;
      setMeId(meIdRef.current);

      const hist = await getRoomMessages(roomId);
      if (!alive) return;
      meIdRef.current = hist.meId || meIdRef.current;
      setMeId(meIdRef.current);
      const seed = [];
      (hist.messages || []).forEach((m) => {
        const k = m.created_at || (m.role + ':' + (m.content || ''));
        renderedRef.current.add(k);
        if (m.role === 'user') {
          const mine = m.mine || (m.sender_user_id && m.sender_user_id === meIdRef.current);
          seed.push({ id: k, who: mine ? 'you' : 'human', uid: m.sender_user_id || null, name: m.sender_name || (mem.members || {})[m.sender_user_id] || 'someone', text: m.content || '', at: m.created_at });
        } else {
          seed.push({ id: k, who: 'them', key: m.persona_key, text: m.content || '', at: m.created_at });
        }
      });
      setLines(seed);
      const last = seed[seed.length - 1];
      if (last) setFloor(last.who === 'them' ? last.key : null);

      await subscribeRoom(roomId, (m) => {
        setRtCount((c) => c + 1);
        setRtLast(`${m.role || '?'}/${m.persona_key || m.sender_user_id || '?'}`);
        onLive(m);
      }, (status) => setRt(status));
    })();
    return () => { alive = false; unsubscribe(); if (graceRef.current) clearTimeout(graceRef.current); };
  }, [roomId]);

  // snapshot the settled room for the next instant paint (typing lines never cached).
  useEffect(() => {
    if (!lines.length) return;
    const t = setTimeout(() => {
      const snap = lines
        .filter((l) => l && l.text && !l.typing)
        .slice(-40)
        .map(({ id, who, key, name, text, at }) => ({ id, who, key, name, text, at }));
      if (snap.length) AsyncStorage.setItem('z_msgs_room_' + roomId, JSON.stringify(snap)).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [lines, roomId]);

  // the ported onLiveMessage: filter, dedup, skip own, fill-or-append.
  const onLive = useCallback((m) => {
    if (!m || String(m.thread_id) !== String(roomId)) return;
    const who = m.sender_user_id || m.persona_key || '';
    const key = m.role + ':' + who + ':' + (m.content || '');
    if (renderedRef.current.has(key)) return;
    renderedRef.current.add(key);
    if (m.role === 'user' && m.sender_user_id && meIdRef.current && m.sender_user_id === meIdRef.current) return;

    if (m.role === 'user') {
      setLines((cur) => [...cur, { id: key, who: 'human', uid: m.sender_user_id || null, name: members[m.sender_user_id] || m.sender_name || 'someone', text: m.content || '', at: m.created_at }]);   // [zip54p/57b] the stamp's fuel
      setFloor(m.sender_user_id || null);
    } else {
      if (pendingRef.current) {
        const pid = pendingRef.current; pendingRef.current = null;
        if (graceRef.current) { clearTimeout(graceRef.current); graceRef.current = null; }
        setLines((cur) => cur.map((l) => l.id === pid ? { ...l, key: m.persona_key, text: m.content || '', typing: false } : l));
      } else {
        setLines((cur) => [...cur, { id: key, who: 'them', key: m.persona_key, text: m.content || '' }]);
      }
      setFloor(m.persona_key || null);
    }
    setRtRendered((n) => n + 1);
  }, [roomId, members]);

  // the send path — @mention resolution + optimistic you-line + typing bubble
  // (rooms only) with the Director-silence grace. Returns immediately.
  const send = useCallback(({ text, image, addressed = [] }) => {
    const body = String(text || '').trim();
    if ((!body && !image) || sendingRef.current || !roomId) return false;
    sendingRef.current = true; setSending(true);
    void bumpHomeCache(roomId);
    const atKeys = personas.filter((k) => {
      const short = nameOf(k).replace(/^the /, '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`@\\s*(the\\s+)?${short}`, 'i').test(body);
    });
    const addr = [...new Set([...addressed, ...atKeys])];
    const myId = 'me_' + Date.now();
    const pid = 'p_' + Date.now();
    if (!isDM) pendingRef.current = pid;
    setLines((cur) => isDM
      ? [...cur, { id: myId, who: 'you', text: body, imageUri: image?.uri || null }]
      : [...cur, { id: myId, who: 'you', text: body, imageUri: image?.uri || null }, { id: pid, who: 'them', text: '', typing: true }]);
    streamChat({
      threadId: roomId, message: body,
      image: image ? { media_type: 'image/jpeg', data: image.data } : undefined,
      addressed: addr.length ? addr : undefined,
      onToken: () => {},
      onDone: () => {
        sendingRef.current = false; setSending(false);
        if (graceRef.current) clearTimeout(graceRef.current);
        graceRef.current = setTimeout(() => {
          if (pendingRef.current === pid) {
            pendingRef.current = null;
            setLines((cur) => cur.filter((l) => l.id !== pid));
          }
        }, 2500);
      },
      onError: () => {
        sendingRef.current = false; setSending(false);
        if (pendingRef.current === pid) { pendingRef.current = null; setLines((cur) => cur.filter((l) => l.id !== pid)); }
      },
    });
    return true;
  }, [roomId, personas, isDM, members]);

  return { lines, booted, members, avatars, meId, floor, rt, rtCount, rtLast, rtRendered, sending, send, setMembers };
}
