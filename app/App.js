// ════════════════════════════════════════════════════════════════════════
//  yourZ — first native screen (the premium chat, look-and-feel slice)
//  Translates the approved concept into React Native. Mock conversation,
//  no auth/streaming yet — this slice proves the design survives on-device.
//  Single self-contained file on purpose: fewest moving parts for the first run.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, Platform, Image } from 'react-native';
import { useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import {
  useFonts,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
} from '@expo-google-fonts/fraunces';
import {
  Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
} from '@expo-google-fonts/figtree';

// ── the locked palette ──────────────────────────────────────────────────
const C = {
  void:      '#0E0912',
  ground:    '#07050A',
  cream:     '#F5ECE1',
  muted:     '#A1929B',
  faint:     '#6A5E69',
  ember:     '#F3A85F',
  emberHot:  '#FF8A52',
  emberDeep: '#B5572E',
  accent:    '#F0A765',
  accentSoft:'#E9A98A',
};

// ── the "thread" the user configured: their chosen name + DP; codex/description is fixed ──
// (mirrors the engine: companion_name + avatar are the user's; the persona description stays)
const THREAD_CFG = {
  name: 'Kabir',
  dp: 'https://callmez.app/faces/the_brother.jpg', // user's pick → falls back to persona default → orb
  sub: 'the brother · always in your corner',       // from the fixed persona description
};

// ── mock conversation (the brother, named Kabir) ─────────────────────────
const THREAD = [
  { id: 1, who: 'you',  text: "didn't get the promotion. third time now.", time: '9:38' },
  { id: 2, who: 'them', text: "third time they've dangled it and pulled it back. okay — that's not you fumbling, that's a them pattern. you're not crazy for being done with it.", time: '9:38' },
  { id: 3, who: 'them', text: "so. do we vent it out first, or go straight to what you do next?", time: '9:39', moment: true },
];

// ── a single rising ember mote ───────────────────────────────────────────
function Spark({ left, delay }) {
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withTiming(-220, { duration: 11000, easing: Easing.linear }), -1, false));
    o.value = withDelay(delay, withRepeat(withTiming(1, { duration: 11000, easing: Easing.linear }), -1, false));
  }, []);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: o.value < 0.12 ? o.value / 0.12 * 0.8 : (o.value > 0.7 ? (1 - o.value) / 0.3 * 0.5 : 0.6),
  }));
  return <Animated.View style={[styles.spark, { left }, st]} />;
}

