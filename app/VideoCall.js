// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE VIDEO CALL (face call). The ember presence blooms into the
//  persona's face, filling the frame, looking at you, talking. Same soul,
//  shown. Intimate/cinematic/dark — never clinical. Captions flow (voice via
//  Sarvam, wired later). Minimal fading controls.
//
//  ⚠️ TALKING-HEAD POLICY (see bible §16/§16b):
//    ✅ curated personas (ours) — animate.
//    ✅ historical figures (public-domain, long-dead: Napoleon, Gandhi…) — animate.
//       This is the safe lane to build/showcase the talking-head properly.
//    ⛔ real LIVING people (user uploads of an ex, politician, celeb, anyone
//       identifiable & alive) — HARD BLOCK before launch. = deepfake; store-banned.
//       Living-person custom photos fall back to the breathing-PRESENCE call.
//    ANIMATE_CUSTOM_FACES below is a PRIVATE on-device test flag only; must be
//    false in any build that leaves the device. Replace with the tiered check
//    (curated+historical animate; living-person blocked) before launch.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';

// ⚠️ DEV ONLY — private on-device testing. MUST be false for any build that
// leaves the device. Before launch, replace with the tiered policy (curated +
// historical figures animate; identifiable living people HARD-BLOCKED -> presence
// fallback). See bible §16b.
const ANIMATE_CUSTOM_FACES = true;

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=3`;

// rotating caption lines (stand-in for streamed speech + Sarvam voice)
const SPEECH = [
  "hey. i'm really glad you called.",
  "third time they passed you over — that's not on you. that's them.",
  "talk to me. what's actually going on in your head right now?",
];

export default function VideoCall({ persona, onEnd = () => {} }) {
  const pkey = persona?.key || 'the_brother';
  const name = persona?.name || 'Kabir';
  const customUri = persona?.customPhoto || null; // a user-supplied face, if any
  const faceUri = customUri || faceFor(pkey);
  const isCustom = !!customUri;

  // whether this face is allowed to "animate" (talking-head). Curated always may;
  // custom only under the DEV flag — and never in a store build.
  const mayAnimate = !isCustom || ANIMATE_CUSTOM_FACES;

  const [ok, setOk] = useState(true);
  const [captionIdx, setCaptionIdx] = useState(0);
  const [speaking, setSpeaking] = useState(true);

  // bloom-in (presence -> face), and a speaking pulse that stands in for talking-head motion
  const bloom = useSharedValue(0);
  const speak = useSharedValue(0);
  useEffect(() => {
    bloom.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) });
  }, []);
  useEffect(() => {
    if (mayAnimate && speaking) {
      // subtle, life-like motion + glow while "speaking" (stand-in for lip-synced animation)
      speak.value = withRepeat(withTiming(1, { duration: 380, easing: Easing.inOut(Easing.ease) }), -1, true);
    } else {
      speak.value = withTiming(0, { duration: 300 });
    }
  }, [mayAnimate, speaking]);

  // cycle captions to simulate the conversation
  useEffect(() => {
    const t = setInterval(() => {
      setSpeaking(false);
      setTimeout(() => { setCaptionIdx((i) => (i + 1) % SPEECH.length); setSpeaking(true); }, 600);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  const faceStyle = useAnimatedStyle(() => ({
    opacity: bloom.value,
    transform: [
      { scale: 0.86 + bloom.value * 0.14 + (mayAnimate ? speak.value * 0.006 : 0) },
      { translateY: mayAnimate ? speak.value * -1.2 : 0 },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.4 + bloom.value * 0.3 + (mayAnimate ? speak.value * 0.18 : 0) }));

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0E12', '#0E0912', '#070509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />

      {/* the warm bloom behind the face */}
      <Animated.View style={[styles.bloomGlow, glowStyle]} pointerEvents="none">
        <Svg width="460" height="460" viewBox="0 0 460 460">
          <Defs><RadialGradient id="callGlow" cx="50%" cy="42%" r="55%">
            <Stop offset="0%" stopColor={C.emberHot} stopOpacity="0.32" />
            <Stop offset="45%" stopColor={C.ember} stopOpacity="0.14" />
            <Stop offset="100%" stopColor={C.ember} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="230" cy="210" r="230" fill="url(#callGlow)" />
        </Svg>
      </Animated.View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* who you're with */}
        <View style={styles.topMeta}>
          <Text style={styles.callName}>{name}</Text>
          <Text style={styles.callState}>{speaking ? 'speaking…' : 'listening'}{isCustom ? '' : ''}</Text>
        </View>

        {/* the face — fills the frame, looking at you */}
        <View style={styles.faceStage}>
          <Animated.View style={[styles.faceFrame, faceStyle]}>
            {ok ? (
              <Image source={{ uri: faceUri }} resizeMode="cover" style={styles.faceImg} onError={() => setOk(false)} />
            ) : (
              <Svg width="100%" height="100%" viewBox="0 0 300 300">
                <Defs><RadialGradient id="faceFallback" cx="42%" cy="36%" r="64%">
                  <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="45%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
                </RadialGradient></Defs>
                <Circle cx="150" cy="150" r="150" fill="url(#faceFallback)" />
              </Svg>
            )}
            {/* a soft vignette so the face sits in the dark, not floating */}
            <LinearGradient colors={['transparent', 'transparent', 'rgba(7,5,9,0.55)']} locations={[0, 0.6, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
          </Animated.View>

          {/* dev marker: when a custom face is animated, surface it (so we never forget) */}
          {isCustom && ANIMATE_CUSTOM_FACES && (
            <View style={styles.devTag}><Text style={styles.devTagText}>dev only · block living people before launch</Text></View>
          )}
        </View>

        {/* captions — what they're saying (Sarvam voice later) */}
        <View style={styles.captionWrap}>
          <Text style={styles.caption}>{SPEECH[captionIdx]}</Text>
        </View>

        {/* your self-view, small, corner */}
        <View style={styles.selfView}>
          <LinearGradient colors={['#2A2030', '#160F1C']} style={StyleSheet.absoluteFill} />
          <Text style={styles.selfLabel}>you</Text>
        </View>

        {/* minimal controls */}
        <View style={styles.controls}>
          <Control glyph="mic" />
          <EndCall onPress={onEnd} />
          <Control glyph="voice" />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Control({ glyph }) {
  return (
    <Pressable style={styles.ctrl}>
      <BlurView intensity={24} tint="dark" style={styles.ctrlInner}>
        <Svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          {glyph === 'mic' && <Path d="M12 4a3 3 0 013 3v5a3 3 0 01-6 0V7a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v3" stroke={C.cream} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />}
          {glyph === 'voice' && <Path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" stroke={C.cream} strokeWidth="1.7" strokeLinecap="round" />}
        </Svg>
      </BlurView>
    </Pressable>
  );
}

function EndCall({ onPress }) {
  return (
    <Pressable style={styles.end} onPress={onPress}>
      <Svg width="64" height="64" viewBox="0 0 64 64">
        <Defs><RadialGradient id="endg" cx="42%" cy="36%" r="64%"><Stop offset="0%" stopColor="#FF7A6A" /><Stop offset="100%" stopColor="#C0312A" /></RadialGradient></Defs>
        <Circle cx="32" cy="32" r="32" fill="url(#endg)" />
        <Path d="M20 28c8-5 16-5 24 0l-2 5-6-1-1-4c-2-.6-3-.6-5 0l-1 4-6 1z" fill="#fff" transform="rotate(135 32 32)" />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070509' },
  bloomGlow: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center' },

  topMeta: { alignItems: 'center', paddingTop: 8 },
  callName: { fontFamily: FONTS.display, color: C.cream, fontSize: 24 },
  callState: { fontFamily: FONTS.light, color: C.accentSoft, fontSize: 13, marginTop: 2, letterSpacing: 0.5 },

  faceStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  faceFrame: { width: 300, height: 380, borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(243,168,95,0.18)', backgroundColor: '#160F1C' },
  faceImg: { width: '100%', height: '100%' },
  devTag: { position: 'absolute', bottom: 8, backgroundColor: 'rgba(255,120,90,0.9)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  devTagText: { fontFamily: FONTS.medium, color: '#2A0A06', fontSize: 10, letterSpacing: 0.3 },

  captionWrap: { paddingHorizontal: 40, minHeight: 60, justifyContent: 'center' },
  caption: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 17, lineHeight: 25, textAlign: 'center' },

  selfView: { position: 'absolute', right: 18, top: 96, width: 84, height: 112, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  selfLabel: { fontFamily: FONTS.body, color: C.muted, fontSize: 11 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26, paddingBottom: 14, paddingTop: 6 },
  ctrl: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  ctrlInner: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  end: { width: 64, height: 64 },
});
