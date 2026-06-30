// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE ROOMS WORLD. Opens as a curated feed: SUGGESTED rooms first
//  (so the tab is alive from second one), then YOUR rooms, then PUBLIC rooms.
//  A room reads as SEVERAL presences sharing one pool of light (vs. the single
//  presences in the Gathering) — that clustering is how the eye learns
//  "this is a together-space."
//    Type 1 persona-group · Type 2 invited (humans) · Type 3 public (ephemeral)
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const NAMES = {
  the_brother:'the brother', the_colleague:'the colleague', the_philosopher:'the philosopher',
  the_cosmologist:'the cosmologist', the_mentor:'the motivator', the_healer:'the healer',
  the_comic:'the comic', the_wingman:'the wingman', the_cynic:'the cynic', the_guru:'the guru',
  the_historian:'the historian', the_economist:'the economist', the_brainiac:'the brainiac',
};

// ── a "pool": several presences clustered in one shared glow ──
function Pool({ keys, tone = C.ember, size = 52 }) {
  const b = useSharedValue(0.7);
  useEffect(() => {
    b.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const glow = useAnimatedStyle(() => ({ opacity: 0.4 + b.value * 0.45 }));
  const show = keys.slice(0, 3);
  const overlap = size * 0.42;
  return (
    <View style={{ width: size + overlap * (show.length - 1) + 20, height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      {/* the shared pool of light behind the cluster */}
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, glow]}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id={`pool_${keys.join('')}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={tone} stopOpacity="0.4" />
              <Stop offset="60%" stopColor={tone} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={tone} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50%" cy="50%" r="50%" fill={`url(#pool_${keys.join('')})`} />
        </Svg>
      </Animated.View>
      {/* the faces, overlapping */}
      <View style={{ flexDirection: 'row' }}>
        {show.map((k, i) => (
          <View key={k} style={[styles.poolFace, { width: size, height: size, borderRadius: size / 2, borderColor: tone, marginLeft: i === 0 ? 0 : -overlap, zIndex: show.length - i }]}>
            <FaceImg pkey={k} tone={tone} size={size} />
          </View>
        ))}
      </View>
    </View>
  );
}

function FaceImg({ pkey, tone, size }) {
  const [ok, setOk] = useState(true);
  if (ok) return <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: size / 2 }} onError={() => setOk(false)} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 52 52">
      <Defs><RadialGradient id={`pf_${pkey}`} cx="38%" cy="33%" r="70%"><Stop offset="0%" stopColor="#FFD09A" /><Stop offset="60%" stopColor={tone} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs>
      <Circle cx="26" cy="26" r="26" fill={`url(#pf_${pkey})`} />
    </Svg>
  );
}

// ── suggested room card (the hero) ──
function SuggestedCard({ room, onOpen }) {
  return (
    <Pressable style={styles.suggCard} onPress={() => onOpen(room)}>
      <LinearGradient colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.015)']} style={styles.suggInner}>
        <Pool keys={room.keys} tone={room.tone} size={50} />
        <Text style={styles.suggTitle} numberOfLines={2}>{room.title}</Text>
        <Text style={styles.suggWhy} numberOfLines={3}>{room.why}</Text>
        <View style={styles.suggMeta}>
          <Text style={[styles.suggTag, { color: room.tone, borderColor: room.tone }]}>{room.tag}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// ── your-rooms row (rooms you return to) ──
function YourRoomRow({ room, onOpen }) {
  return (
    <Pressable style={styles.yourRow} onPress={() => onOpen(room)}>
      <Pool keys={room.keys} tone={room.tone} size={44} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.yourName}>{room.title}</Text>
        <Text style={styles.yourLast} numberOfLines={1}>{room.last}</Text>
      </View>
      <Text style={styles.yourTime}>{room.time}</Text>
    </Pressable>
  );
}

// ── public room row (Type 3 — open, ephemeral agent, live count) ──
function PublicRow({ room, onOpen }) {
  const p = useSharedValue(0.5);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const dot = useAnimatedStyle(() => ({ opacity: p.value }));
  return (
    <Pressable style={styles.pubRow} onPress={() => onOpen(room)}>
      <Pool keys={room.keys} tone={room.tone} size={42} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={styles.yourName}>{room.title}</Text>
        <Text style={styles.yourLast} numberOfLines={1}>{room.topic}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Animated.View style={[styles.liveDot, dot]} />
          <Text style={styles.liveCount}>{room.live}</Text>
        </View>
        <Text style={styles.liveLabel}>inside</Text>
      </View>
    </Pressable>
  );
}

// ── seed content ──
const M = (key, name, tone) => ({ key, name, tone });
const SUGGESTED = [
  { id: 's1', title: 'the big questions', why: 'the philosopher & the cosmologist, together — zoom all the way out.', keys: ['the_philosopher','the_cosmologist'], tone: '#6FC9E0', tag: 'persona group',
    members: [M('the_philosopher','the philosopher','#6FC9E0'), M('the_cosmologist','the cosmologist','#6FC9E0')] },
  { id: 's2', title: 'get through the week', why: "feeling stuck? the motivator and the brother are around.", keys: ['the_mentor','the_brother'], tone: '#F0A765', tag: 'persona group',
    members: [M('the_mentor','the motivator','#F0A765'), M('the_brother','the brother','#F0A765')] },
  { id: 's3', title: 'make it make sense', why: 'the economist & the historian on why the world is the way it is.', keys: ['the_economist','the_historian'], tone: '#E0C088', tag: 'persona group',
    members: [M('the_economist','the economist','#E0C088'), M('the_historian','the historian','#E0C088')] },
];
const YOURS = [
  { id: 'y1', title: 'sunday debate club', last: 'the cynic: wonderful, isn\'t it?', time: '2h', keys: ['the_brainiac','the_cynic','the_philosopher'], tone: '#6FC9E0', members: [M('the_brainiac','the brainiac','#6FC9E0'), M('the_cynic','the cynic','#6FC9E0'), M('the_philosopher','the philosopher','#6FC9E0')] },
  { id: 'y2', title: 'trip planning', last: 'ananya: okay but the healer is right about pacing', time: '20m', keys: ['the_healer'], tone: '#C99BE8', type: 'invited',
    members: [M('the_healer','the healer','#C99BE8')],
    humans: [{ id: 'h_ananya', name: 'Ananya R' }, { id: 'h_vikram', name: 'Vikram S' }],
    lines: [
      { who: 'human', name: 'Ananya', text: "okay i found three places but we keep overpacking the days" },
      { who: 'you', text: "yeah last trip we burned out by day 3" },
      { who: 'them', key: 'the_healer', name: 'the healer', text: "then build in one slow morning per place. you don't remember the rushing — you remember the one unhurried coffee." },
      { who: 'human', name: 'Vikram', text: "see THIS is why we invited the healer lol" },
    ] },
];
const PUBLIC = [
  { id: 'p1', kind: 'public', title: 'is AI conscious?', topic: 'hosted room · the brainiac moderating', host: 'arjun_dev', aiName: 'keeper', live: 42, keys: ['the_brainiac','the_guru'], tone: '#C99BE8' },
  { id: 'p2', kind: 'public', title: 'late night venting', topic: 'open room · come as you are', host: 'sleepless_in_del', aiName: 'the keeper', live: 17, keys: ['the_healer','the_stranger'], tone: '#C99BE8' },
];

export default function Rooms({ onOpen = () => {} }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#150C1C', '#0E0912', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.kicker}>together</Text>
          <Text style={styles.title}>rooms</Text>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* SUGGESTED — the hero */}
          <Text style={styles.sectionLabel}>suggested for you</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
            {SUGGESTED.map((r) => <SuggestedCard key={r.id} room={r} onOpen={onOpen} />)}
          </ScrollView>

          {/* YOUR ROOMS */}
          <Text style={[styles.sectionLabel, { marginTop: 26 }]}>your rooms</Text>
          {YOURS.map((r) => <YourRoomRow key={r.id} room={r} onOpen={onOpen} />)}

          {/* PUBLIC */}
          <View style={styles.pubHead}>
            <Text style={styles.sectionLabel}>public rooms</Text>
            <Text style={styles.pubHint}>open · anyone can step in</Text>
          </View>
          {PUBLIC.map((r) => <PublicRow key={r.id} room={r} onOpen={onOpen} />)}
        </ScrollView>

        {/* + gather a room */}
        <Pressable style={styles.fab} onPress={() => onOpen({ create: true })}>
          <LinearGradient colors={[C.ember, C.emberDeep]} style={styles.fabInner} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.fabPlus}>+</Text>
            <Text style={styles.fabText}>gather a room</Text>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 34, marginTop: 2 },

  sectionLabel: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14, letterSpacing: 0.4, paddingHorizontal: 24, marginBottom: 12 },

  // suggested
  suggCard: { width: 230, borderRadius: 22, overflow: 'hidden' },
  suggInner: { padding: 18, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,240,228,0.09)', height: 196, justifyContent: 'space-between' },
  suggTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 20, marginTop: 14 },
  suggWhy: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 6 },
  suggMeta: { flexDirection: 'row', marginTop: 12 },
  suggTag: { fontFamily: FONTS.body, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },

  // your rooms
  yourRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  yourName: { fontFamily: FONTS.medium, color: C.cream, fontSize: 15.5 },
  yourLast: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5, marginTop: 2 },
  yourTime: { fontFamily: FONTS.body, color: C.faint, fontSize: 11 },

  // public
  pubHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 24, marginTop: 26 },
  pubHint: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 12 },
  pubRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6FE0A0', marginRight: 5 },
  liveCount: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14 },
  liveLabel: { fontFamily: FONTS.body, color: C.faint, fontSize: 10, marginTop: 1 },

  // fab
  fab: { position: 'absolute', bottom: 18, alignSelf: 'center', borderRadius: 26, overflow: 'hidden' },
  fabInner: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 22, gap: 8 },
  fabPlus: { color: '#3A1505', fontSize: 20, fontWeight: '700', marginTop: -2 },
  fabText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 15 },
});
