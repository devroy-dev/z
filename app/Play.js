// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE PLAY WORLD. Two doors: Arena (compete) + Stage (step into a
//  scene). Both are humans + AI together — Arena always has ≥1 AI; Stage is
//  rehearsal for real life. This is the chooser; each door opens its own world.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Ellipse } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';

function Door({ tone, kicker, title, line, glyph, onPress, delay = 0 }) {
  const b = useSharedValue(1);
  useEffect(() => {
    b.value = withRepeat(withTiming(1.04, { duration: 3400 + delay, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: b.value }] }));
  return (
    <Pressable style={styles.door} onPress={onPress}>
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.015)']}
        style={styles.doorInner}
      >
        <Animated.View style={[styles.doorOrb, orb]}>
          <Svg width="90" height="90" viewBox="0 0 90 90">
            <Defs>
              <RadialGradient id={`door_${title}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={tone} stopOpacity="0.5" />
                <Stop offset="55%" stopColor={tone} stopOpacity="0.14" />
                <Stop offset="100%" stopColor={tone} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="45" cy="45" r="45" fill={`url(#door_${title})`} />
            <View />
          </Svg>
          <View style={styles.glyphHolder}>{glyph}</View>
        </Animated.View>
        <Text style={[styles.doorKicker, { color: tone }]}>{kicker}</Text>
        <Text style={styles.doorTitle}>{title}</Text>
        <Text style={styles.doorLine}>{line}</Text>
      </LinearGradient>
    </Pressable>
  );
}

export default function Play({ onEnter = () => {} }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#150C1C', '#0C0814', '#070509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.kicker}>together, at play</Text>
          <Text style={styles.title}>the play</Text>
          <Text style={styles.intro}>two ways in. compete across a board, or step into a scene and find out how you'd really handle it.</Text>
        </View>

        <View style={styles.doors}>
          <Door
            tone="#F0A765" kicker="compete" title="Arena"
            line="games with friends — and always one of them. backgammon, bluff, and more."
            onPress={() => onEnter('arena')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.92 5.4L12 15.4 7.2 17.9l.9-5.4L4.2 8.7l5.4-.8z"
                  stroke="#F0A765" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              </Svg>
            }
          />
          <Door
            tone="#C99BE8" kicker="rehearse" title="Stage" delay={600}
            line="a courtroom, a geopolitical standoff, a whodunnit, today's headlines — step in and find out how you'd really handle it."
            onPress={() => onEnter('stage')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M4 6h16M6 6c0 5 1.5 9 6 9s6-4 6-9M9 19h6M12 15v4"
                  stroke="#C99BE8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 34, marginTop: 2 },
  intro: { fontFamily: FONTS.light, color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 330 },

  doors: { flex: 1, paddingHorizontal: 20, paddingTop: 14, gap: 18 },
  door: { flex: 1 },
  doorInner: { flex: 1, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,240,228,0.09)', padding: 24, justifyContent: 'center', overflow: 'hidden' },
  doorOrb: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  glyphHolder: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  doorKicker: { fontFamily: FONTS.body, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  doorTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 28, marginTop: 3 },
  doorLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8, maxWidth: 300 },
});
