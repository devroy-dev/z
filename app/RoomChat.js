// ════════════════════════════════════════════════════════════════════════
//  yourZ — TYPE 1 ROOM INTERIOR (persona-group chat).
//  The conversation happens AMONG the presences. A row of embers across the
//  top = who's in the room. When the director gives someone the floor, THEIR
//  ember rises and warms while the others rest — you SEE who's speaking.
//  Mirrors groupLoop.ts: sequential turn-taking, one speaker at a time,
//  each seeing what came before. Words flow below, tagged to the lit presence.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing,
} from 'react-native-reanimated';
import { C, FONTS, TONES } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

// ── one presence in the room's top row. `active` = it has the floor (rises/warms). ──
function RoomPresence({ pkey, name, tone, active }) {
  const [ok, setOk] = useState(true);
  const breath = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1.04, { duration: 3000 + (pkey.length % 5) * 200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  useEffect(() => {
    // rise when given the floor, settle when not
    lift.value = withTiming(active ? 1 : 0, { duration: 520, easing: Easing.out(Easing.ease) });
  }, [active]);

  const wrap = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 14 }, { scale: 0.9 + lift.value * 0.2 }],
    opacity: 0.5 + lift.value * 0.5,
  }));
  const halo = useAnimatedStyle(() => ({ opacity: lift.value * 0.9, transform: [{ scale: breath.value * (1 + lift.value * 0.15) }] }));
  const S = 52;  // shared baseline size (matches humans)
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
          <Svg width={S + 14} height={S + 14}>
            <Defs><RadialGradient id={`rh_${pkey}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={tone} stopOpacity="0.6" /><Stop offset="60%" stopColor={tone} stopOpacity="0.15" /><Stop offset="100%" stopColor={tone} stopOpacity="0" />
            </RadialGradient></Defs>
            <Circle cx={(S + 14) / 2} cy={(S + 14) / 2} r={(S + 14) / 2} fill={`url(#rh_${pkey})`} />
          </Svg>
        </Animated.View>
        <View style={[styles.rpFace, { width: S, height: S, borderRadius: S / 2, borderColor: tone }]}>
          {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: S / 2 }} onError={() => setOk(false)} />
              : <Svg width={S} height={S} viewBox="0 0 54 54"><Defs><RadialGradient id={`rf_${pkey}`} cx="38%" cy="33%" r="70%"><Stop offset="0%" stopColor="#FFD09A" /><Stop offset="60%" stopColor={tone} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs><Circle cx="27" cy="27" r="27" fill={`url(#rf_${pkey})`} /></Svg>}
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: C.cream }]} numberOfLines={1}>{name}</Text>
    </Animated.View>
  );
}


// ── a human in the room: present, but plainer/cooler than an AI presence ──
function HumanPresence({ name, hue = '#8FA0C0', active }) {
  const lift = useSharedValue(0);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 420, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 14 }, { scale: 0.9 + lift.value * 0.2 }], opacity: 0.5 + lift.value * 0.5 }));
  const S = 52;  // shared baseline size (matches humans)
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.humanFace, { width: S, height: S, borderRadius: S / 2, borderColor: active ? hue : 'rgba(180,190,210,0.35)' }]}>
          <Text style={[styles.humanInitials, { color: active ? '#E8ECF4' : '#AEB6C6' }]}>{initials}</Text>
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: '#D8DEEA' }]} numberOfLines={1}>{name.split(' ')[0]}</Text>
    </Animated.View>
  );
}

