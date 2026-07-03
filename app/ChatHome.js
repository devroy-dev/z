// ════════════════════════════════════════════════════════════════════════
//  yourZ — CHAT MODE. The Moonlight register: cold ink where Play is warm
//  ember. WhatsApp grammar: the pinned trinity (News · Front Desk · Z),
//  then recents — personas and rooms as one list. Inner tabs: Chats ·
//  Updates · Groups · Rooms.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react';
import { TextInput } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle, Path as SvgPath } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, RefreshControl } from 'react-native';
import { FONTS } from './theme';
import { getThreads, listRooms, API_BASE } from './api';
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

const dpFor = (k) => `${API_BASE}/faces/${k}.jpg?v=2`;
const nameOf = (k) => (personaMeta(k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));
const ago = (t) => {
  if (!t) return '';
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (m < 1440) return Math.floor(m / 60) + 'h';
  return Math.floor(m / 1440) + 'd';
};

function Row({ face, glyph, tone, name, line, time, pinned, onPress }) {
  return (
    <Pressable style={st.row} onPress={onPress}>
      <View style={[st.ring, tone && { borderColor: tone }]}>
        {face ? <Image source={{ uri: face }} style={st.face} /> : <Text style={st.glyph}>{glyph}</Text>}
      </View>
      <View style={{ flex: 1, marginLeft: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={st.name} numberOfLines={1}>{name}</Text>
          <Text style={st.time}>{pinned ? '📌' : time}</Text>
        </View>
        <Text style={st.line} numberOfLines={1}>{line}</Text>
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

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([getThreads(), listRooms()]);
      const tt = Array.isArray(t) ? t : [];
      const rr = Array.isArray(r) ? r : (r?.rooms || []);
      setThreads(tt);
      setRooms(rr);
      AsyncStorage.setItem('z_home_cache', JSON.stringify({ t: tt, r: rr })).catch(() => {});
    } catch (e) {}
  }, []);
  // paint the last-known list instantly, then refresh behind it — kills the
  // pinned-rows-then-blank-wait on every open.
  useEffect(() => {
    (async () => {
      try {
        const c = await AsyncStorage.getItem('z_home_cache');
        if (c) { const s = JSON.parse(c); setThreads(s.t || []); setRooms(s.r || []); }
      } catch (e) {}
      load();
    })();
  }, [load]);
  const pull = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const PINNED_KEYS = new Set(['the_front_desk', 'the_anchor', 'z', 'z_serious']);
  const recents = [
    ...threads.filter((t) => t.persona_key && !t.is_shared && !PINNED_KEYS.has(t.persona_key)).map((t) => ({
      kind: 'persona', key: t.persona_key, name: t.companion_name || nameOf(t.persona_key),
      at: t.last_active, line: 'tap to continue',
    })),
    ...rooms.map((r) => ({ kind: 'room', room: r, name: r.name || 'a room', at: r.last_active || r.created_at, line: (r.personas || []).map((k) => nameOf(k).replace(/^the /, '')).join(' · ') || 'a shared room' })),
  ].sort((a, b) => (String(a.at || '') < String(b.at || '') ? 1 : -1))
   .filter((r) => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()))
   .filter((r) => filt === 'growth' ? (r.kind === 'persona' && ['the_orator','the_media_manager','the_professor','the_guru','the_economist','the_teacher','the_mentor','the_healer'].includes(r.key)) : true);

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
            {[['all','all'],['fav','favourites'],['growth','growth'],['unread','unread'],['friends','friends']].map(([id,label]) => (
              <Pressable key={id} style={[st.chip, filt === id && st.chipOn]} onPress={() => setFilt(id)}>
                <Text style={[st.chipTxt, filt === id && st.chipTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Row face={dpFor('the_anchor')} tone={MOON.hairStrong} name="the news" line="the bulletin · fact-checks · ask anything" pinned onPress={() => onOpen({ kind: 'bulletin' })} />
          <Pressable style={st.row} onPress={() => onOpen({ kind: 'desk' })}>
            <View style={[st.ring, { borderColor: 'rgba(231,176,122,0.45)' }]}><DeskEmber /></View>
            <View style={{ flex: 1, marginLeft: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={st.name}>the front desk</Text><Text style={st.time}>📌</Text>
              </View>
              <Text style={st.line} numberOfLines={1}>set it down — i've got it</Text>
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
          <View style={st.divider} />
          {recents.map((r, i) => (
            <Row key={i}
              face={r.kind === 'persona' ? dpFor(r.key) : null}
              glyph={r.kind === 'room' ? '👥' : null}
              tone={r.kind === 'persona' ? (personaMeta(r.key)?.tone || MOON.hair) : MOON.hair}
              name={r.name} line={r.line} time={ago(r.at)}
              onPress={() => onOpen(r.kind === 'persona' ? { kind: 'persona', key: r.key } : { kind: 'room', room: r.room })}
            />
          ))}
          {recents.length === 0 && <Text style={st.empty}>no conversations yet — tap ✎ to meet the house.</Text>}
        </ScrollView>
      )}
      {tab !== 'chats' && (
        <View style={st.soonWrap}>
          <Text style={st.soonTitle}>{tab === 'updates' ? 'updates' : tab === 'groups' ? 'groups' : 'rooms'}</Text>
          <Text style={st.soonLine}>{tab === 'updates' ? 'the house diaries, as stories — moving in next.' : tab === 'groups' ? 'your groups, gathered here — moving in next.' : 'the public rooms — opening soon.'}</Text>
        </View>
      )}

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
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.4, borderColor: MOON.hair, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: MOON.raise },
  face: { width: 44, height: 44, borderRadius: 22 },
  glyph: { fontSize: 20 },
  name: { fontFamily: FONTS.medium, color: MOON.porcelain, fontSize: 15.5, flex: 1, marginRight: 8 },
  time: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 11.5 },
  line: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: MOON.hair, marginVertical: 6, marginHorizontal: 16 },
  empty: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 13.5, textAlign: 'center', paddingTop: 40 },
  fab: { position: 'absolute', right: 20, bottom: 78, width: 54, height: 54, borderRadius: 27, backgroundColor: MOON.moonDeep, alignItems: 'center', justifyContent: 'center', shadowColor: MOON.moon, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  fabTxt: { color: '#0A0D12', fontSize: 22 },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: MOON.raise, borderTopWidth: 1, borderTopColor: MOON.hair, paddingBottom: 22, paddingTop: 14 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabTxt: { fontFamily: FONTS.medium, color: MOON.faint, fontSize: 13.5 },
  tabOn: { color: MOON.moon },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: MOON.moon },
});
