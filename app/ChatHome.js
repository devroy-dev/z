// ════════════════════════════════════════════════════════════════════════
//  yourZ — CHAT MODE. The Moonlight register: cold ink where Play is warm
//  ember. WhatsApp grammar: the pinned trinity (News · Front Desk · Z),
//  then recents — personas and rooms as one list. Inner tabs: Chats ·
//  Updates · Groups · Rooms.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse, Path as SvgPath } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, RefreshControl } from 'react-native';
import { FONTS } from './theme';
import { getThreads, listRooms, getPersonaStates, getPersonaDiary, API_BASE, getFriends, openDM, setThreadPrefs, getPublicRooms, joinPublicRoom, createPublicRoom } from './api';
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

const dpFor = (k) => `${API_BASE}/faces/${k}.jpg?v=4`;

// the house diaries, as a feed: today's line per resident; tap → their recent week
function UpdatesFeed({ onOpen }) {
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
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
  const [tab, setTab] = useState('chats');
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

  const PINNED_KEYS = new Set(['the_front_desk', 'z', 'z_serious', 'the_grandmaster']);
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
  const rowActions = (row) => () => (
    <View style={{ flexDirection: 'row' }}>
      <SwipeAction label={row.pinnedByMe ? 'unpin' : 'pin'} on={row.pinnedByMe} onPress={() => setPref(row, { pinned: !row.pinnedByMe })} />
      <SwipeAction label={row.favourite ? 'unfav' : 'fav'} on={row.favourite} onPress={() => setPref(row, { favourite: !row.favourite })} />
      <SwipeAction label={row.archived ? 'unarchive' : 'archive'} on={row.archived} onPress={() => setPref(row, { archived: !row.archived })} />
    </View>
  );

  return (
    <View style={st.root}>
      {/* the trinity + the list */}
      {tab === 'chats' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={MOON.moon} />}
          contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
          <View style={st.searchWrap}>
            <Text style={st.searchIcon}>⌕</Text>
            <TextInput value={q} onChangeText={setQ} placeholder="search the house…" placeholderTextColor={MOON.faint} style={st.searchInput} />
          </View>
          <View style={st.chips}>
            {[['all','all'],['fav','favourites'],['growth','growth'],['unread','unread'],['friends','live friends'],['archived','archived']].map(([id,label]) => (
              <Pressable key={id} style={[st.chip, filt === id && st.chipOn]} onPress={() => setFilt(id)}>
                <Text style={[st.chipTxt, filt === id && st.chipTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={st.row} onPress={() => onOpen({ kind: 'desk' })}>
            <View style={[st.ring, { borderColor: 'rgba(231,176,122,0.45)' }]}>
              {deskFace ? <Image source={{ uri: dpFor('the_front_desk') }} style={st.face} onError={() => setDeskFace(false)} /> : <DeskEmber />}
            </View>
            <View style={{ flex: 1, marginLeft: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={st.name}>the front desk</Text><Text style={st.time}>📌</Text>
              </View>
              <Text style={st.line} numberOfLines={1}>set it down — i've got it</Text>
            </View>
          </Pressable>
          <Row face={`https://callmez.app/faces/the_newsroom.jpg?v=4`} tone={MOON.hairStrong} name="the Newsroom" line="the bulletin · fact-checks · ask the anchor" pinned onPress={() => onOpen({ kind: 'bulletin' })} />
          <Pressable style={st.row} onPress={() => onOpen({ kind: 'consult' })}>
            <View style={[st.ring, { borderColor: 'rgba(232,162,74,0.35)', backgroundColor: '#101427' }]}>
              <ConsultLogo />
            </View>
            <View style={{ flex: 1, marginLeft: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={st.name}>The Consultant</Text><Text style={st.time}>📌</Text>
              </View>
              <Text style={st.line} numberOfLines={1}>sit with Victor — the expert. by thedreamai</Text>
            </View>
          </Pressable>
          <Pressable style={st.row} onPress={() => onOpen({ kind: 'z' })}>
            <View style={[st.ring, { borderColor: MOON.moon }]}>
              {zFace ? <Image source={{ uri: dpFor('z') }} style={st.face} onError={() => setZFace(false)} /> : <Text style={st.zMono}>Z</Text>}
            </View>
            <View style={{ flex: 1, marginLeft: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={st.name}>Z</Text><Text style={st.time}>📌</Text>
              </View>
              <Text style={st.line} numberOfLines={1}>the quiet room — for what's actually on your mind</Text>
            </View>
          </Pressable>
          <Row face={`https://callmez.app/faces/the_grandmaster.jpg?v=4`} tone={MOON.hairStrong} name="the Grand Master" line="come empty-handed. leave understanding what the world runs on." pinned onPress={() => onOpen({ kind: 'persona', key: 'the_grandmaster' })} />
          <View style={st.divider} />
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
                <ReanimatedSwipeable key={r.threadId || i} renderRightActions={rowActions(r)} overshootRight={false} friction={2}>
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
                    <ReanimatedSwipeable key={'a' + (r.threadId || i)} renderRightActions={rowActions(r)} overshootRight={false} friction={2}>
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
      {tab === 'updates' && <UpdatesFeed onOpen={onOpen} />}
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
        {[['chats', 'chats'], ['updates', 'updates'], ['groups', 'groups'], ['rooms', 'rooms']].map(([id, label]) => {
          const on = tab === id;
          const stroke = on ? MOON.moon : MOON.faint;
          return (
            <Pressable key={id} style={st.tabBtn} onPress={() => setTab(id)}>
              <Svg width="22" height="22" viewBox="0 0 24 24">
                {id === 'chats' && <><Circle cx="12" cy="11" r="7.5" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M7 20 L9 15.5" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" /></>}
                {id === 'updates' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" strokeDasharray="4 3" /><Circle cx="12" cy="12" r="3" fill={stroke} /></>}
                {id === 'groups' && <><Circle cx="9" cy="9.5" r="3.4" stroke={stroke} strokeWidth="1.6" fill="none" /><Circle cx="16.5" cy="10.5" r="2.6" stroke={stroke} strokeWidth="1.4" fill="none" /><SvgPath d="M3.5 19 Q9 13.5 14.5 19" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" /><SvgPath d="M15 18 Q17.5 15.5 21 18" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" /></>}
                {id === 'rooms' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M4.5 12 H19.5 M12 4.5 C9 8, 9 16, 12 19.5 M12 4.5 C15 8, 15 16, 12 19.5" stroke={stroke} strokeWidth="1.2" fill="none" /></>}
              </Svg>
              <Text style={[st.tabTxt, on && st.tabOn]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
