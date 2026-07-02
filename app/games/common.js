// ════════════════════════════════════════════════════════════════════════
//  yourZ — shared game-table pieces. Every table imports from here:
//  the tumbling Die, haptics guard, seat tones, faces. One die, many games.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Rect, Circle } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat, Easing,
} from 'react-native-reanimated';

export const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
export const SEAT_TONES = ['#F3A85F', '#6FC9E0', '#F0708C', '#8FD98F'];

let Haptics = null; try { Haptics = require('expo-haptics'); } catch (_) {}
// ── the haptic vocabulary: ONE language across every table ──────────────
//  tick    · selection changes (picking cards, choosing a chip)
//  tap     · a piece moves: deal, roll, token step        (light)
//  knock   · something lands with weight: double, big play (medium)
//  thud    · bad news: bust, capture, snake bite           (heavy)
//  win     · you take the hand / the game                  (success)
//  lose    · the table takes you                           (error)
export const buzz = (kind) => { try {
  if (!Haptics) return;
  if (kind === 'tick') Haptics.selectionAsync();
  else if (kind === 'knock') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  else if (kind === 'heavy' || kind === 'thud') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  else if (kind === 'success' || kind === 'win') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'lose') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);   // 'tap' / default
} catch (_) {} };

// the die: 2.5D tumble illusion; settles with a back-ease snap (the beat)
export function Die({ value, rolling, onPress, enabled, tone }) {
  const spin = useSharedValue(0);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (rolling) {
      spin.value = withRepeat(withTiming(360, { duration: 260, easing: Easing.linear }), -1, false);
      scale.value = withRepeat(withTiming(1.15, { duration: 130 }), -1, true);
    } else {
      spin.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.back(1.4)) });
      scale.value = withSequence(withTiming(1.25, { duration: 110 }), withSpring(1, { damping: 9 }));
    }
  }, [rolling]);
  const st = useAnimatedStyle(() => ({
    transform: [{ perspective: 500 }, { rotateX: `${spin.value}deg` }, { rotateZ: `${spin.value * 0.6}deg` }, { scale: scale.value }],
  }));
  const pips = { 1:[[24,24]], 2:[[13,13],[35,35]], 3:[[13,13],[24,24],[35,35]],
    4:[[13,13],[13,35],[35,13],[35,35]], 5:[[13,13],[13,35],[24,24],[35,13],[35,35]],
    6:[[13,11],[13,24],[13,37],[35,11],[35,24],[35,37]] }[value || 6];
  return (
    <Pressable onPress={enabled ? onPress : undefined} hitSlop={10}>
      <Animated.View style={[dieStyles.die, enabled && { borderColor: tone, shadowColor: tone }, st]}>
        <Svg width="48" height="48" viewBox="0 0 48 48">
          <Rect x="2" y="2" width="44" height="44" rx="10" fill="#F5ECE1" />
          <Rect x="2" y="2" width="44" height="44" rx="10" fill="none" stroke="#B5572E" strokeOpacity="0.35" strokeWidth="1.5" />
          {(rolling ? [[24,24]] : pips).map(([px, py], i) => <Circle key={i} cx={px} cy={py} r="4.2" fill="#2A1508" />)}
        </Svg>
      </Animated.View>
    </Pressable>
  );
}
const dieStyles = StyleSheet.create({
  die: { width: 48, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
});
