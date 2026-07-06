// ════════════════════════════════════════════════════════════════════════
//  yourZ — ROOM INTERIOR · NIGHTFALL · LIVE
//  Several presences share one space. Across the top: who's in the room — the
//  one who just spoke RISES and warms (the "risen speaker"), the rest rest.
//  Realtime is a faithful port of the PWA's tested pattern: the server
//  broadcasts each saved message; we dedup across broadcast + pg_changes
//  (key = role:who:content), skip our own echo, and fill the waiting typing
//  bubble with the persona reply (single source — no double render). When the
//  Director keeps the personas silent (humans talking to each other), no reply
//  comes — we drop the typing bubble after a short grace.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Share, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import VideoCall from './VideoCall';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import { startGameSession, getLiveGame, kickFromRoom, deleteRoomThread } from './api';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { subscribeRoom, unsubscribe } from './realtime';
import Grain from './Grain';
import { streamChat, getRoomMembers, getRoomMessages, inviteToRoom, API_BASE, transcribeVoice } from './api';
import { useVoiceNote } from './voice';
import AsyncStorage from '@react-native-async-storage/async-storage';   // [zip05] instant-paint cache
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

const fmtTime = (at) => { const d = at ? new Date(at) : null; return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''; };

const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)', moonFaint: 'rgba(233,232,240,0.30)',
  silver: '#9E9DB0', hair: 'rgba(233,232,240,0.10)',
  candle: '#E7B07A', candleHot: '#F3CFA3',
  human: '#9FB0CE',
};
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=4`;
const P = {
  the_guru:['the guru','230,190,90'], the_oracle:['the oracle','110,200,200'], the_brainiac:['the brainiac','90,200,230'],
  the_brother:['the brother','200,120,80'], the_healer:['the healer','124,92,220'], the_comic:['the comic','240,180,70'],
  the_mentor:['the motivator','230,190,110'], the_colleague:['the colleague','190,160,110'], the_philosopher:['the philosopher','180,160,210'],
  the_historian:['the historian','200,160,110'], the_cosmologist:['the cosmologist','120,140,230'], the_moderator:['the moderator','120,180,150'],
  the_cynic:['the cynic','150,150,150'], the_media_manager:['the media manager','230,140,170'], the_teacher:['the professor','120,190,170'],
  the_economist:['the economist','110,170,140'], the_leader_opp:['the leader of opposition','200,120,110'], the_wannabe:['the wannabe hustler','235,180,90'],
  the_screen_junkie:['the screen junkie','120,150,230'], the_orator:['the orator','210,150,90'], the_hippie:['the hippie','120,170,120'],
  the_diva:['the diva','210,90,150'], the_cousin:['the awkward cousin','150,160,190'],
};
const nameOf = (k) => (P[k] ? P[k][0] : (k || 'someone'));
const rgbOf = (k) => (P[k] ? P[k][1] : '231,176,122');

// ── a persona presence; rises + warms when it holds the floor ──
function RoomPresence({ pkey, active, targeted }) {
  const [ok, setOk] = useState(true);
  const breath = useSharedValue(1);
  const lift = useSharedValue(0);
  const tone = rgbOf(pkey);
  useEffect(() => { breath.value = withRepeat(withTiming(1.04, { duration: 3000 + (pkey.length % 5) * 200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 520, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 12 }, { scale: 0.9 + lift.value * 0.2 }], opacity: 0.5 + lift.value * 0.5 }));
  const halo = useAnimatedStyle(() => ({ opacity: lift.value * 0.9, transform: [{ scale: breath.value * (1 + lift.value * 0.15) }] }));
  const S = 50;
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
          <Svg width={S + 14} height={S + 14}>
            <Defs><RadialGradient id={`rh_${pkey}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={`rgb(${tone})`} stopOpacity="0.6" /><Stop offset="60%" stopColor={`rgb(${tone})`} stopOpacity="0.15" /><Stop offset="100%" stopColor={`rgb(${tone})`} stopOpacity="0" />
            </RadialGradient></Defs>
            <Circle cx={(S + 14) / 2} cy={(S + 14) / 2} r={(S + 14) / 2} fill={`url(#rh_${pkey})`} />
          </Svg>
        </Animated.View>
        <View style={[styles.rpFace, { width: S, height: S, borderRadius: S / 2, borderColor: `rgba(${tone},0.7)` }]}>
          {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: S / 2 }} onError={() => setOk(false)} />
              : <View style={{ width: '100%', height: '100%', backgroundColor: N.night2 }} />}
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: N.moon }, targeted && { color: N.candle }]} numberOfLines={1}>{targeted ? '● ' : ''}{nameOf(pkey).replace('the ', '')}</Text>
    </Animated.View>
  );
}

