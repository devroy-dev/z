// ════════════════════════════════════════════════════════════════════════
//  yourZ — TYPE 3: THE PUBLIC ROOM (open, discoverable, ephemeral agent).
//  Entered via a DOORWAY (a threshold: topic, host, the AI present, live
//  count, "step in"). Inside: NO photo-presence row (that's for curated rooms)
//  — a leaner head with the room's identity + a live stream of many voices,
//  strangers as lightweight handles, the room's AI animating/moderating.
//  You are a GUEST: step in, speak, leave.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Grain from './Grain';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { NIGHT as C, FONTS } from './theme';

// a small live pulse dot
function LiveDot({ color = '#6FE0A0', size = 7 }) {
  const p = useSharedValue(0.5);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const st = useAnimatedStyle(() => ({ opacity: p.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, st]} />;
}

// the ephemeral AI presence — a single soft ember for the room (the host's AI)
function RoomAI({ tone = '#C99BE8' }) {
  const b = useSharedValue(0.7);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 + b.value * 0.5, transform: [{ scale: 0.94 + b.value * 0.1 }] }));
  return (
    <Animated.View style={st}>
      <Svg width="46" height="46" viewBox="0 0 46 46">
        <Defs><RadialGradient id="rai" cx="42%" cy="36%" r="64%">
          <Stop offset="0%" stopColor="#F3E8FB" /><Stop offset="45%" stopColor={tone} /><Stop offset="100%" stopColor="#5A3A78" />
        </RadialGradient></Defs>
        <Circle cx="23" cy="23" r="15" fill="url(#rai)" />
      </Svg>
    </Animated.View>
  );
}

// ── THE DOORWAY: the threshold before you step in ──
export function PublicDoorway({ room, onStep, onBack }) {
  const r = room || {};
  const tone = r.tone || '#C99BE8';
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#100E15', '#0B0A0F', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <Pressable hitSlop={10} onPress={onBack} style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <Text style={styles.chev}>‹</Text>
        </Pressable>

        <View style={styles.doorBody}>
          <View style={{ alignItems: 'center', marginBottom: 4 }}>
            <RoomAI tone={tone} />
          </View>
          <Text style={styles.doorKicker}>public room · open to anyone</Text>
          <Text style={styles.doorTitle}>{r.title || 'is AI conscious?'}</Text>
          <Text style={styles.doorTopic}>{r.topic || 'hosted room · the brainiac moderating'}</Text>

          <View style={styles.doorStats}>
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <LiveDot /><Text style={styles.statNum}>{r.live || 42}</Text>
              </View>
              <Text style={styles.statLabel}>inside now</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNum}>{r.host || 'arjun_dev'}</Text>
              <Text style={styles.statLabel}>hosting</Text>
            </View>
          </View>

          <Text style={styles.doorNote}>you're stepping into an open conversation with people you don't know. be cool. the room's keeper will keep it civil.</Text>
        </View>

        <Pressable style={styles.stepBtn} onPress={onStep}>
          <LinearGradient colors={[tone, '#7A4DA0']} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stepInner}>
            <Text style={styles.stepText}>step in</Text>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