// ── a spoken line, tagged to whoever the director lit ──
function RoomLine({ line, tone }) {
  const mine = line.who === 'you';
  if (mine) {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-end' }]}>
        <LinearGradient colors={['rgba(243,168,95,0.17)', 'rgba(232,116,60,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleYou]}>
          <Text style={styles.bubbleText}>{line.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  if (line.who === 'human') {
    return (
      <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
        <View style={{ maxWidth: '84%' }}>
          <Text style={[styles.speaker, { color: '#9FB0CE' }]}>{line.name}</Text>
          <View style={[styles.bubble, styles.bubbleHuman]}>
            <Text style={styles.bubbleText}>{line.text}</Text>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.lineRow, { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '84%' }}>
        <Text style={[styles.speaker, { color: tone }]}>{line.name}</Text>
        <BlurView intensity={18} tint="dark" style={[styles.bubble, styles.bubbleThem]}>
          <Text style={styles.bubbleText}>{line.text}</Text>
        </BlurView>
      </View>
    </View>
  );
}

export default function RoomChat({ room, onBack = () => {} }) {
  // seed a room (falls back to a default persona-group if none passed)
  const members = room?.members || [
    { key: 'the_brainiac',    name: 'the brainiac',    tone: TONES.crazies },
    { key: 'the_cynic',       name: 'the cynic',       tone: TONES.crazies },
    { key: 'the_philosopher', name: 'the philosopher', tone: TONES.crazies },
  ];
  const title = room?.title || 'sunday debate club';
  // Type 2 = invited room: real humans present alongside personas.
  const humans = room?.humans || [];
  const isInvited = humans.length > 0 || room?.type === 'invited';

  const [lines, setLines] = useState(room?.lines || [
    { who: 'you', text: "is free will real or are we kidding ourselves?" },
    { who: 'them', key: 'the_philosopher', name: 'the philosopher', text: "the honest answer: we don't know — but the question changes how you live, so it's not idle." },
    { who: 'them', key: 'the_brainiac', name: 'the brainiac', text: "careful. 'we don't know' is doing a lot of work there. the determinist case is tighter than you're admitting." },
    { who: 'them', key: 'the_cynic', name: 'the cynic', text: "or — and hear me out — it doesn't matter, because you'll do what you were always going to do either way." },
  ]);

  // the director's "floor": whoever holds the room right now rises; everyone else rests.
  // Build the speaker order from BOTH personas and humans, so the elevation passes between
  // AI and people alike. Each human line is matched back to its presence id by first name.
  const [floor, setFloor] = useState(null);
  const idx = useRef(0);
  useEffect(() => {
    const order = lines
      .map((l) => {
        if (l.who === 'them') return l.key;
        if (l.who === 'human') {
          const h = humans.find((x) => x.name.split(' ')[0].toLowerCase() === (l.name || '').split(' ')[0].toLowerCase());
          return h ? h.id : null;
        }
        return null; // 'you' never rises in the row
      })
      .filter(Boolean);
    if (!order.length) return;
    // start on the most recent speaker, then cycle so the rise visibly moves across the room
    idx.current = order.length - 1;
    setFloor(order[idx.current]);
    const t = setInterval(() => {
      idx.current = (idx.current + 1) % order.length;
      setFloor(order[idx.current]);
    }, 2600);
    return () => clearInterval(t);
  }, [lines, humans]);

  const toneOf = (k) => members.find(m => m.key === k)?.tone || C.ember;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#150C1C', '#0C0814', '#070509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* top bar */}
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle}>{title}</Text>
            <Text style={styles.roomSub}>
              {members.map(m => m.name.replace('the ', '')).join(' · ')}
              {humans.length > 0 ? `  +  ${humans.map(h => h.name.split(' ')[0]).join(', ')}` : ''}
            </Text>
          </View>
          {isInvited && (
            <Pressable hitSlop={8} style={styles.inviteBtn}>
              <Svg width="14" height="14" viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={C.accentSoft} strokeWidth="2" strokeLinecap="round" /></Svg>
              <Text style={styles.inviteText}>invite</Text>
            </Pressable>
          )}
        </View>

        {/* the presences — the room. personas (warm embers) + humans (cooler). lit one rises. */}
        <View style={styles.stage}>
          {members.map((m) => (
            <RoomPresence key={m.key} pkey={m.key} name={m.name.replace('the ', '')} tone={m.tone} active={floor === m.key} />
          ))}
          {humans.map((h) => (
            <HumanPresence key={h.id} name={h.name} active={floor === h.id} />
          ))}
        </View>

        {/* the conversation among them */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.convo} showsVerticalScrollIndicator={false}>
          {lines.map((l, i) => <RoomLine key={i} line={l} tone={toneOf(l.key)} />)}
        </ScrollView>

        {/* composer */}
        <View style={styles.composer}>
          <BlurView intensity={24} tint="dark" style={styles.field}>
            <Text style={styles.fieldPh}>say something to the room…</Text>
          </BlurView>
          <Pressable style={styles.send}>
            <Svg width="46" height="46" viewBox="0 0 46 46">
              <Defs><RadialGradient id="rsend" cx="40%" cy="34%" r="70%"><Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs>
              <Circle cx="23" cy="23" r="23" fill="url(#rsend)" />
              <Path d="M15 23 L31 16 L26 31 L22.5 24.5 Z" fill="#3A1505" />
            </Svg>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  roomTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 19 },
  roomSub: { fontFamily: FONTS.light, color: C.muted, fontSize: 12, marginTop: 1 },

  stage: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', height: 118, paddingHorizontal: 12, paddingTop: 8 },
  rpWrap: { alignItems: 'center', width: 84 },
  rpFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1a121f' },
  rpName: { fontFamily: FONTS.body, color: C.faint, fontSize: 11.5, marginTop: 6 },

  convo: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  lineRow: { flexDirection: 'row', marginBottom: 14 },
  speaker: { fontFamily: FONTS.medium, fontSize: 12, marginBottom: 4, marginLeft: 4, letterSpacing: 0.3 },
  bubble: { paddingVertical: 12, paddingHorizontal: 15, borderRadius: 20, overflow: 'hidden' },
  bubbleThem: { backgroundColor: 'rgba(255,241,230,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', borderTopLeftRadius: 6 },
  bubbleYou: { borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', borderBottomRightRadius: 6, maxWidth: '84%' },
  bubbleText: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 14.5, lineHeight: 21 },

  humanFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: 'rgba(40,46,60,0.6)' },
  humanInitials: { fontFamily: FONTS.semibold, fontSize: 16 },
  bubbleHuman: { backgroundColor: 'rgba(150,165,200,0.10)', borderWidth: 1, borderColor: 'rgba(160,175,210,0.18)', borderTopLeftRadius: 6 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', backgroundColor: 'rgba(243,168,95,0.06)' },
  inviteText: { fontFamily: FONTS.medium, color: C.accentSoft, fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  field: { flex: 1, borderRadius: 24, paddingVertical: 13, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  fieldPh: { fontFamily: FONTS.body, color: C.faint, fontSize: 14.5 },
  send: { width: 46, height: 46 },
});
