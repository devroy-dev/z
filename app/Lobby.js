// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE LOBBY (Tier-1, semi-loud).  Now the ROOMS TAB ROOT.
//  Public rooms own the Rooms tab (Dev ruling: "rooms has its own tab").
//  The crescendo's middle beat: dark Nightfall ground + house type retained
//  (still yourZ), but color wakes in the accents — live-count badges,
//  category chips, who's-inside clusters — and the layout is populated.
//  Color does NOT flood the field here; that's Tier-2, inside a room.
//  A quiet "your rooms ›" strip keeps the user's own rooms one tap away
//  (reversible while the Desk's all-chat migration settles).
//  Data is a PLACEHOLDER loader (design-verifiable, OTA-safe); the backend
//  phase swaps in GET /public-rooms/v2 behind useCachedState.
//  Spec: yourZ-rooms-design.md §TIER 1. Aura source: roomTheme.js.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Grain from './Grain';
import { N } from './roomTheme';

// ── the facet spine (R2: TOPIC + GEO + LIVE). Each carries its own hue. ──
const FACETS = [
  { key: 'live',       label: 'live now',   hue: '#E24B4A' },
  { key: 'philosophy', label: 'philosophy', hue: '#5DCAA5' },
  { key: 'cricket',    label: 'cricket',    hue: '#EF9F27' },
  { key: 'love',       label: 'love',       hue: '#ED93B1' },
  { key: 'music',      label: 'music',      hue: '#AFA9EC' },
  { key: 'business',   label: 'business',   hue: '#85B7EB' },
  { key: 'delhi',      label: 'delhi',      hue: '#85B7EB' },
  { key: 'mumbai',     label: 'mumbai',     hue: '#97C459' },
];

// ── PLACEHOLDER directory. Shape mirrors the future /public-rooms/v2 row so
//    the swap is a data-source change, not a UI change. ──
async function loadPublicRooms() {
  return [
    { id: 'p1', title: 'is AI conscious?',                 category: 'philosophy', geo: null,     seq: 1, hues: ['#1D9E75', '#D85A30', '#378ADD'], live: 68 },
    { id: 'p2', title: 'india vs australia — who wins?',    category: 'cricket',    geo: 'delhi',  seq: 2, hues: ['#EF9F27', '#97C459', '#F0997B'], live: 41 },
    { id: 'p3', title: 'the market after the rate cut',     category: 'business',   geo: 'mumbai', seq: 1, hues: ['#85B7EB', '#5DCAA5'],            live: 23 },
    { id: 'p4', title: 'best hip-hop of the decade',        category: 'music',      geo: null,     seq: 1, hues: ['#AFA9EC', '#ED93B1', '#EF9F27'], live: 19 },
    { id: 'p5', title: 'first-date red flags',              category: 'love',       geo: null,     seq: 1, hues: ['#ED93B1', '#F0997B'],            live: 12 },
    { id: 'e1', title: 'the great debate: is cricket a religion?', category: 'cricket', geo: null, seq: 1, hues: ['#EF9F27', '#85B7EB', '#97C459'], live: 0, isEvent: true, startsInMin: 20 },
    { id: 'e2', title: 'friday night confessions',          category: 'love',       geo: null,     seq: 1, hues: ['#ED93B1', '#AFA9EC'],            live: 0, isEvent: true, startsInMin: 55 },
  ];
}

// a small live pulse dot
function LiveDot({ color = '#fff', size = 5 }) {
  const p = useSharedValue(0.55);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const st = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, st]} />;
}

// ── the who's-inside cluster: the room's COLORS, not specific personas
//    (public rooms hold strangers, who have no faces — the aura mix is honest). ──
function Cluster({ hues = [] }) {
  const show = hues.slice(0, 3);
  return (
    <View style={{ flexDirection: 'row', width: 26 + (show.length - 1) * 17, alignItems: 'center' }}>
      {show.map((h, i) => (
        <View key={i} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: h, borderWidth: 2, borderColor: N.night, marginLeft: i === 0 ? 0 : -9, zIndex: show.length - i }} />
      ))}
    </View>
  );
}

