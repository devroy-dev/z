// ════════════════════════════════════════════════════════════════════════
//  yourZ — CHAT MODE. The Moonlight register: cold ink where Play is warm
//  ember. WhatsApp grammar: the pinned trinity (News · Front Desk · Z),
//  then recents — personas and rooms as one list. Inner tabs: Chats ·
//  Updates · Groups · Rooms.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState, useRef } from 'react';   // [zip53]
import { TextInput } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse, Path as SvgPath } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, Easing, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';   // [zip17] the quiet pull
import { Dimensions } from 'react-native';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, RefreshControl, Alert, Linking } from 'react-native';   // [zip67]
import { FONTS } from './theme';
import { getThreads, listRooms, getPersonaStates, getPersonaDiary, API_BASE, getFriends, openDM, setThreadPrefs, getPublicRooms, joinPublicRoom, createPublicRoom, deleteRoomThread, getMe, getBulletinFeed, getMmDeskNotes, getWireFeed } from './api';   // [zip12] [zip66] [zip67]
import { subscribeInbox, unsubscribeInbox } from './realtime';   // [zip53] the live list
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Rooms from './Rooms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { personaMeta } from './games/personas';

// ── MOONLIGHT: the cold register ──
export const MOON = {
  ground: '#090C12',
  raise: '#0E1219',
  hair: 'rgba(159,194,232,0.10)',
  hairStrong: 'rgba(159,194,232,0.22)',
  porcelain: '#E4EAF2',
  mist: 'rgba(228,234,242,0.55)',
  faint: 'rgba(228,234,242,0.32)',
  moon: '#9FC2E8',
  moonDeep: '#6E93BD',
};

function DeskEmber() {
  const b = useSharedValue(0.5);
  React.useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const a = useAnimatedStyle(() => ({ opacity: 0.7 + b.value * 0.3, transform: [{ scale: 0.92 + b.value * 0.12 }] }));
  return (
    <Animated.View style={a}>
      <Svg width="30" height="30" viewBox="0 0 30 30"><Defs><RadialGradient id="dsk" cx="40%" cy="34%" r="70%">
        <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="50%" stopColor="#E7B07A" /><Stop offset="100%" stopColor="#8A5A2B" />
      </RadialGradient></Defs><Circle cx="15" cy="15" r="11" fill="url(#dsk)" /></Svg>
    </Animated.View>
  );
}

// THE CONSULTANT's DP — the DreamAI lockup exactly as it renders at the top-left of the
// Consult page: the ember dot + "the"(light serif) + "dreamai"(italic serif), cream on
// the deep-blue ground. The real in-app mark, not a screenshot — sized for the avatar.
function ConsultLogo() {
  return (
    <View style={st.consultDP}>
      <View style={st.consultDot} />
      <Text style={st.consultWord} numberOfLines={1} adjustsFontSizeToFit>
        the<Text style={st.consultWordIt}>dreamai</Text>
      </Text>
    </View>
  );
}

function ZOrb({ size = 44 }) {
  const b = useSharedValue(0.5);
  React.useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 4600, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + b.value * 0.45, transform: [{ scale: 0.94 + b.value * 0.1 }] }));
  const core = useAnimatedStyle(() => ({ opacity: 0.8 + b.value * 0.2, transform: [{ scale: 0.94 + b.value * 0.1 }] }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute' }, halo]}>
        <Svg width={size * 1.5} height={size * 1.5}><Defs><RadialGradient id="zh" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8F9FE8" stopOpacity="0.4" /><Stop offset="100%" stopColor="#8F9FE8" stopOpacity="0" />
        </RadialGradient></Defs><Circle cx={size * 0.75} cy={size * 0.75} r={size * 0.75} fill="url(#zh)" /></Svg>
      </Animated.View>
      <Animated.View style={core}>
        <Svg width={size * 0.62} height={size * 0.62} viewBox="0 0 40 40"><Defs><RadialGradient id="zc" cx="38%" cy="32%" r="72%">
          <Stop offset="0%" stopColor="#E8EEFF" /><Stop offset="50%" stopColor="#9FB2E8" /><Stop offset="100%" stopColor="#5E6FA8" />
        </RadialGradient></Defs><Circle cx="20" cy="20" r="15" fill="url(#zc)" /></Svg>
      </Animated.View>
    </View>
  );
}

const dpFor = (k) => `${API_BASE}/faces/${k}.jpg?v=6`;   // [zip54r]

