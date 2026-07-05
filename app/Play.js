// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE PLAY WORLD. Four doors: The Battlefield (argue a motion, judged),
//  Arena (compete across a board), Stage (step into a scene), Sims (run a slice
//  of the real world). All are humans + AI together. This is the chooser; each
//  door opens its own world. Scrollable list so cards breathe as doors are added.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Grain from './Grain';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Ellipse } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { NIGHT as C, FONTS } from './theme';

function Door({ tone, kicker, title, line, glyph, onPress, delay = 0 }) {
  const b = useSharedValue(1);
  useEffect(() => {
    b.value = withRepeat(withTiming(1.05, { duration: 3400 + delay, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: b.value }] }));
  return (
    <Pressable style={styles.door} onPress={onPress}>
      <LinearGradient
        colors={['rgba(255,255,255,0.055)', 'rgba(255,255,255,0.015)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.doorInner, { borderColor: `${tone}22` }]}
      >
        <Animated.View style={[styles.doorOrb, orb]}>
          <Svg width="76" height="76" viewBox="0 0 90 90">
            <Defs>
              <RadialGradient id={`door_${title}`} cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor={tone} stopOpacity="0.55" />
                <Stop offset="55%" stopColor={tone} stopOpacity="0.16" />
                <Stop offset="100%" stopColor={tone} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="45" cy="45" r="45" fill={`url(#door_${title})`} />
          </Svg>
          <View style={styles.glyphHolder}>{glyph}</View>
        </Animated.View>
        <View style={styles.doorText}>
          <Text style={[styles.doorKicker, { color: tone }]}>{kicker}</Text>
          <Text style={styles.doorTitle}>{title}</Text>
          <Text style={styles.doorLine}>{line}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default function Play({ onEnter = () => {} }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#100E15', '#0B0A0F', '#08070B']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.kicker}>together, at play</Text>
          <Text style={styles.title}>the play</Text>
          <Text style={styles.intro}>four ways in. argue a motion, compete across a board, step into a scene, or run a slice of the real world.</Text>
        </View>

        <ScrollView
          style={styles.doorsScroll}
          contentContainerStyle={styles.doors}
          showsVerticalScrollIndicator={false}
        >
          <Door
            tone="#E0576F" kicker="argue it out" title="The Battlefield" delay={0}
            line="1v1 debate, judged by the adjudicator. reason over retrieval, truth over confidence. tournaments coming."
            onPress={() => onEnter('battlefield')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
                  stroke="#E0576F" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
          <Door
            tone="#F0A765" kicker="compete" title="Arena" delay={600}
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
            tone="#C99BE8" kicker="live it out" title="Stage" delay={1200}
            line="a courtroom, a geopolitical standoff, a whodunnit, today's headlines — step in and live it out."
            onPress={() => onEnter('stage')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M4 6h16M6 6c0 5 1.5 9 6 9s6-4 6-9M9 19h6M12 15v4"
                  stroke="#C99BE8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
          <Door
            tone="#6FC9E0" kicker="simulate" title="Sims" delay={1800}
            line="real-world emulators with the house inside them. trade a crypto book with phantom money — the economist is watching."
            onPress={() => onEnter('sims')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M3 18l5-6 4 3 6-8M15 7h4v4"
                  stroke="#6FC9E0" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
          <Door
            tone="#E7B07A" kicker="the cast performs" title="Shows" delay={2400}
            line="the traitors, story collab — social games where the personas perform and you play along."
            onPress={() => onEnter('shows')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M4 5h16v11H4zM8 20h8M12 16v4" stroke="#E7B07A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
        </ScrollView>
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

  doorsScroll: { flex: 1 },
  doors: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 24, gap: 14 },
  door: { minHeight: 116 },
  doorInner: { flexDirection: 'row', alignItems: 'center', borderRadius: 24, borderWidth: 1, padding: 18, overflow: 'hidden', gap: 16 },
  doorOrb: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  glyphHolder: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  doorText: { flex: 1 },
  doorKicker: { fontFamily: FONTS.body, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  doorTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 25, marginTop: 3 },
  doorLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, lineHeight: 18.5, marginTop: 6 },
});