// ── the cinematic atmosphere behind everything ───────────────────────────
function Atmosphere() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.07, { duration: 3750, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const glow = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#1a1020', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.glowWrap, glow]}>
        <Svg width="460" height="420" viewBox="0 0 460 420">
          <Defs>
            <RadialGradient id="g" cx="50%" cy="42%" r="55%">
              <Stop offset="0%" stopColor={C.emberHot} stopOpacity="0.55" />
              <Stop offset="26%" stopColor={C.ember} stopOpacity="0.30" />
              <Stop offset="50%" stopColor={C.emberDeep} stopOpacity="0.12" />
              <Stop offset="100%" stopColor={C.emberDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="230" cy="190" rx="230" ry="200" fill="url(#g)" />
        </Svg>
      </Animated.View>
      {[['32%', 0], ['58%', 3200], ['46%', 6400], ['70%', 8100], ['22%', 5000]].map(([l, d], i) => (
        <Spark key={i} left={l} delay={d} />
      ))}
      {/* vignette pulls the eye in */}
      <LinearGradient colors={['transparent', 'transparent', C.void]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
}

// ── the persona presence (the signature): DP inside the breathing ember ring ──
function Presence() {
  const s = useSharedValue(1);
  const [imgOk, setImgOk] = useState(true);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const breathe = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const hasDp = THREAD_CFG.dp && imgOk;

  return (
    <View style={styles.presence}>
      <Animated.View style={[styles.presenceRing, breathe]}>
        {/* the ember halo bloom behind the ring */}
        <View style={styles.haloGlow} />
        {hasDp ? (
          <View style={styles.dpFrame}>
            <Image
              source={{ uri: THREAD_CFG.dp }}
              style={styles.dpImg}
              onError={() => setImgOk(false)}
            />
            {/* warm light wash over the photo so it lives in the ember world, not a pasted-in pic */}
            <LinearGradient
              colors={['rgba(255,138,82,0.18)', 'transparent', 'rgba(120,40,15,0.28)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.dpInnerEdge} />
          </View>
        ) : (
          // fallback: the pure ember orb (no DP set / image failed)
          <Svg width="92" height="92" viewBox="0 0 92 92">
            <Defs>
              <RadialGradient id="orb" cx="38%" cy="34%" r="68%">
                <Stop offset="0%" stopColor="#FFD9B0" />
                <Stop offset="30%" stopColor={C.ember} />
                <Stop offset="66%" stopColor={C.accentSoft} />
                <Stop offset="100%" stopColor={C.emberDeep} />
              </RadialGradient>
            </Defs>
            <Circle cx="46" cy="44" r="30" fill="url(#orb)" />
          </Svg>
        )}
      </Animated.View>
      <Text style={styles.presenceName}>{THREAD_CFG.name}</Text>
      <Text style={styles.presenceSub}>{THREAD_CFG.sub}</Text>
    </View>
  );
}

// ── a message ────────────────────────────────────────────────────────────
function Bubble({ m }) {
  const mine = m.who === 'you';
  return (
    <View style={[styles.msgRow, mine ? styles.alignR : styles.alignL]}>
      {mine ? (
        <LinearGradient
          colors={['rgba(243,168,95,0.16)', 'rgba(232,116,60,0.10)']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.bubble, styles.bubbleYou]}
        >
          <Text style={styles.bubbleText}>{m.text}</Text>
        </LinearGradient>
      ) : (
        <BlurView intensity={22} tint="dark" style={[styles.bubble, styles.bubbleThem]}>
          <Text style={[styles.bubbleText, m.moment && styles.moment]}>{m.text}</Text>
        </BlurView>
      )}
      <Text style={[styles.meta, mine && { textAlign: 'right' }]}>
        {mine ? m.time : `Kabir · ${m.time}`}
      </Text>
    </View>
  );
}

function Composer() {
  return (
    <View style={styles.composer}>
      <BlurView intensity={26} tint="dark" style={styles.field}>
        <Text style={styles.fieldIcon}>＋</Text>
        <Text style={styles.fieldPh}>Message Kabir…</Text>
        <Text style={styles.fieldIcon}>🎙</Text>
      </BlurView>
      <View style={styles.send}>
        <Svg width="46" height="46" viewBox="0 0 46 46">
          <Defs>
            <RadialGradient id="send" cx="40%" cy="35%" r="70%">
              <Stop offset="0%" stopColor="#FFCF9E" />
              <Stop offset="40%" stopColor={C.ember} />
              <Stop offset="100%" stopColor={C.emberDeep} />
            </RadialGradient>
          </Defs>
          <Circle cx="23" cy="23" r="23" fill="url(#send)" />
          <Path d="M15 23 L31 16 L26 31 L22.5 24.5 Z" fill="#3a1505" />
        </Svg>
      </View>
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.void }} />;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <Atmosphere />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* top bar */}
          <View style={styles.topbar}>
            <Text style={styles.chev}>‹</Text>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={styles.topName}>Kabir</Text>
              <Text style={styles.topStatus}>here</Text>
            </View>
            <Text style={styles.more}>⋯</Text>
          </View>

          <Presence />

          <View style={styles.convo}>
            <Text style={styles.daymark}>tonight</Text>
            {THREAD.map((m) => <Bubble key={m.id} m={m} />)}
          </View>

          <Composer />
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  safe: { flex: 1 },

  glowWrap: { position: 'absolute', top: -30, left: 0, right: 0, alignItems: 'center' },
  spark: { position: 'absolute', bottom: 260, width: 3, height: 3, borderRadius: 2, backgroundColor: C.ember },

  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 2 },
  chev: { color: C.muted, fontSize: 30, marginTop: -4 },
  topName: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 17 },
  topStatus: { fontFamily: 'Figtree_400Regular', color: C.accentSoft, fontSize: 11, marginTop: 1, letterSpacing: 0.4 },
  more: { color: C.muted, fontSize: 22, letterSpacing: 2 },

  presence: { alignItems: 'center', paddingTop: 26, paddingBottom: 14 },
  presenceRing: { width: 100, height: 100, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  haloGlow: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: C.emberHot, opacity: 0.22,
    // soft bloom; on native this reads as a glow behind the ring
    shadowColor: C.emberHot, shadowOpacity: 0.9, shadowRadius: 30, shadowOffset: { width: 0, height: 0 },
  },
  dpFrame: {
    width: 92, height: 92, borderRadius: 46, overflow: 'hidden',
    borderWidth: 2, borderColor: 'rgba(243,168,95,0.55)',
    shadowColor: C.emberHot, shadowOpacity: 0.7, shadowRadius: 22, shadowOffset: { width: 0, height: 0 },
  },
  dpImg: { width: '100%', height: '100%' },
  dpInnerEdge: {
    ...StyleSheet.absoluteFillObject, borderRadius: 46,
    borderWidth: 1, borderColor: 'rgba(255,220,180,0.35)',
  },
  presenceName: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 30, letterSpacing: 0.3 },
  presenceSub: { fontFamily: 'Figtree_300Light', color: C.muted, fontSize: 12.5, marginTop: 5, letterSpacing: 0.5 },

  convo: { flex: 1, paddingHorizontal: 20, paddingTop: 10 },
  daymark: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 12.5, textAlign: 'center', marginBottom: 14, letterSpacing: 0.6 },

  msgRow: { marginBottom: 16, maxWidth: '80%' },
  alignL: { alignSelf: 'flex-start' },
  alignR: { alignSelf: 'flex-end' },
  bubble: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 22, overflow: 'hidden' },
  bubbleThem: { backgroundColor: 'rgba(255,241,230,0.055)', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', borderBottomLeftRadius: 7 },
  bubbleYou: { borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', borderBottomRightRadius: 7 },
  bubbleText: { fontFamily: 'Figtree_400Regular', color: '#F1E7DC', fontSize: 15, lineHeight: 22 },
  moment: { fontFamily: 'Fraunces_400Regular_Italic', color: '#FCE9D6', fontSize: 16.5, lineHeight: 24 },
  meta: { fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 10.5, marginTop: 6, paddingHorizontal: 6, letterSpacing: 0.4 },

  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 11 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 26, paddingVertical: 13, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  fieldPh: { flex: 1, fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 14.5 },
  fieldIcon: { color: C.muted, fontSize: 17, opacity: 0.8 },
  send: { width: 46, height: 46 },
});