// the house diaries, as a feed: today's line per resident; tap → their recent week
function UpdatesFeed({ onOpen, embedded = false }) {   // [zip61] embedded on the Desk
  const [states, setStates] = useState({});
  const [open, setOpen] = useState(null);        // persona key unfolded
  const [diary, setDiary] = useState({});        // key -> entries
  useEffect(() => { getPersonaStates().then(setStates); }, []);
  const keys = Object.keys(states);
  const unfold = async (k) => {
    if (open === k) return setOpen(null);
    setOpen(k);
    if (!diary[k]) { const e = await getPersonaDiary(k); setDiary((d) => ({ ...d, [k]: (e && e.entries) ? e.entries : [] })); }
  };
  if (!keys.length) return <View style={st.soonWrap}><Text style={st.soonLine}>the house is quiet — diaries arrive with the morning.</Text></View>;
  return (
    <ScrollView style={embedded ? undefined : { flex: 1 }} scrollEnabled={!embedded} contentContainerStyle={{ paddingBottom: embedded ? 8 : 90, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
      {keys.map((k) => (
        <View key={k}>
          <Pressable style={st.updRow} onPress={() => unfold(k)}>
            <View style={st.updRing}><Image source={{ uri: dpFor(k) }} style={st.updFace} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.updName}>{nameOf(k)}</Text>
              <Text style={st.updLine} numberOfLines={open === k ? 4 : 2}>{states[k]?.status_line}</Text>
            </View>
          </Pressable>
          {open === k && (
            <View style={st.updDiary}>
              {(diary[k] || []).slice(1).map((e) => (
                <View key={e.date} style={{ marginBottom: 10 }}>
                  <Text style={st.updDate}>{e.date}</Text>
                  <Text style={st.updEntry}>{e.log_entry}</Text>
                </View>
              ))}
              {!(diary[k] || []).length && <Text style={st.updEntry}>fetching their week…</Text>}
              <Pressable onPress={() => onOpen({ kind: 'persona', key: k })}><Text style={st.updGo}>message {nameOf(k)} ›</Text></Pressable>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}
const nameOf = (k) => (personaMeta(k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));

// the communities directory — curated public rooms anyone can join. Opens the
// existing group-chat surface (RoomChat) pointed at the room's shared thread.
function PublicRooms({ onOpen }) {
  const [rooms, setRooms] = useState(null);
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTheme, setNewTheme] = useState('');
  const [saving, setSaving] = useState(false);
  const reload = () => getPublicRooms().then((r) => setRooms(Array.isArray(r) ? r : []));
  useEffect(() => { reload(); }, []);
  const enter = async (room) => {
    if (busy) return;
    setBusy(room.id);
    try {
      let threadId = room.threadId;
      if (!room.joined) {
        const j = await joinPublicRoom(room.id);
        if (j && j.threadId) threadId = j.threadId;
      }
      if (threadId) onOpen({ kind: 'room', room: { id: threadId, name: room.name, personas: room.personas || [], publicRoomId: room.id, youCreated: !!room.youCreated } });
    } catch (e) {}
    setBusy(null);
  };
  const doCreate = async () => {
    const name = newName.trim();
    if (name.length < 3 || saving) return;
    setSaving(true);
    const r = await createPublicRoom({ name, theme: newTheme.trim(), personas: [] });
    setSaving(false);
    if (r && r.threadId) {
      setCreating(false); setNewName(''); setNewTheme('');
      onOpen({ kind: 'room', room: { id: r.threadId, name: r.name, personas: [] } });
    } else {
      alert((r && r.error) || 'could not create the room');
    }
  };
  if (rooms === null) return (
    <View style={st.soonWrap}><Text style={st.soonLine}>opening the doors…</Text></View>
  );
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 90, paddingTop: 6 }} showsVerticalScrollIndicator={false}>
      <Text style={st.commHead}>communities</Text>
      <Text style={st.commSub}>open rooms — jump in, meet the regulars, keep it civil.</Text>

      {creating ? (
        <View style={st.createCard}>
          <TextInput value={newName} onChangeText={setNewName} placeholder="room name — e.g. delhi foodies" placeholderTextColor={MOON.faint} style={st.createInput} maxLength={60} />
          <TextInput value={newTheme} onChangeText={setNewTheme} placeholder="what's it about? (optional)" placeholderTextColor={MOON.faint} style={[st.createInput, { marginTop: 8 }]} maxLength={200} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, gap: 10 }}>
            <Pressable onPress={() => { setCreating(false); setNewName(''); setNewTheme(''); }}><Text style={st.createCancel}>cancel</Text></Pressable>
            <Pressable onPress={doCreate} style={st.createBtn}><Text style={st.createBtnTxt}>{saving ? '…' : 'create'}</Text></Pressable>
          </View>
        </View>
      ) : (
        <Pressable style={st.createRow} onPress={() => setCreating(true)}>
          <Text style={st.createPlus}>＋</Text>
          <Text style={st.createRowTxt}>create a room — your locality, meetup, or interest</Text>
        </Pressable>
      )}

      {(rooms || []).map((room) => (
        <Pressable key={room.id} style={st.commCard} onPress={() => enter(room)}>
          <View style={st.commFaces}>
            {(room.personas || []).slice(0, 2).map((k, i) => (
              <Image key={k} source={{ uri: dpFor(k) }} style={[st.commFace, i > 0 && { marginLeft: -12 }]} />
            ))}
            {(!room.personas || !room.personas.length) && <View style={[st.commFace, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(159,194,232,0.1)' }]}><Text style={{ color: MOON.moon, fontSize: 18 }}>◇</Text></View>}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={st.commName} numberOfLines={1}>{room.name}{room.youCreated ? '  ·  yours' : ''}</Text>
            <Text style={st.commTheme} numberOfLines={2}>{room.theme}</Text>
            <Text style={st.commMeta}>{room.memberCount || 0} in the room{room.isHouse ? ' · a house room' : ''}</Text>
          </View>
          <Text style={st.commGo}>{busy === room.id ? '…' : room.joined ? 'open' : 'join'}</Text>
        </Pressable>
      ))}
      {(!rooms || !rooms.length) && <Text style={[st.commSub, { textAlign: 'center', marginTop: 30 }]}>no rooms yet — be the first to create one.</Text>}
    </ScrollView>
  );
}

const ago = (t) => {
  if (!t) return '';
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (m < 1440) return Math.floor(m / 60) + 'h';
  return Math.floor(m / 1440) + 'd';
};

function Row({ face, glyph, tone, name, line, time, pinned, unread, onPress }) {
  return (
    <Pressable style={st.row} onPress={onPress}>
      <View style={[st.ring, tone && { borderColor: tone }]}>
        {face ? <Image source={{ uri: face }} style={st.face} /> : <Text style={st.glyph}>{glyph}</Text>}
      </View>
      <View style={{ flex: 1, marginLeft: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={[st.name, unread ? st.nameUnread : null]} numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={st.time}>{pinned ? '📌' : time}</Text>
            {unread ? <View style={st.badge}><Text style={st.badgeTxt}>{unread > 9 ? '9+' : unread}</Text></View> : null}
          </View>
        </View>
        <Text style={[st.line, unread ? st.lineUnread : null]} numberOfLines={1}>{line}</Text>
      </View>
    </Pressable>
  );
}

export default function ChatHome({ onOpen = () => {} }) {
  const [tab, setTab] = useState('thedesk');   // [zip61] the house opens onto the Desk
  // ── [zip17] THE QUIET PULL: swipe right anywhere on the list → the world dims
  // and slides → Z. Rightward-only (+16dx to activate, so the OS left-edge back
  // gesture and the leftward row-swipes keep their lanes; failOffsetY yields to
  // vertical scroll). The moon sliver is the standing hint + tap entry.
  const SCREEN_W = Dimensions.get('window').width;
  const pullX = useSharedValue(0);
  const [quietHint, setQuietHint] = useState(false);
  const [wireItems, setWireItems] = useState([]);     // [zip67] the desk's ribbon
  const [wireIdx, setWireIdx] = useState(0);
  const [deskNote, setDeskNote] = useState(null);     // [zip66]
  const [deskQ, setDeskQ] = useState('');   // [zip68]
  const [wireTick, setWireTick] = useState(0);   // [zip68]
  useEffect(() => {
    AsyncStorage.getItem('z_quiet_hint_done').then((v) => { if (!v) setQuietHint(true); }).catch(() => {});

  }, []);
  const openQuiet = () => {
    pullX.value = 0;
    if (quietHint) { setQuietHint(false); AsyncStorage.setItem('z_quiet_hint_done', '1').catch(() => {}); }
    onOpen({ kind: 'z' });
  };
  // [zip67] the desk refetches every time it gains focus; the ribbon turns on a 6s beat
  useEffect(() => {
    if (tab !== 'thedesk') return;
    getWireFeed().then((r) => { if (r?.items?.length) { setWireItems(r.items); setWireIdx(0); } }).catch(() => {});
    getMmDeskNotes().then((r) => { const n0 = r?.notes && r.notes[0]; if (n0?.note) setDeskNote(String(n0.note)); }).catch(() => {});
    const __wt = setInterval(() => setWireTick((n) => n + 1), 5000);   // [zip68]
    return () => clearInterval(__wt);
  }, [tab]);
  useEffect(() => {
    if (tab !== 'thedesk' || wireItems.length < 2) return;
    const iv = setInterval(() => setWireIdx((x) => x + 1), 6000);
    return () => clearInterval(iv);
  }, [tab, wireItems]);
  const quietPan = Gesture.Pan()
    .enabled(tab === 'thedesk')   // [zip19] [zip64] the quiet room sits left of the Desk — the leftmost pull, the spatial line restored
    .activeOffsetX(16)
    .failOffsetX(-12)
    .failOffsetY([-14, 14])
    .onUpdate((e) => { pullX.value = Math.max(0, e.translationX); })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.28 || e.velocityX > 900) {
        pullX.value = withTiming(SCREEN_W, { duration: 160 }, () => { runOnJS(openQuiet)(); });
      } else {
        pullX.value = withSpring(0, { damping: 18, stiffness: 180 });
      }
    });
  const pullSlide = useAnimatedStyle(() => ({ transform: [{ translateX: pullX.value * 0.55 }] }));
  const pullVeil = useAnimatedStyle(() => ({ opacity: Math.min(1, (pullX.value / SCREEN_W) * 1.5) }));
  const sliverBreath = useSharedValue(0.5);
  useEffect(() => { sliverBreath.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const sliverStyle = useAnimatedStyle(() => ({ opacity: 0.25 + sliverBreath.value * 0.35 }));
  const [threads, setThreads] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState('');
  const [filt, setFilt] = useState('all');
  const [zFace, setZFace] = useState(true);
  const [deskFace, setDeskFace] = useState(true);
  const [friendList, setFriendList] = useState([]);
  const [opening, setOpening] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, r, f] = await Promise.all([getThreads(), listRooms(), getFriends()]);
      const tt = Array.isArray(t) ? t : [];
      const rr = Array.isArray(r) ? r : (r?.rooms || []);
      setThreads(tt);
      setRooms(rr);
      setFriendList((f && f.friends) ? f.friends : []);
      AsyncStorage.setItem('z_home_cache', JSON.stringify({ t: tt, r: rr })).catch(() => {});
    } catch (e) {}
  }, []);
  // [zip53] THE LIVE LIST — every room-message fan-out whispers to this user's
  // own channel; a bump restamps the row (the render sorts by last_active, so
  // it RISES), writes the cache through, and bumps unread for threads someone
  // else spoke in. An unknown thread_id (a reappearing hidden DM, a brand-new
  // room) means one load() — server truth carries the full row in.
  const knownIdsRef = useRef(new Set());
  const meIdRef = useRef(null);
  const [inboxRt, setInboxRt] = useState('connecting');   // [zip56] diag
  const [inboxBumps, setInboxBumps] = useState(0);        // [zip56] diag
  useEffect(() => {
    knownIdsRef.current = new Set([...(threads || []).map((t) => t.id), ...(rooms || []).map((r) => r.id)]);
  }, [threads, rooms]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await getMe();
        if (!alive || !me?.id) return;
        meIdRef.current = me.id;
        await subscribeInbox(me.id, (b) => {
          setInboxBumps((n) => n + 1);   // [zip56] diag: every bump, before any filtering
          if (!b || !b.thread_id) return;
          const stamp = b.last_active || new Date().toISOString();
          if (!knownIdsRef.current.has(b.thread_id)) { load(); return; }
          const mine = b.sender_user_id && meIdRef.current && b.sender_user_id === meIdRef.current;
          setThreads((cur) => {
            let hit = false;
            const next = (cur || []).map((t) => t.id === b.thread_id
              ? (hit = true, { ...t, last_active: stamp, last_message: (b.preview || t.last_message), unread: t.unread })   // [zip54p/57c] the server's count is truth
              : t);
            if (hit) AsyncStorage.getItem('z_home_cache').then((c) => {
              try { const s = c ? JSON.parse(c) : { t: [], r: [] }; s.t = next; AsyncStorage.setItem('z_home_cache', JSON.stringify(s)); } catch (e) {}
            }).catch(() => {});
            return next;
          });
          setRooms((cur) => {
            let hit = false;
            const next = (cur || []).map((r) => r.id === b.thread_id ? (hit = true, { ...r, last_active: stamp }) : r);
            if (hit) AsyncStorage.getItem('z_home_cache').then((c) => {
              try { const s = c ? JSON.parse(c) : { t: [], r: [] }; s.r = next; AsyncStorage.setItem('z_home_cache', JSON.stringify(s)); } catch (e) {}
            }).catch(() => {});
            return next;
          });
        }, (status) => setInboxRt(String(status)));
      } catch (e) {}
    })();
    return () => { alive = false; try { unsubscribeInbox(); } catch (e) {} };
  }, [load]);

  // tap a friend → open (or create) the DM thread, then land in the normal chat surface.
  const openFriendDM = useCallback(async (friend) => {
    if (opening) return;
    setOpening(true);
    try {
      const r = await openDM(friend.id);
      if (r && r.id) onOpen({ kind: 'dm', threadId: r.id, name: friend.display_name || ('@' + friend.handle) });
    } catch (e) {}
    setOpening(false);
  }, [opening, onOpen]);
  // paint the last-known list instantly, then refresh behind it — kills the
  // pinned-rows-then-blank-wait on every open.
  useEffect(() => {
    (async () => {
      try {
        const c = await AsyncStorage.getItem('z_home_cache');
        if (c) { const s = JSON.parse(c); setThreads(s.t || []); setRooms(s.r || []); }
      } catch (e) {}
      load();
      // a brand-new guest doesn't face an empty lobby — the desk greets them
      try {
        const seen = await AsyncStorage.getItem('z_first_open_done');
        if (!seen) {
          const t = await getThreads();
          if (!Array.isArray(t) || !t.length) { await AsyncStorage.setItem('z_first_open_done', '1'); onOpen({ kind: 'desk' }); }
          else await AsyncStorage.setItem('z_first_open_done', '1');
        }
      } catch (e) {}
    })();
  }, [load]);
  const pull = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const PINNED_KEYS = new Set(['the_front_desk', 'z', 'z_serious', 'the_grandmaster', 'the_interviewer', 'the_media_manager', 'the_diva']);   // [zip28] [zip54d] [zip54j]
  // chats tab = 1:1 persona threads + human DMs. Persona ROOMS (with persona members,
  // like "Nolan's Odyssey") stay in the GROUPS tab. A DM is a shared thread with no
  // persona members → it belongs here, as a normal conversation.
  const isDMRoom = (r) => !r.personas || r.personas.filter(Boolean).length === 0;
  const allRows = [
    ...threads.filter((t) => t.persona_key && !t.is_shared && !t.is_group && !PINNED_KEYS.has(t.persona_key)).map((t) => ({
      kind: 'persona', key: t.persona_key, threadId: t.id, name: t.companion_name || nameOf(t.persona_key),
      at: t.last_active,
      line: t.last_message || (t.unread ? 'new message' : 'tap to continue'),
      unread: t.unread || 0,
      pinnedByMe: !!t.pinned, favourite: !!t.favourite, archived: !!t.archived,
    })),
    ...rooms.filter(isDMRoom).map((r) => ({
      kind: 'dm', room: r, threadId: r.id, name: r.name || 'a friend',
      at: r.last_active || r.created_at,
      line: r.last_message || 'tap to chat', unread: 0,
      pinnedByMe: !!r.pinned, favourite: !!r.favourite, archived: !!r.archived,
    })),
  ].sort((a, b) => {
    if (a.pinnedByMe !== b.pinnedByMe) return a.pinnedByMe ? -1 : 1;   // pinned float
    return String(a.at || '') < String(b.at || '') ? 1 : -1;
  })
   .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
   .filter((r) => filt === 'growth' ? (r.kind === 'persona' && ['the_orator','the_media_manager','the_professor','the_guru','the_economist','the_teacher','the_mentor','the_healer'].includes(r.key)) : filt === 'unread' ? (r.unread > 0) : filt === 'fav' ? r.favourite : true);
  const recents = filt === 'archived' ? allRows.filter((r) => r.archived) : allRows.filter((r) => !r.archived);

  // [zip68] THE DESK, ALL CHAT — data hoisted so the pane stays a plain expression.
  const DESK_ROOMS = [
    { face: dpFor('the_front_desk'), name: 'the Host', line: "set it down — i've got it", open: { kind: 'desk' }, tint: '231,176,122' },
    { face: 'https://callmez.app/faces/the_newsroom.jpg?v=4', name: 'the Newsroom', line: 'the bulletin · fact-checks · ask the anchor', open: { kind: 'bulletin' }, tint: '127,214,236' },
    { face: 'https://callmez.app/rooms/coaching-hub.jpg?v=1', name: 'the Coaching hub', line: 'name an exam or subject — plans, lessons, quizzes, mocks.', open: { kind: 'coach' }, tint: '150,190,160' },
    { face: 'https://callmez.app/faces/the_grandmaster.jpg?v=6', name: 'the Grand Master', line: 'come empty-handed. leave understanding what the world runs on.', open: { kind: 'forge' }, tint: '232,120,142' },
    { face: 'https://callmez.app/rooms/panel-room.jpg?v=1', name: 'the interviewer', line: "name the company and the chair. i'll run the room the way they will.", open: { kind: 'panel' }, tint: '138,160,196' },
    { face: 'https://callmez.app/rooms/media-hub.jpg?v=1', name: 'the Media Manager', line: 'file the brief once. i run your career like a business.', open: { kind: 'mmroom' }, tint: '169,221,242' },
    { face: 'https://callmez.app/rooms/stylist-wardrobe.jpg?v=1', name: 'the stylist', line: "your wardrobe, under my eye. show me a piece — i'll tell you the truth.", open: { kind: 'stylist' }, tint: '232,169,176' },
    { face: null, name: 'The Consultant', line: 'sit with Victor — the expert. by thedreamai', open: { kind: 'consult' }, consult: true, tint: '232,162,74' },
  ];
  const deskDq = deskQ.trim().toLowerCase();
  let deskResults = null;
  if (deskDq) {
    const hits = [];
    for (const r of DESK_ROOMS) if (r.name.toLowerCase().includes(deskDq)) hits.push({ ...r, tag: 'desk' });
    for (const t of threads) {
      if (!t.persona_key && !t.is_group) continue;
      const nm = t.companion_name || t.name || '';
      if (nm && nm.toLowerCase().includes(deskDq)) hits.push({ face: dpFor(t.persona_key || 'z'), name: nm, line: t.is_group ? 'group' : 'chat', open: t.is_group ? { kind: 'group', group: t } : { kind: 'persona', key: t.persona_key, threadId: t.id, name: nm }, tag: t.is_group ? 'group' : 'chat' });
    }
    for (const rm of (rooms || [])) {
      const nm = rm.name || '';
      if (nm && nm.toLowerCase().includes(deskDq)) hits.push({ face: null, name: nm, line: 'public room', open: { kind: 'room', room: { id: rm.threadId || rm.id, name: nm, personas: rm.personas || [] } }, tag: 'room' });
    }
    deskResults = hits;
  }
  const deskTicker = (wireItems && wireItems.length) ? wireItems[wireTick % wireItems.length] : null;
  const DeskRow = ({ item }) => (
    <Pressable onPress={() => onOpen(item.open)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 14, marginHorizontal: 8, marginVertical: 1, borderRadius: 16, backgroundColor: item.tint ? `rgba(${item.tint},0.045)` : 'transparent' }}>{/* [zip70][zip72] the row wears its room's color, at a whisper */}
      <View style={{ width: 54, height: 54, borderRadius: 27, overflow: 'hidden', borderWidth: 1, borderColor: item.tint ? `rgba(${item.tint},0.4)` : (item.consult ? 'rgba(232,162,74,0.35)' : 'rgba(159,194,232,0.25)'), backgroundColor: item.consult ? '#101427' : MOON.rise, alignItems: 'center', justifyContent: 'center' }}>
        {item.consult ? <ConsultLogo /> : item.face ? <Image source={{ uri: item.face }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: MOON.faint, fontSize: 20 }}>#</Text>}
      </View>
      <View style={{ flex: 1, marginLeft: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Figtree_600SemiBold', color: '#FFFFFF', fontSize: 16.5 }}>{item.name}</Text>{/* [zip75] reads white on the tint */}
          {item.tag && item.tag !== 'desk' ? <Text style={{ fontFamily: FONTS.body, color: MOON.faint, fontSize: 10.5, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>{item.tag}</Text> : null}
        </View>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, color: 'rgba(255,255,255,0.82)', fontSize: 13, marginTop: 2 }}>{item.line}</Text>{/* [zip72][zip75] reads on the tint */}
      </View>
    </Pressable>
  );
  const archivedRows = allRows.filter((r) => r.archived);

  const setPref = async (row, prefs) => {
    if (!row.threadId) return;
    await setThreadPrefs(row.threadId, prefs);
    load();
  };
  const SwipeAction = ({ label, on, onPress }) => (
    <Pressable onPress={onPress} style={[st.swAct, on && st.swActOn]}>
      <Text style={[st.swActTxt, on && { color: MOON.porcelain }]}>{label}</Text>
    </Pressable>
  );
  // [zip12] delete a chat from the surface: confirm → soft-delete server-side →
  // the row leaves the local state AND the home cache instantly; load() reconciles.
  const deleteRow = (row) => {
    if (!row.threadId) return;
    Alert.alert(
      'delete this chat?',
      'the conversation is removed from your list. this can\u2019t be undone.',
      [
        { text: 'cancel', style: 'cancel' },
        { text: 'delete', style: 'destructive', onPress: async () => {
          await deleteRoomThread(row.threadId);
          setThreads((cur) => cur.filter((t) => t.id !== row.threadId));
          setRooms((cur) => cur.filter((r) => r.id !== row.threadId));
          try {
            const c = await AsyncStorage.getItem('z_home_cache');
            if (c) {
              const s = JSON.parse(c);
              s.t = (s.t || []).filter((t) => t.id !== row.threadId);
              s.r = (s.r || []).filter((r) => r.id !== row.threadId);
              await AsyncStorage.setItem('z_home_cache', JSON.stringify(s));
            }
          } catch (e) {}
          load();
        } },
      ],
    );
  };
  const rowActions = (row) => () => (
    <View style={{ flexDirection: 'row' }}>
      <SwipeAction label={row.pinnedByMe ? 'unpin' : 'pin'} on={row.pinnedByMe} onPress={() => setPref(row, { pinned: !row.pinnedByMe })} />
      <SwipeAction label={row.favourite ? 'unfav' : 'fav'} on={row.favourite} onPress={() => setPref(row, { favourite: !row.favourite })} />
      <SwipeAction label={row.archived ? 'unarchive' : 'archive'} on={row.archived} onPress={() => setPref(row, { archived: !row.archived })} />
      <SwipeAction label="delete" on={false} onPress={() => deleteRow(row)} />
    </View>
  );

  return (
    <GestureDetector gesture={quietPan}>
    <View style={st.root}>
      {/* [zip17] the nightfall veil — darkens with the pull; the quiet comes like dusk */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#05060C', zIndex: 40 }, pullVeil]} />
      {/* [zip17] the moon sliver — the standing hint at the left edge; tap = the same door */}
      {tab === 'chats' && <Animated.View style={[{ position: 'absolute', left: 0, top: '42%', zIndex: 41 }, sliverStyle]}>
        <Pressable onPress={openQuiet} hitSlop={{ top: 20, bottom: 20, left: 4, right: 14 }}>
          <View style={{ width: 10, height: 44, borderTopRightRadius: 10, borderBottomRightRadius: 10, backgroundColor: 'rgba(233,232,240,0.5)' }} />
        </Pressable>
      </Animated.View>}
      <Animated.View style={[{ flex: 1 }, pullSlide]}>
      {/* the trinity + the list */}
      {tab === 'chats' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={MOON.moon} />}
          contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
          <View style={st.searchWrap}>
            <Text style={st.searchIcon}>⌕</Text>
            <TextInput value={q} onChangeText={setQ} placeholder="search the house…" placeholderTextColor={MOON.faint} style={st.searchInput} />
        {/* [zip56] inbox channel diag — temporary */}
        <Text style={{ fontFamily: 'Figtree_300Light', fontSize: 10, color: 'rgba(233,232,240,0.4)', paddingHorizontal: 4, marginTop: 2 }}>inbox:{inboxRt}  b:{inboxBumps}</Text>
          </View>
          {quietHint ? (
            <Text style={{ fontFamily: FONTS.body, color: 'rgba(233,232,240,0.34)', fontSize: 12, textAlign: 'center', marginBottom: 8, fontStyle: 'italic' }}>swipe right when you need the quiet</Text>
          ) : null}
          <View style={st.chips}>
            {[['all','all'],['fav','favourites'],['growth','growth'],['unread','unread'],['friends','live friends'],['archived','archived']].map(([id,label]) => (
              <Pressable key={id} style={[st.chip, filt === id && st.chipOn]} onPress={() => setFilt(id)}>
                <Text style={[st.chipTxt, filt === id && st.chipTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {filt === 'friends' ? (
            friendList.length === 0 ? (
              <Text style={st.empty}>no friends yet — add people by handle in the You tab, then they show up here to chat.</Text>
            ) : (
              friendList.map((fr) => (
                <Row key={fr.id}
                  face={fr.avatar_url || null}
                  glyph={fr.avatar_url ? null : '🙂'}
                  tone={MOON.hair}
                  name={fr.display_name || ('@' + fr.handle)}
                  line={fr.handle ? '@' + fr.handle : 'tap to chat'}
                  onPress={() => openFriendDM(fr)}
                />
              ))
            )
          ) : (
            <>
              {recents.map((r, i) => (
                <ReanimatedSwipeable key={r.threadId || i} renderRightActions={rowActions(r)} overshootRight={false} friction={2} dragOffsetFromLeftEdge={200}>
                  <Row
                    face={r.kind === 'persona' && !r.key.startsWith('custom_') ? dpFor(r.key) : null}
                    glyph={r.kind === 'persona' && r.key.startsWith('custom_') ? (r.name && r.name[0] ? r.name[0].toUpperCase() : '✦') : r.kind === 'dm' ? '🙂' : r.kind === 'room' ? '👥' : null}
                    tone={r.kind === 'persona' ? (personaMeta(r.key)?.tone || MOON.hair) : MOON.hair}
                    name={r.name} line={r.line} time={ago(r.at)} unread={r.unread} pinned={r.pinnedByMe}
                    onPress={() => onOpen(
                      r.kind === 'persona' ? { kind: 'persona', key: r.key }
                      : r.kind === 'dm' ? { kind: 'dm', threadId: r.room.id, name: r.name }
                      : { kind: 'room', room: r.room })}
                  />
                </ReanimatedSwipeable>
              ))}
              {recents.length === 0 && <Text style={st.empty}>no conversations yet — tap ✎ to meet the house.</Text>}
              {filt !== 'archived' && archivedRows.length > 0 && (
                <>
                  <Pressable onPress={() => setShowArchived((v) => !v)} style={st.archiveRow}>
                    <Text style={st.archiveTxt}>{showArchived ? '▾' : '▸'} archived ({archivedRows.length})</Text>
                  </Pressable>
                  {showArchived && archivedRows.map((r, i) => (
                    <ReanimatedSwipeable key={'a' + (r.threadId || i)} renderRightActions={rowActions(r)} overshootRight={false} friction={2} dragOffsetFromLeftEdge={200}>
                      <Row
                        face={r.kind === 'persona' ? dpFor(r.key) : null}
                        glyph={r.kind === 'dm' ? '🙂' : null}
                        tone={MOON.hair}
                        name={r.name} line={r.line} time={ago(r.at)} unread={0}
                        onPress={() => onOpen(
                          r.kind === 'persona' ? { kind: 'persona', key: r.key }
                          : { kind: 'dm', threadId: r.room.id, name: r.name })}
                      />
                    </ReanimatedSwipeable>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      )}
      {tab === 'thedesk' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{/* [zip68] the Desk, all chat */}
          <View style={st.searchWrap}>
            <Text style={st.searchIcon}>⌕</Text>
            <TextInput value={deskQ} onChangeText={setDeskQ} placeholder="search the house — rooms, chats, groups…" placeholderTextColor={MOON.faint} style={st.searchInput} />
          </View>
          {!deskDq && deskTicker ? (
            <Pressable onPress={() => deskTicker.link && Linking.openURL(deskTicker.link).catch(() => {})} style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6, paddingVertical: 9, paddingHorizontal: 13, borderRadius: 12, backgroundColor: 'rgba(201,168,106,0.06)', borderWidth: 1, borderColor: 'rgba(201,168,106,0.16)' }}>
              <Text style={{ fontFamily: 'Figtree_600SemiBold', color: '#C9A86A', fontSize: 9.5, letterSpacing: 1, marginRight: 9 }}>{(deskTicker.topic || 'wire').toUpperCase()}</Text>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: FONTS.body, color: '#FFFFFF', fontSize: 12.5 }}>{deskTicker.title}</Text>{/* [zip75] */}
            </Pressable>
          ) : null}
          {deskResults ? (
            deskResults.length ? deskResults.map((r, ri) => <DeskRow key={'res' + ri} item={r} />)
              : <Text style={{ fontFamily: FONTS.body, color: MOON.faint, fontSize: 13, textAlign: 'center', marginTop: 30 }}>nothing by that name — yet.</Text>
          ) : (
            DESK_ROOMS.map((r, ri) => <DeskRow key={'room' + ri} item={r} />)
          )}
        </ScrollView>
      )}
      {tab === 'groups' && <Rooms onOpen={(r) => onOpen({ kind: 'room', room: r })} />}
      {tab === 'rooms' && <PublicRooms onOpen={onOpen} />}

      {/* compose */}
      {tab === 'chats' && (
        <Pressable style={st.fab} onPress={() => onOpen({ kind: 'roster' })}>
          <Text style={st.fabTxt}>✎</Text>
        </Pressable>
      )}

      {/* the inner tabs */}
      <View style={st.tabs}>
        {[['thedesk', 'the Desk'], ['chats', 'chats'], ['groups', 'groups'], ['rooms', 'rooms']].map(([id, label]) => {   /* [zip61] */
          const on = tab === id;
          const stroke = on ? MOON.moon : MOON.faint;
          return (
            <Pressable key={id} style={st.tabBtn} onPress={() => setTab(id)}>
              <Svg width="22" height="22" viewBox="0 0 24 24">
                {id === 'chats' && <><Circle cx="12" cy="11" r="7.5" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M7 20 L9 15.5" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" /></>}
                {id === 'thedesk' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" strokeDasharray="4 3" /><Circle cx="12" cy="12" r="3" fill={stroke} /></>}
                {id === 'groups' && <><Circle cx="9" cy="9.5" r="3.4" stroke={stroke} strokeWidth="1.6" fill="none" /><Circle cx="16.5" cy="10.5" r="2.6" stroke={stroke} strokeWidth="1.4" fill="none" /><SvgPath d="M3.5 19 Q9 13.5 14.5 19" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" /><SvgPath d="M15 18 Q17.5 15.5 21 18" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" /></>}
                {id === 'rooms' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M4.5 12 H19.5 M12 4.5 C9 8, 9 16, 12 19.5 M12 4.5 C15 8, 15 16, 12 19.5" stroke={stroke} strokeWidth="1.2" fill="none" /></>}
              </Svg>
              <Text style={[st.tabTxt, on && st.tabOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      </Animated.View>
    </View>
    </GestureDetector>
  );
}

const st = StyleSheet.create({
  swAct: { width: 74, alignItems: 'center', justifyContent: 'center', backgroundColor: MOON.raise, borderLeftWidth: 1, borderColor: MOON.hair },
  swActOn: { backgroundColor: 'rgba(159,194,232,0.14)' },
  swActTxt: { fontFamily: FONTS.medium, color: MOON.mist, fontSize: 12 },
  archiveRow: { paddingHorizontal: 18, paddingVertical: 12 },
  archiveTxt: { fontFamily: FONTS.medium, color: MOON.faint, fontSize: 12.5 },
  updRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  updRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: 'rgba(159,194,232,0.45)', alignItems: 'center', justifyContent: 'center' },
  updFace: { width: 44, height: 44, borderRadius: 22 },
  updName: { fontFamily: 'Figtree_500Medium', color: '#E8ECF4', fontSize: 14.5 },
  updLine: { fontFamily: 'Figtree_400Regular', color: 'rgba(232,236,244,0.55)', fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  updDiary: { marginLeft: 78, marginRight: 16, marginBottom: 8, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(159,194,232,0.25)' },
  updDate: { fontFamily: 'Figtree_600SemiBold', color: 'rgba(159,194,232,0.7)', fontSize: 10, letterSpacing: 0.8 },
  updEntry: { fontFamily: 'Figtree_400Regular', color: 'rgba(232,236,244,0.6)', fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  updGo: { fontFamily: 'Figtree_500Medium', color: '#9FC2E8', fontSize: 12.5, marginTop: 4, marginBottom: 6 },
  root: { flex: 1, backgroundColor: MOON.ground },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 4, marginBottom: 10, borderWidth: 1, borderColor: MOON.hair, borderRadius: 22, paddingHorizontal: 14, backgroundColor: MOON.raise },
  searchIcon: { color: MOON.faint, fontSize: 17, marginRight: 8 },
  searchInput: { flex: 1, fontFamily: FONTS.body, color: MOON.porcelain, fontSize: 14, paddingVertical: 9 },
  pinRow: { flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 6 },
  pinTile: { alignItems: 'center', gap: 6, width: 92 },
  pinFace: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.2, borderColor: MOON.hairStrong },
  pinBell: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.2, borderColor: MOON.hairStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: MOON.raise },
  pinName: { fontFamily: FONTS.medium, color: MOON.mist, fontSize: 11.5 },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: MOON.hair },
  chipOn: { backgroundColor: 'rgba(159,194,232,0.14)', borderColor: MOON.hairStrong },
  chipTxt: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 12 },
  chipTxtOn: { color: MOON.moon },
  zMono: { fontFamily: FONTS.display, color: MOON.moon, fontSize: 21 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, backgroundColor: MOON.ground },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.4, borderColor: MOON.hair, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: MOON.raise },
  face: { width: 44, height: 44, borderRadius: 22 },
  glyph: { fontSize: 20 },
  consultDP: { width: 44, height: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#101427', paddingHorizontal: 3 },
  consultDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#E8A24A', marginRight: 3, shadowColor: '#E8A24A', shadowOpacity: 0.9, shadowRadius: 4 },
  consultWord: { fontFamily: 'CormorantGaramond_300Light', color: 'rgba(245,240,232,0.94)', fontSize: 12, flexShrink: 1 },
  consultWordIt: { fontFamily: 'CormorantGaramond_400Regular_Italic', color: '#F5F0E8' },
  name: { fontFamily: FONTS.medium, color: MOON.porcelain, fontSize: 15.5, flex: 1, marginRight: 8 },
  time: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 11.5 },
  line: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 13, marginTop: 2 },
  nameUnread: { fontFamily: FONTS.semibold, color: MOON.porcelain },
  lineUnread: { color: MOON.moon },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: MOON.moon, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginLeft: 8 },
  badgeTxt: { fontFamily: FONTS.semibold, color: '#0A0D14', fontSize: 11.5 },
  divider: { height: 1, backgroundColor: MOON.hair, marginVertical: 6, marginHorizontal: 16 },
  empty: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 13.5, textAlign: 'center', paddingTop: 40 },
  fab: { position: 'absolute', right: 20, bottom: 78, width: 54, height: 54, borderRadius: 27, backgroundColor: MOON.moonDeep, alignItems: 'center', justifyContent: 'center', shadowColor: MOON.moon, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  fabTxt: { color: '#0A0D12', fontSize: 22 },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: MOON.raise, borderTopWidth: 1, borderTopColor: MOON.hair, paddingBottom: 22, paddingTop: 14 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabTxt: { fontFamily: FONTS.medium, color: MOON.faint, fontSize: 13.5 },
  tabOn: { color: MOON.moon },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: MOON.moon },
  soonWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 40 },
  soonTitle: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 22, marginBottom: 8 },
  soonLine: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  commHead: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 24, marginHorizontal: 20, marginTop: 10 },
  commSub: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 13, marginHorizontal: 20, marginTop: 3, marginBottom: 14 },
  commCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(159,194,232,0.05)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.12)' },
  commFaces: { flexDirection: 'row', width: 56, alignItems: 'center' },
  commFace: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: MOON.ground },
  commName: { fontFamily: FONTS.medium, color: MOON.porcelain, fontSize: 16 },
  commTheme: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  commMeta: { fontFamily: FONTS.light, color: 'rgba(232,236,244,0.4)', fontSize: 11, marginTop: 5 },
  commGo: { fontFamily: FONTS.semibold, color: MOON.moon, fontSize: 13, marginLeft: 10 },
  createRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(159,194,232,0.25)', borderStyle: 'dashed' },
  createPlus: { color: MOON.moon, fontSize: 20, marginRight: 10 },
  createRowTxt: { fontFamily: FONTS.medium, color: MOON.moon, fontSize: 13.5, flex: 1 },
  createCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: 'rgba(159,194,232,0.06)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)' },
  createInput: { fontFamily: FONTS.body, color: MOON.porcelain, fontSize: 15, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  createCancel: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 14, paddingVertical: 8, paddingHorizontal: 6 },
  createBtn: { backgroundColor: 'rgba(159,194,232,0.16)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.4)', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 8 },
  createBtnTxt: { fontFamily: FONTS.semibold, color: MOON.moon, fontSize: 13 },
});
