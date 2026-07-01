// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE QUIET ROOM (serious mode), built in our style (§13).
//  NOT the PWA's flat matte black. Designed calm: warm-dark depth with air,
//  a single slow pale breath at the center, words as lines in the dark.
//  Reached by a deliberate pull-DOWN gesture (drawing the curtain closed).
//  The gesture IS the meaning — you consciously call the quiet.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Ellipse } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { C, FONTS } from './theme';

const ARRIVALS = [
  "the door's shut behind you. whatever you carry, you can set it down here.",
  "no faces, no noise, no one watching. just this quiet, and me.",
  "you're here. that's enough. say whatever you need to — or just sit a while.",
  "it's just us now. no rush, no judgment. start wherever you want — or don't, yet.",
];

// ── the pull tab at the top of the app: a faint seam you draw down ──
export function QuietPull({ onOpen }) {
  const g = useSharedValue(0.3);
  const drag = useSharedValue(0);
  useEffect(() => {
    g.value = withRepeat(withTiming(0.6, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  // a real PULL-DOWN: drag the handle down past a threshold to call the quiet.
  const pan = Gesture.Pan()
    .onUpdate((e) => { drag.value = Math.max(0, Math.min(e.translationY, 140)); })
    .onEnd((e) => {
      if (e.translationY > 70) { runOnJS(onOpen)(); }
      drag.value = withTiming(0, { duration: 220 });
    });

  const handleSt = useAnimatedStyle(() => ({
    opacity: g.value + drag.value / 200,
    transform: [{ translateY: drag.value * 0.5 }, { scaleX: 1 + drag.value / 300 }],
  }));
  const hintSt = useAnimatedStyle(() => ({ opacity: Math.min(0.9, g.value + drag.value / 100), transform: [{ translateY: drag.value * 0.4 }] }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={styles.pull}>
        <Animated.View style={[styles.pullHandle, handleSt]} />
        <Animated.Text style={[styles.pullHint, hintSt]}>pull down into the quiet</Animated.Text>
      </Animated.View>
    </GestureDetector>
  );
}

// ── the room: warm-dark depth + one slow pale breath, words as lines ──
export function QuietRoom({ onClose }) {
  const [arrival] = useState(() => ARRIVALS[Math.floor(Math.random() * ARRIVALS.length)]);
  const [lines, setLines] = useState([]); // {who:'you'|'z', text}

  // the single pale presence — breathing very slowly, slower than anywhere else
  const breath = useSharedValue(0.7);
  const arrive = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }), -1, true);
    arrive.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) });
  }, []);
  const presenceStyle = useAnimatedStyle(() => ({ opacity: 0.4 + breath.value * 0.4, transform: [{ scale: 0.96 + breath.value * 0.08 }] }));
  const arrivalStyle = useAnimatedStyle(() => ({ opacity: arrive.value }));

  return (
    <View style={styles.curtain}>
      {/* warm-dark depth, not dead black — a hint of blue-grey at the edges */}
      <LinearGradient colors={['#0B0D12', '#08080C', '#060608']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.edgeWash}>
        <Svg width="100%" height="100%">
          <Defs>
            <RadialGradient id="moon" cx="50%" cy="34%" r="60%">
              <Stop offset="0%" stopColor="#3A4254" stopOpacity="0.22" />
              <Stop offset="55%" stopColor="#1A1E28" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#08080C" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50%" cy="32%" rx="80%" ry="55%" fill="url(#moon)" />
        </Svg>
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* a quiet way back up */}
        <Pressable onPress={onClose} style={styles.backUp} hitSlop={14}>
          <View style={styles.backHandle} />
        </Pressable>

        <View style={styles.presenceWrap}>
          <Animated.View style={presenceStyle}>
            <Svg width="120" height="120" viewBox="0 0 120 120">
              <Defs>
                <RadialGradient id="pale" cx="50%" cy="48%" r="50%">
                  <Stop offset="0%" stopColor="#E8E4DC" stopOpacity="0.9" />
                  <Stop offset="35%" stopColor="#AEB4C0" stopOpacity="0.5" />
                  <Stop offset="70%" stopColor="#5A6173" stopOpacity="0.18" />
                  <Stop offset="100%" stopColor="#5A6173" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="60" cy="60" r="60" fill="url(#pale)" />
            </Svg>
          </Animated.View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Animated.Text style={[styles.arrival, arrivalStyle]}>{arrival}</Animated.Text>
          {lines.map((l, i) => (
            <Text key={i} style={[styles.line, l.who === 'you' ? styles.lineYou : styles.lineZ]}>{l.text}</Text>
          ))}
        </ScrollView>

        {/* a bare input — no send button shouting, just a place to set words down */}
        <View style={styles.inputRow}>
          <Text style={styles.inputPh}>say whatever you need to…</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // pull tab
  pull: { alignItems: 'center', paddingTop: 8, paddingBottom: 10 },
  pullHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#8A8FA0' },
  pullHint: { fontFamily: FONTS.displayItalic, color: '#6A7080', fontSize: 11, marginTop: 4, letterSpacing: 0.4 },

  // the room
  curtain: { ...StyleSheet.absoluteFillObject, backgroundColor: '#08080C', zIndex: 50 },
  edgeWash: { ...StyleSheet.absoluteFillObject },
  backUp: { alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  backHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(220,220,230,0.25)' },

  presenceWrap: { alignItems: 'center', paddingTop: 30, paddingBottom: 10 },

  scroll: { paddingHorizontal: 34, paddingTop: 24, alignItems: 'center' },
  arrival: { fontFamily: FONTS.displayItalic, color: 'rgba(232,228,220,0.62)', fontSize: 18, lineHeight: 30, textAlign: 'center', maxWidth: 320 },
  line: { fontFamily: FONTS.light, fontSize: 16, lineHeight: 27, marginTop: 22, maxWidth: 320, textAlign: 'center' },
  lineYou: { color: 'rgba(240,240,244,0.92)' },
  lineZ: { color: 'rgba(190,196,208,0.78)', fontFamily: FONTS.displayItalic },

  inputRow: { paddingHorizontal: 30, paddingVertical: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  inputPh: { fontFamily: FONTS.light, color: 'rgba(200,200,210,0.3)', fontSize: 15, textAlign: 'center' },
});