// ── a human presence (cooler than a persona) ──
function HumanPresence({ name, active }) {
  const lift = useSharedValue(0);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 420, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 12 }, { scale: 0.9 + lift.value * 0.2 }], opacity: 0.5 + lift.value * 0.5 }));
  const S = 50;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.humanFace, { width: S, height: S, borderRadius: S / 2, borderColor: active ? N.human : 'rgba(180,190,210,0.35)' }]}>
          <Text style={[styles.humanInitials, { color: active ? '#E8ECF4' : '#AEB6C6' }]}>{initials}</Text>
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: '#D8DEEA' }]} numberOfLines={1}>{(name || '').split(' ')[0]}</Text>
    </Animated.View>
  );
}

// ── the peer's DP for a 1:1 DM header: their photo if set, initials otherwise ──
function PeerDP({ name, avatar }) {
  const [ok, setOk] = React.useState(!!avatar);
  const S = 34;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: S, height: S, borderRadius: S / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(159,176,206,0.4)', backgroundColor: 'rgba(40,46,60,0.6)', alignItems: 'center', justifyContent: 'center' }}>
      {ok && avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
        : <Text style={{ fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: '#AEB6C6' }}>{initials}</Text>}
    </View>
  );
}

// ── a spoken line ──
// rooms are the WhatsApp-flat register: personas may emit *emphasis* markdown,
// which must never render raw. Same strip Chat.js applies to PLAIN personas.
const flat = (t) => String(t || '').replace(/\*\*?/g, '');
function RoomLine({ line, hideSpeaker }) {
  if (line.who === 'you') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-end' }]}>
        <View style={{ alignItems: 'flex-end', maxWidth: '84%' }}>
          {line.imageUri ? <Image source={{ uri: line.imageUri }} style={styles.sharedPhoto} /> : null}
          {line.text ? <View style={[styles.bubble, styles.bubbleYou, line.imageUri && { marginTop: 4 }]}><Text style={styles.bubbleText}>{line.text}</Text>{line.at ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}</View> : null}
        </View>
      </View>
    );
  }
  if (line.who === 'human') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
        <View style={{ maxWidth: '84%' }}>
          {!hideSpeaker ? <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text> : null}
          <View style={[styles.bubble, styles.bubbleHuman]}><Text style={styles.bubbleText}>{line.text}</Text></View>
        </View>
      </View>
    );
  }
  // persona
  return (
    <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '84%' }}>
        {line.key ? <Text style={[styles.speaker, { color: `rgb(${rgbOf(line.key)})` }]}>{nameOf(line.key)}</Text> : null}
        <View style={[styles.bubble, styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{line.typing && !line.text ? '•••' : flat(line.text)}</Text>{line.at && !line.typing ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export default function RoomChat({ room, onBack = () => {} }) {
  // ── live game session in this room ──
  const [liveSession, setLiveSession] = React.useState(null);   // session id in play view
  const [liveAvail, setLiveAvail] = React.useState(null);       // { id, game, status } — joinable
  React.useEffect(() => {
    let on = true;
    const check = async () => {
      try { const j = await getLiveGame(room.id); if (on && j?.id && j.status === 'live') setLiveAvail(j); else if (on) setLiveAvail(null); } catch (e) {}
    };
    check();
    const t = setInterval(check, 5000);
    return () => { on = false; clearInterval(t); };
  }, [room.id]);
  const [gameMenu, setGameMenu] = React.useState(false);
  const startLive = async (game) => {
    setGameMenu(false);
    try {
      const roomPersonas = (room.personas || []).slice(0, 3);
      const j = await startGameSession(room.id, game, roomPersonas);
      if (j?.sessionId) setLiveSession({ id: j.sessionId, game });
    } catch (e) {}
  };
  const roomId = room?.id;
  const personas = (room?.personas && room.personas.length) ? room.personas : (room?.persona ? [room.persona] : []);
  const title = room?.name || 'the room';
  const isDM = personas.length === 0;   // 1:1 human DM — render like the 1:1 chat, not a room

  const [lines, setLines] = useState([]);
  const [booted, setBooted] = useState(false);   // [zip07] cache read answered — empty line may render
  const [members, setMembers] = useState({});   // uid -> name
  const [avatars, setAvatars] = useState({});   // uid -> avatar_url
  const [inCall, setInCall] = useState(false);
  const [floor, setFloor] = useState(null);      // persona key or human uid who spoke last
  const [rt, setRt] = useState('connecting');    // DIAG: realtime channel status
  const [rtCount, setRtCount] = useState(0);     // DIAG: raw broadcasts received
  const [rtLast, setRtLast] = useState('');      // DIAG: role/persona of last received
  const [rtRendered, setRtRendered] = useState(0); // DIAG: how many actually painted
  const [addressed, setAddressed] = useState([]);  // personas you tapped/@mentioned for the next send
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const voice = useVoiceNote();
  const [transcribing, setTranscribing] = useState(false);
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);
  const renderedRef = useRef(new Set());         // dedup keys (stable across delivery paths)
  const meIdRef = useRef(null);
  const pendingRef = useRef(null);               // id of the waiting typing line
  const sendingRef = useRef(false);
  const graceRef = useRef(null);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  // load members + history, then subscribe. teardown on unmount / room change.
  useEffect(() => {
    if (!roomId) return;
    let alive = true;
    renderedRef.current = new Set();
    // [zip05] instant paint: last-known lines render NOW; the history fetch below
    // replaces them wholesale before the realtime subscribe starts — ordering safe.
    setBooted(false);   // [zip07] hold the empty line until the cache answers
    AsyncStorage.getItem('z_msgs_room_' + roomId).then((c) => {
      try {
        if (c) {
          const cached = JSON.parse(c);
          if (Array.isArray(cached) && cached.length) {
            setLines((cur) => (cur.length ? cur : cached));
            scrollDown();
          }
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

      const hist = await getRoomMessages(roomId);
      if (!alive) return;
      meIdRef.current = hist.meId || meIdRef.current;
      const seed = [];
      (hist.messages || []).forEach((m) => {
        const k = m.created_at || (m.role + ':' + (m.content || ''));
        renderedRef.current.add(k);
        if (m.role === 'user') {
          const mine = m.mine || (m.sender_user_id && m.sender_user_id === meIdRef.current);
          seed.push({ id: k, who: mine ? 'you' : 'human', name: m.sender_name || (mem.members || {})[m.sender_user_id] || 'someone', text: m.content || '', at: m.created_at });
        } else {
          seed.push({ id: k, who: 'them', key: m.persona_key, text: m.content || '', at: m.created_at });
        }
      });
      setLines(seed);
      const last = seed[seed.length - 1];
      if (last) setFloor(last.who === 'them' ? last.key : null);
      scrollDown();

      await subscribeRoom(roomId, (m) => {
        setRtCount((c) => c + 1);
        setRtLast(`${m.role || '?'}/${m.persona_key || m.sender_user_id || '?'}`);
        onLive(m);
      }, (status) => setRt(status));
    })();
    return () => { alive = false; unsubscribe(); if (graceRef.current) clearTimeout(graceRef.current); };
  }, [roomId]);

  // [zip05] snapshot the settled room for the next instant paint (typing lines never cached).
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
    if (m.role === 'user' && m.sender_user_id && meIdRef.current && m.sender_user_id === meIdRef.current) return; // my own echo

    if (m.role === 'user') {
      setLines((cur) => [...cur, { id: key, who: 'human', name: members[m.sender_user_id] || m.sender_name || 'someone', text: m.content || '' }]);
      setFloor(m.sender_user_id || null);
    } else {
      // persona reply: fill the waiting typing bubble if there is one (single source)
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
    scrollDown();
  }, [roomId, members]);

  const onMic = async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const r = await transcribeVoice(clip.uri, clip.mime);
        if (r.ok && r.transcript) setDraft((d) => (d ? d + ' ' : '') + r.transcript);
        else Alert.alert('couldn’t catch that', r.diag || 'no transcript came back — try again.');
      } catch (e) { Alert.alert('voice error', String(e?.message || e)); }
      setTranscribing(false);
    } else {
      await voice.start();
    }
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const b64 = res.assets[0].base64;
      setPendingImage({ data: b64, uri: `data:image/jpeg;base64,${b64}` });
    } catch (e) {}
  };

  const doSend = async () => {
    const text = draft.trim();
    const img = pendingImage;
    if ((!text && !img) || sendingRef.current || !roomId) return;
    sendingRef.current = true; setSending(true);
    void bumpHomeCache(roomId);   // [zip11] the list learns about this send immediately
    setDraft('');
    setPendingImage(null);
    // who did they address? tapped faces + @mentions in the text → those personas answer.
    const atKeys = personas.filter((k) => {
      const short = nameOf(k).replace(/^the /, '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`@\\s*(the\\s+)?${short}`, 'i').test(text);
    });
    const addr = [...new Set([...addressed, ...atKeys])];
    setAddressed([]);
    const myId = 'me_' + Date.now();
    const pid = 'p_' + Date.now();
    const isDM = personas.length === 0;   // a DM has no persona to reply → no typing bubble
    if (!isDM) pendingRef.current = pid;
    setLines((cur) => isDM
      ? [...cur, { id: myId, who: 'you', text, imageUri: img?.uri || null }]
      : [...cur, { id: myId, who: 'you', text, imageUri: img?.uri || null }, { id: pid, who: 'them', text: '', typing: true }]);
    scrollDown();
    // trigger the turn; ignore streamed tokens — realtime renders the saved reply once.
    streamChat({
      threadId: roomId, message: text,
      image: img ? { media_type: 'image/jpeg', data: img.data } : undefined,
      addressed: addr.length ? addr : undefined,
      onToken: () => {},
      onDone: () => {
        sendingRef.current = false; setSending(false);
        // if the Director kept everyone silent, no reply broadcasts — drop the typing bubble.
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
  };

  const doInvite = async () => {
    const r = await inviteToRoom(roomId);
    if (r && r.token) {
      const link = 'https://callmez.app/?join=' + r.token;
      try { await Share.share({ message: `come chat with me in "${title}" on yourZ: ${link}`, url: link }); } catch (e) {}
    }
  };

  const humans = Object.entries(members).filter(([uid]) => uid !== meIdRef.current).map(([id, name]) => ({ id, name }));
  const peer = humans[0] || null;
  const peerName = (peer && peer.name) || title;
  const peerAvatar = peer ? (avatars[peer.id] || null) : null;
  const doDeleteDM = () => {
    Alert.alert('delete this chat?', 'this removes the conversation for you. it can’t be undone.',
      [{ text: 'cancel', style: 'cancel' },
       { text: 'delete', style: 'destructive', onPress: async () => { try { await deleteRoomThread(room.id); } catch (e) {} onBack(); } }]);
  };
  // creator-as-moderator: the room's creator can remove a member (24h kick).
  const canModerate = !!room?.youCreated && !!room?.publicRoomId;
  const [rosterOpen, setRosterOpen] = useState(false);
  const [kicking, setKicking] = useState(null);
  const doKick = async (uid, name) => {
    if (kicking) return;
    setKicking(uid);
    const r = await kickFromRoom(room.publicRoomId, uid);
    setKicking(null);
    if (r && r.ok) {
      setMembers((m) => { const n = { ...m }; delete n[uid]; return n; });
      setRosterOpen(false);
    } else {
      alert((r && r.error) || 'could not remove them');
    }
  };

  if (inCall) return <VideoCall persona={{ key: (peer && peer.id) || 'peer', name: peerName, customPhoto: peerAvatar }} onEnd={() => setInCall(false)} />;

  return (
    <View style={styles.root}>
      <LinearGradient colors={isDM ? ['rgba(159,176,206,0.06)', 'rgba(159,176,206,0.02)', N.night] : [`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      {liveSession ? (
        liveSession.game === 'debate_duel' ? <DebateDuelLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'callbreak' ? <CallbreakLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'poker' ? <PokerLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'pusoy' ? <PusoyLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'ludo' ? <LudoLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : <LiarsDiceLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <SafeAreaView style={{ flex: 1, display: liveSession ? 'none' : 'flex' }} edges={['top', 'bottom']}>

        {gameMenu && !liveSession && (
          <View style={{ position: 'absolute', right: 16, top: 96, zIndex: 31, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(14,11,9,0.97)', overflow: 'hidden' }}>
            {[['debate_duel', '⚖️ debate duel'], ['liarsdice', "liar's dice"], ['callbreak', 'callbreak'], ['poker', "hold'em"], ['pusoy', 'pusoy dos'], ['ludo', 'ludo']].map(([id, name]) => (
              <Pressable key={id} onPress={() => startLive(id)} style={{ paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ fontFamily: 'Figtree_500Medium', color: 'rgba(245,236,225,0.9)', fontSize: 13 }}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {rosterOpen && canModerate && (
          <Pressable style={styles.rosterScrim} onPress={() => setRosterOpen(false)}>
            <Pressable style={styles.rosterSheet} onPress={(e) => e.stopPropagation?.()}>
              <Text style={styles.rosterTitle}>your room</Text>
              <Text style={styles.rosterSub}>tap someone to remove them for 24 hours.</Text>
              {humans.length ? humans.map((h) => (
                <View key={h.id} style={styles.rosterRow}>
                  <Text style={styles.rosterName} numberOfLines={1}>{h.name || 'someone'}</Text>
                  <Pressable style={styles.rosterKick} onPress={() => doKick(h.id, h.name)}>
                    <Text style={styles.rosterKickTxt}>{kicking === h.id ? '…' : 'remove'}</Text>
                  </Pressable>
                </View>
              )) : <Text style={styles.rosterEmpty}>no one else here yet.</Text>}
            </Pressable>
          </Pressable>
        )}
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          {isDM ? (
            <>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PeerDP name={peerName} avatar={peerAvatar} />
              <Text style={styles.roomTitle} numberOfLines={1}>{peerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable hitSlop={10} onPress={doDeleteDM}>
                <Svg width="19" height="19" viewBox="0 0 24 24" fill="none"><Path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke={N.moonDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></Svg>
              </Pressable>
              <Pressable hitSlop={10} style={styles.callBtn} onPress={() => setInCall(true)}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Path d="M15 10l4.5-3v10L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke="rgb(159,176,206)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></Svg>
              </Pressable>
            </View>
            </>
          ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            {personas.length ? (
              <Text style={styles.roomSub} numberOfLines={1}>
                {personas.map((k) => nameOf(k).replace('the ', '')).join(' · ')}
                {humans.length ? `  +  ${humans.map((h) => (h.name || '').split(' ')[0]).join(', ')}` : ''}
              </Text>
            ) : null}
          </View>
          )}
          {canModerate && !isDM ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>
              <Text style={{ fontSize: 12 }}>🛡️</Text>
              <Text style={styles.inviteText}>manage</Text>
            </Pressable>
          ) : null}
          {personas.length ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]}
              onPress={liveAvail ? () => setLiveSession({ id: liveAvail.id, game: liveAvail.game }) : () => setGameMenu((v) => !v)}>
              <Text style={{ fontSize: 12 }}>🎲</Text>
              <Text style={styles.inviteText}>{liveAvail ? 'join game' : 'play'}</Text>
            </Pressable>
          ) : null}
          {personas.length ? (
            <Pressable hitSlop={8} style={styles.inviteBtn} onPress={doInvite}>
              <Svg width="13" height="13" viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={N.candle} strokeWidth="2" strokeLinecap="round" /></Svg>
              <Text style={styles.inviteText}>invite</Text>
            </Pressable>
          ) : null}
        </View>

        {/* the presences — lit one rises (rooms only; a 1:1 DM has no rail) */}
        {!isDM && (
        <View style={styles.stage}>
          {personas.map((k) => (
            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>
              <RoomPresence pkey={k} active={floor === k} targeted={addressed.includes(k)} />
            </Pressable>
          ))}
          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={floor === h.id} />)}
        </View>
        )}

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.convo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {lines.length === 0
            ? (booted ? <Text style={styles.empty}>a shared room — say something to get it going.</Text> : null)
            : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={isDM} />)}
        </ScrollView>

        {pendingImage ? (
          <View style={styles.pendingStrip}>
            <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} />
            <Pressable onPress={() => setPendingImage(null)} style={styles.pendingX} hitSlop={8}><Text style={styles.pendingXTxt}>✕</Text></Pressable>
          </View>
        ) : null}
        <View style={styles.composer}>
          <View style={[styles.field, { flexDirection: 'row', alignItems: 'flex-end' }]}>
            <TextInput value={draft} onChangeText={setDraft} placeholder={voice.recording ? 'listening…' : 'say something to the room…'} placeholderTextColor={N.moonFaint} style={[styles.input, { flex: 1 }]} multiline editable={!sending} />
            <Pressable style={styles.inlineBtn} onPress={pickPhoto} disabled={sending} hitSlop={6}>
              <Text style={styles.inlineBtnTxt}>＋</Text>
            </Pressable>
            <Pressable style={styles.inlineBtn} onPress={onMic} disabled={sending || transcribing} hitSlop={6}>
              <Text style={[styles.inlineMicTxt, voice.recording && styles.micBtnLive]}>{transcribing ? '…' : voice.recording ? '■' : '🎤'}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.send} onPress={doSend}>
            <Svg width="46" height="46" viewBox="0 0 46 46">
              <Defs><RadialGradient id="rsend" cx="42%" cy="36%" r="66%"><Stop offset="0%" stopColor={N.candleHot} /><Stop offset="52%" stopColor={N.candle} /><Stop offset="100%" stopColor="#c88a4f" /></RadialGradient></Defs>
              <Circle cx="23" cy="23" r="17" fill="url(#rsend)" />
              <Path d="M16 23 L30 17 L25.5 30 L22 24.5 Z" fill="#2a1c10" />
            </Svg>
          </Pressable>
        </View>
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(159,176,206,0.35)', backgroundColor: 'rgba(255,255,255,0.02)' },
  roomTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 19 },
  roomSub: { fontFamily: 'Figtree_300Light', color: N.moonDim, fontSize: 12, marginTop: 1 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(231,176,122,0.3)', backgroundColor: 'rgba(231,176,122,0.06)' },
  inviteText: { fontFamily: 'Figtree_500Medium', color: N.candle, fontSize: 12 },

  stage: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', minHeight: 112, paddingHorizontal: 12, paddingTop: 8 },
  rpWrap: { alignItems: 'center', width: 78 },
  rpFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: N.night2 },
  rpName: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 11.5, marginTop: 6 },
  humanFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: 'rgba(40,46,60,0.6)' },
  humanInitials: { fontFamily: 'Figtree_600SemiBold', fontSize: 16 },

  convo: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12 },
  empty: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moonFaint, fontSize: 14, textAlign: 'center', marginTop: 30 },
  lineRow: { flexDirection: 'row', marginBottom: 9 },
  speaker: { fontFamily: 'Figtree_500Medium', fontSize: 12, marginBottom: 4, marginLeft: 4, letterSpacing: 0.3 },
  bubble: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 15 },
  bubbleThem: { backgroundColor: 'rgba(233,232,240,0.05)', borderWidth: 1, borderColor: N.hair, borderTopLeftRadius: 6 },
  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderTopRightRadius: 5 },
  bubbleHuman: { backgroundColor: 'rgba(159,176,206,0.10)', borderWidth: 1, borderColor: 'rgba(159,176,206,0.2)', borderTopLeftRadius: 6 },
  bubbleText: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 14.5, lineHeight: 19 },
  stamp: { fontFamily: 'Figtree_300Light', color: 'rgba(233,232,240,0.28)', fontSize: 9.5, marginTop: 2, alignSelf: 'flex-end' },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 },
  inlineBtn: { paddingHorizontal: 8, paddingBottom: 10, alignItems: 'center', justifyContent: 'flex-end' },
  inlineBtnTxt: { fontSize: 23, color: '#F0A765', lineHeight: 25 },
  inlineMicTxt: { fontSize: 16, color: '#F0A765', lineHeight: 22 },
  micBtnLive: { color: '#FF6B5A', fontSize: 18 },
  sharedPhoto: { width: 190, height: 190, borderRadius: 16, resizeMode: 'cover' },
  pendingStrip: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row' },
  pendingThumb: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover' },
  pendingX: { position: 'absolute', left: 62, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  pendingXTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  field: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 110 },
  send: { width: 46, height: 46 },
  rosterScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  rosterSheet: { width: '100%', borderRadius: 18, backgroundColor: N.night2, borderWidth: 1, borderColor: N.hair, padding: 18 },
  rosterTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 20 },
  rosterSub: { fontFamily: 'Figtree_400Regular', color: N.moonDim, fontSize: 13, marginTop: 3, marginBottom: 14 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: N.hair },
  rosterName: { fontFamily: 'Figtree_500Medium', color: N.moon, fontSize: 15, flex: 1 },
  rosterKick: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(220,120,120,0.5)' },
  rosterKickTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 12.5 },
  rosterEmpty: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 13, paddingVertical: 12, textAlign: 'center' },
});