// ── THE INTERIOR: leaner head (no photo row) + live stream of many voices ──
export function PublicInterior({ room, onLeave }) {
  const r = room || {};
  const tone = r.tone || '#C99BE8';
  const [lines] = useState(r.stream || [
    { who: 'ai', name: r.aiName || 'keeper', text: "welcome in. the question on the floor: is a system that says it's conscious any different from one that is?" },
    { who: 'stranger', name: 'nina_k', text: "i mean we can't even prove OTHER people are conscious lol" },
    { who: 'stranger', name: 'deepak', text: "behaviourally identical = morally identical imo. if it suffers convincingly, who are you to dismiss it" },
    { who: 'you', text: "but 'convincingly' is doing the work. a thermostat 'wants' a temperature." },
    { who: 'ai', name: r.aiName || 'keeper', text: "good — deepak, nina just drew a line at performance. does a convincing performance of pain deserve the benefit of the doubt?" },
    { who: 'stranger', name: 'meera.s', text: "this is why i can't sleep at night thanks" },
  ]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#100E15', '#0B0A0F', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* leaner head: room identity, NOT a gallery of faces */}
        <View style={styles.head}>
          <Pressable hitSlop={10} onPress={onLeave}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.headTitle} numberOfLines={1}>{r.title || 'is AI conscious?'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <LiveDot size={6} />
              <Text style={styles.headMeta}>{r.live || 42} inside · {r.host || 'arjun_dev'} hosting</Text>
            </View>
          </View>
          <Pressable hitSlop={8} style={styles.leaveBtn} onPress={onLeave}>
            <Text style={styles.leaveText}>leave</Text>
          </Pressable>
        </View>

        {/* the live stream — many voices */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.stream} showsVerticalScrollIndicator={false}>
          {lines.map((l, i) => {
            if (l.who === 'you') {
              return (
                <View key={i} style={[styles.row, { justifyContent: 'flex-end' }]}>
                  <LinearGradient colors={['rgba(243,168,95,0.17)', 'rgba(232,116,60,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleYou]}>
                    <Text style={styles.text}>{l.text}</Text>
                  </LinearGradient>
                </View>
              );
            }
            const isAI = l.who === 'ai';
            return (
              <View key={i} style={[styles.row, { justifyContent: 'flex-start' }]}>
                <View style={{ maxWidth: '86%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, marginLeft: 3 }}>
                    {isAI && <View style={[styles.aiPip, { backgroundColor: tone }]} />}
                    <Text style={[styles.name, { color: isAI ? tone : C.faint }]}>{l.name}{isAI ? ' · keeper' : ''}</Text>
                  </View>
                  {isAI ? (
                    <BlurView intensity={18} tint="dark" style={[styles.bubble, styles.bubbleAI, { borderColor: tone + '44' }]}>
                      <Text style={styles.text}>{l.text}</Text>
                    </BlurView>
                  ) : (
                    <View style={[styles.bubble, styles.bubbleStranger]}>
                      <Text style={styles.text}>{l.text}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* composer */}
        <View style={styles.composer}>
          <BlurView intensity={24} tint="dark" style={styles.field}>
            <Text style={styles.fieldPh}>add to the room…</Text>
          </BlurView>
          <Pressable style={styles.send}>
            <Svg width="46" height="46" viewBox="0 0 46 46">
              <Defs><RadialGradient id="psend" cx="40%" cy="34%" r="70%"><Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs>
              <Circle cx="23" cy="23" r="23" fill="url(#psend)" />
              <Path d="M15 23 L31 16 L26 31 L22.5 24.5 Z" fill="#3A1505" />
            </Svg>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ── wrapper: doorway -> interior ──
export default function PublicRoom({ room, onExit = () => {} }) {
  const [stepped, setStepped] = useState(false);
  if (!stepped) return <PublicDoorway room={room} onStep={() => setStepped(true)} onBack={onExit} />;
  return <PublicInterior room={room} onLeave={onExit} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  chev: { color: C.muted, fontSize: 30, width: 26 },

  // doorway
  doorBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  doorKicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11.5, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 16 },
  doorTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 30, textAlign: 'center', marginTop: 8 },
  doorTopic: { fontFamily: FONTS.light, color: C.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },
  doorStats: { flexDirection: 'row', alignItems: 'center', marginTop: 28, gap: 22 },
  statItem: { alignItems: 'center' },
  statNum: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 18 },
  statLabel: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
  doorNote: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 28, maxWidth: 300 },
  stepBtn: { marginHorizontal: 24, marginBottom: 10, borderRadius: 24, overflow: 'hidden' },
  stepInner: { paddingVertical: 16, alignItems: 'center' },
  stepText: { fontFamily: FONTS.semibold, color: '#fff', fontSize: 16, letterSpacing: 0.3 },

  // interior head
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 4, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 18 },
  headMeta: { fontFamily: FONTS.body, color: C.faint, fontSize: 11.5 },
  leaveBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,150,150,0.25)' },
  leaveText: { fontFamily: FONTS.medium, color: '#9E9DB0', fontSize: 12 },

  // stream
  stream: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  row: { flexDirection: 'row', marginBottom: 13 },
  name: { fontFamily: FONTS.medium, fontSize: 11.5, letterSpacing: 0.2 },
  aiPip: { width: 6, height: 6, borderRadius: 3 },
  bubble: { paddingVertical: 11, paddingHorizontal: 15, borderRadius: 18, overflow: 'hidden' },
  bubbleAI: { backgroundColor: 'rgba(201,155,232,0.08)', borderWidth: 1, borderTopLeftRadius: 5 },
  bubbleStranger: { backgroundColor: 'rgba(255,255,255,0.045)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 5 },
  bubbleYou: { borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', borderBottomRightRadius: 5, maxWidth: '84%' },
  text: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 14.5, lineHeight: 21 },

  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  field: { flex: 1, borderRadius: 24, paddingVertical: 13, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  fieldPh: { fontFamily: FONTS.body, color: C.faint, fontSize: 14.5 },
  send: { width: 46, height: 46 },
});