function RoomCard({ room, onOpen }) {
  const metaBits = [room.category, room.geo, room.seq > 1 ? String(room.seq) : null].filter(Boolean);
  return (
    <Pressable style={[styles.card, room.isEvent && { opacity: 0.74 }]} onPress={() => onOpen(room)}>
      <Cluster hues={room.hues} />
      <View style={{ flex: 1, marginLeft: 11 }}>
        <Text style={styles.cardTitle} numberOfLines={1}>{room.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>{metaBits.join(' · ')}</Text>
      </View>
      {room.isEvent ? (
        <View style={styles.soon}><Text style={styles.soonText}>soon</Text></View>
      ) : (
        <View style={styles.liveBadge}><LiveDot /><Text style={styles.liveText}>{room.live}</Text></View>
      )}
    </Pressable>
  );
}

export default function Lobby({ onOpen = () => {}, onMyRooms = () => {} }) {
  const [rooms, setRooms] = useState([]);
  const [facet, setFacet] = useState(null);   // null = all
  const [q, setQ] = useState('');

  useEffect(() => { let live = true; loadPublicRooms().then((r) => { if (live) setRooms(r); }); return () => { live = false; }; }, []);

  const shown = useMemo(() => {
    let list = rooms;
    if (facet === 'live') list = list.filter((r) => !r.isEvent && r.live > 0);
    else if (facet) list = list.filter((r) => r.category === facet || r.geo === facet);
    if (q.trim()) { const s = q.trim().toLowerCase(); list = list.filter((r) => r.title.toLowerCase().includes(s)); }
    const liveNow = list.filter((r) => !r.isEvent && r.live > 0).sort((a, b) => b.live - a.live);
    const soon = list.filter((r) => r.isEvent).sort((a, b) => (a.startsInMin || 0) - (b.startsInMin || 0));
    const rest = list.filter((r) => !r.isEvent && !(r.live > 0));
    return [...liveNow, ...soon, ...rest];
  }, [rooms, facet, q]);

  const totalLive = useMemo(() => rooms.reduce((n, r) => n + (r.live || 0), 0), [rooms]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#100E15', '#0B0A0F', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* header — this is the ROOMS TAB ROOT, so no back chevron */}
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>public rooms</Text>
            <Text style={styles.sub}>step into a room full of strangers</Text>
          </View>
          <View style={styles.headLive}><LiveDot /><Text style={styles.headLiveText}>{totalLive} live</Text></View>
        </View>

        {/* the quiet escape hatch back to the user's own rooms (Tier-0) */}
        <Pressable style={styles.myRooms} onPress={onMyRooms}>
          <Text style={styles.myRoomsTxt}>your rooms</Text>
          <Text style={styles.myRoomsChev}>›</Text>
        </Pressable>

        {/* search */}
        <View style={styles.searchWrap}>
          <TextInput style={styles.search} value={q} onChangeText={setQ} placeholder="find a room…" placeholderTextColor="#6A6675" returnKeyType="search" />
        </View>

        {/* facet chips */}
        <View style={{ height: 42 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
            {FACETS.map((f) => {
              const on = facet === f.key;
              return (
                <Pressable key={f.key} onPress={() => setFacet(on ? null : f.key)}
                  style={[styles.chip, { backgroundColor: hexA(f.hue, on ? 0.26 : 0.13), borderColor: on ? hexA(f.hue, 0.6) : 'transparent' }]}>
                  {f.key === 'live' && <LiveDot color={f.hue} size={5} />}
                  <Text style={[styles.chipText, { color: f.hue }]}>{f.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* the directory */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 6, paddingBottom: 120 }}>
          {shown.length === 0 ? (
            <Text style={styles.empty}>no rooms here yet — try another category.</Text>
          ) : (
            shown.map((r) => <RoomCard key={r.id} room={r} onOpen={onOpen} />)
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },

  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  title: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 26 },
  sub: { fontFamily: 'Figtree_400Regular', color: N.silver, fontSize: 12.5, marginTop: 1 },
  headLive: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E24B4A', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  headLiveText: { fontFamily: 'Figtree_600SemiBold', color: '#fff', fontSize: 11.5 },

  myRooms: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  myRoomsTxt: { fontFamily: 'Figtree_500Medium', color: N.silver, fontSize: 13.5 },
  myRoomsChev: { fontFamily: 'Figtree_400Regular', color: N.silver, fontSize: 18, marginTop: -2 },

  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  search: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: N.moon, fontFamily: 'Figtree_400Regular', fontSize: 14 },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  chipText: { fontFamily: 'Figtree_500Medium', fontSize: 12.5 },

  card: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.035)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 15.5, lineHeight: 20 },
  cardMeta: { fontFamily: 'Figtree_400Regular', color: '#6A6675', fontSize: 11.5, marginTop: 2 },

  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#E24B4A', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20 },
  liveText: { fontFamily: 'Figtree_600SemiBold', color: '#fff', fontSize: 11 },
  soon: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(200,138,79,0.4)' },
  soonText: { fontFamily: 'Figtree_500Medium', color: '#C88A4F', fontSize: 10.5 },

  empty: { fontFamily: 'Fraunces_400Regular_Italic', color: N.moonFaint, fontSize: 14, paddingHorizontal: 24, marginTop: 20, lineHeight: 21 },
});
