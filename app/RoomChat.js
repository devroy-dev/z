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
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import { startGameSession, getLiveGame } from './api';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { subscribeRoom, unsubscribe } from './realtime';
import Grain from './Grain';
import { streamChat, getRoomMembers, getRoomMessages, inviteToRoom, API_BASE } from './api';
const fmtTime = (at) => { const d = at ? new Date(at) : null; return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''; };

const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)', moonFaint: 'rgba(233,232,240,0.30)',
  silver: '#9E9DB0', hair: 'rgba(233,232,240,0.10)',
  candle: '#E7B07A', candleHot: '#F3CFA3',
  human: '#9FB0CE',
};
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=2`;
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

// ── a spoken line ──
function RoomLine({ line }) {
  if (line.who === 'you') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-end' }]}>
        <View style={[styles.bubble, styles.bubbleYou]}><Text style={styles.bubbleText}>{line.text}</Text>{line.at ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}</View>
      </View>
    );
  }
  if (line.who === 'human') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
        <View style={{ maxWidth: '84%' }}>
          <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text>
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
          <Text style={styles.bubbleText}>{line.typing && !line.text ? '•••' : line.text}</Text>{line.at && !line.typing ? <Text style={styles.stamp}>{fmtTime(line.at)}</Text> : null}
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

  const [lines, setLines] = useState([]);
  const [members, setMembers] = useState({});   // uid -> name
  const [floor, setFloor] = useState(null);      // persona key or human uid who spoke last
  const [rt, setRt] = useState('connecting');    // DIAG: realtime channel status
  const [rtCount, setRtCount] = useState(0);     // DIAG: raw broadcasts received
  const [rtLast, setRtLast] = useState('');      // DIAG: role/persona of last received
  const [rtRendered, setRtRendered] = useState(0); // DIAG: how many actually painted
  const [addressed, setAddressed] = useState([]);  // personas you tapped/@mentioned for the next send
  const [draft, setDraft] = useState('');
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
    (async () => {
      const mem = await getRoomMembers(roomId);
      if (!alive) return;
      setMembers(mem.members || {});
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

  const doSend = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current || !roomId) return;
    sendingRef.current = true; setSending(true);
    setDraft('');
    // who did they address? tapped faces + @mentions in the text → those personas answer.
    const atKeys = personas.filter((k) => {
      const short = nameOf(k).replace(/^the /, '').toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`@\\s*(the\\s+)?${short}`, 'i').test(text);
    });
    const addr = [...new Set([...addressed, ...atKeys])];
    setAddressed([]);
    const myId = 'me_' + Date.now();
    const pid = 'p_' + Date.now();
    pendingRef.current = pid;
    setLines((cur) => [...cur, { id: myId, who: 'you', text }, { id: pid, who: 'them', text: '', typing: true }]);
    scrollDown();
    // trigger the turn; ignore streamed tokens — realtime renders the saved reply once.
    streamChat({
      threadId: roomId, message: text,
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

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      {liveSession ? (
        liveSession.game === 'debate_duel' ? <DebateDuelLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'callbreak' ? <CallbreakLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'poker' ? <PokerLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'pusoy' ? <PusoyLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'ludo' ? <LudoLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : <LiarsDiceLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
      ) : null}
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
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.roomSub} numberOfLines={1}>
              {personas.map((k) => nameOf(k).replace('the ', '')).join(' · ')}
              {humans.length ? `  +  ${humans.map((h) => (h.name || '').split(' ')[0]).join(', ')}` : ''}
            </Text>
            <Text style={{ fontFamily: 'Figtree_400Regular', fontSize: 10, marginTop: 1, color: rt === 'SUBSCRIBED' ? '#6FE0A0' : '#E0A76F' }} numberOfLines={1}>
              rt: {String(rt)} · {rtCount} rcvd · {rtRendered} shown · last: {rtLast || '—'}
            </Text>
          </View>
          <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]}
            onPress={liveAvail ? () => setLiveSession({ id: liveAvail.id, game: liveAvail.game }) : () => setGameMenu((v) => !v)}>
            <Text style={{ fontSize: 12 }}>🎲</Text>
            <Text style={styles.inviteText}>{liveAvail ? 'join game' : 'play'}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={styles.inviteBtn} onPress={doInvite}>
            <Svg width="13" height="13" viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={N.candle} strokeWidth="2" strokeLinecap="round" /></Svg>
            <Text style={styles.inviteText}>invite</Text>
          </Pressable>
        </View>

        {/* the presences — lit one rises */}
        <View style={styles.stage}>
          {personas.map((k) => (
            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>
              <RoomPresence pkey={k} active={floor === k} targeted={addressed.includes(k)} />
            </Pressable>
          ))}
          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={floor === h.id} />)}
        </View>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={styles.convo} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {lines.length === 0
            ? <Text style={styles.empty}>a shared room — say something to get it going.</Text>
            : lines.map((l) => <RoomLine key={l.id} line={l} />)}
        </ScrollView>

        <View style={styles.composer}>
          <View style={styles.field}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="say something to the room…" placeholderTextColor={N.moonFaint} style={styles.input} multiline editable={!sending} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },
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
  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderBottomRightRadius: 5, maxWidth: '84%' },
  bubbleHuman: { backgroundColor: 'rgba(159,176,206,0.10)', borderWidth: 1, borderColor: 'rgba(159,176,206,0.2)', borderTopLeftRadius: 6 },
  bubbleText: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 14.5, lineHeight: 19 },
  stamp: { fontFamily: 'Figtree_300Light', color: 'rgba(233,232,240,0.28)', fontSize: 9.5, marginTop: 2, alignSelf: 'flex-end' },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 },
  field: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 110 },
  send: { width: 46, height: 46 },
});
