// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO visual layer, extracted verbatim from the original table
//  (the felt was good; the logic underneath was not). Pure presentation.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { C, FONTS } from '../../theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
export const COLORS = { R: '#E5484D', G: '#46A758', B: '#3E8FD9', Y: '#E0B23A' };
const COLOR_HI = { R: '#FF6B6E', G: '#63C776', B: '#5BA7F0', Y: '#F5CB5C' };
export const COLOR_NAME = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };

// ── sounds (expo-audio; guarded so web/preview never crashes) ──
let createAudioPlayer = null; try { ({ createAudioPlayer } = require('expo-audio')); } catch (_) {}
const SFX = {};
const TONE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
export function initSfx() {
  if (!createAudioPlayer) return;
  const mk = () => { try { return createAudioPlayer({ uri: TONE }); } catch (_) { return null; } };
  SFX.deal = mk(); SFX.play = mk(); SFX.draw = mk(); SFX.uno = mk();
}
export function playSfx(name) { const p = SFX[name]; if (!p) return; try { p.seekTo(0); p.play(); } catch (_) {} }

// ── deck / rules ──
function makeDeck() {
  const d = []; const cols = ['R', 'G', 'B', 'Y'];
  for (const c of cols) {
    d.push({ c, v: '0' });
    for (let n = 1; n <= 9; n++) { d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
    for (const a of ['skip', 'rev', 'd2']) { d.push({ c, v: a }); d.push({ c, v: a }); }
  }
  for (let i = 0; i < 4; i++) { d.push({ c: 'W', v: 'wild' }); d.push({ c: 'W', v: 'wd4' }); }
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export const label = (card) => card.v === 'wild' ? '★' : card.v === 'wd4' ? '+4' : card.v === 'skip' ? 'Ø' : card.v === 'rev' ? '⟳' : card.v === 'd2' ? '+2' : card.v;
export const sublabel = (card) => (card.v === 'wild' || card.v === 'wd4') ? 'WILD' : card.v === 'skip' ? 'SKIP' : card.v === 'rev' ? 'REV' : card.v === 'd2' ? 'DRAW' : '';
function canPlay(card, top, activeColor) {
  if (!top) return true;
  if (card.c === 'W') return true;
  if (card.c === activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

export function UnoCard({ card, faceDown, onPress, playable, w = 66, h = 98, dim, style }) {
  if (faceDown) {
    return (
      <View style={[cs.card, { width: w, height: h }, style]}>
        <LinearGradient colors={['#2a1f3a', '#171122']} style={cs.fill}>
          <View style={cs.backOval}><Text style={[cs.backZ, { fontSize: h * 0.3 }]}>Z</Text></View>
        </LinearGradient>
      </View>
    );
  }
  const base = card.c === 'W' ? '#241a30' : COLORS[card.c];
  const hi = card.c === 'W' ? '#3a2b4a' : COLOR_HI[card.c];
  const inner = (
    <LinearGradient colors={[hi, base]} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={cs.fill}>
      <View style={[cs.oval, { width: w * 0.82, height: h * 0.62 }]} />
      <Text style={[cs.corner, cs.cornerTL, { fontSize: h * 0.15 }]}>{label(card)}</Text>
      <Text style={[cs.corner, cs.cornerBR, { fontSize: h * 0.15 }]}>{label(card)}</Text>
      <View style={cs.center}>
        <Text style={[cs.centerLabel, { fontSize: h * 0.32, color: card.c === 'W' ? '#fff' : base }]}>{label(card)}</Text>
        {sublabel(card) ? <Text style={[cs.subLabel, { color: card.c === 'W' ? '#fff' : base }]}>{sublabel(card)}</Text> : null}
      </View>
      {card.c === 'W' && (
        <View style={cs.wildCorners}>
          <View style={[cs.wq, { backgroundColor: COLORS.R, top: 0, left: 0 }]} />
          <View style={[cs.wq, { backgroundColor: COLORS.B, top: 0, right: 0 }]} />
          <View style={[cs.wq, { backgroundColor: COLORS.Y, bottom: 0, left: 0 }]} />
          <View style={[cs.wq, { backgroundColor: COLORS.G, bottom: 0, right: 0 }]} />
        </View>
      )}
    </LinearGradient>
  );
  if (!onPress) return <View style={[cs.card, { width: w, height: h }, playable && cs.playable, dim && { opacity: 0.5 }, style]}>{inner}</View>;
  return <Pressable onPress={onPress} style={[cs.card, { width: w, height: h }, playable && cs.playable, dim && { opacity: 0.5 }, style]}>{inner}</Pressable>;
}


export function FlyingCard({ card, from }) {
  const tx = useSharedValue(from.x); const ty = useSharedValue(from.y);
  const rot = useSharedValue(from.rot || 0); const sc = useSharedValue(0.7);
  useEffect(() => {
    tx.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    rot.value = withTiming((Math.random() - 0.5) * 20, { duration: 340 });
    sc.value = withSpring(1, { damping: 11 });
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }] }));
  return <Animated.View style={[{ position: 'absolute' }, st]}><UnoCard card={card} w={74} h={110} /></Animated.View>;
}


export function OpponentSeat({ player, active, position }) {
  const [okFace, setOkFace] = useState(true);
  const n = Math.min(player.hand.length, 8);
  return (
    <View style={styles.seat}>
      <View style={[styles.seatAvatarWrap, active && styles.seatActive]}>
        {okFace ? (
          <Image source={{ uri: faceFor(player.key) }} onError={() => setOkFace(false)}
            style={[styles.seatAvatar, active && { borderColor: player.tone }]} />
        ) : (
          <View style={[styles.seatAvatar, styles.seatFallback, active && { borderColor: player.tone }]}>
            <Text style={{ color: player.tone, fontFamily: FONTS.display, fontSize: 18 }}>{player.name[0]}</Text>
          </View>
        )}
        <View style={styles.seatCount}><Text style={styles.seatCountText}>{player.hand.length}</Text></View>
      </View>
      <Text style={styles.seatName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.seatFan}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ marginLeft: i === 0 ? 0 : -14, transform: [{ rotate: `${(i - n / 2) * 4}deg` }] }}>
            <UnoCard faceDown w={22} h={32} />
          </View>
        ))}
      </View>
    </View>
  );
}


export const cs = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 7, borderWidth: 2.5, borderColor: '#fff' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playable: { borderColor: '#FFE9C7', shadowColor: '#F3A85F', shadowOpacity: 0.85, shadowRadius: 12, elevation: 14, transform: [{ translateY: -10 }] },
  oval: { position: 'absolute', borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.92)', transform: [{ rotate: '32deg' }] },
  corner: { position: 'absolute', fontFamily: FONTS.semibold, color: '#fff', fontWeight: '800' },
  cornerTL: { top: 5, left: 7 }, cornerBR: { bottom: 5, right: 7, transform: [{ rotate: '180deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontFamily: FONTS.display, fontWeight: '800' },
  subLabel: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1, marginTop: -2 },
  backOval: { width: '78%', height: '52%', borderRadius: 100, backgroundColor: 'rgba(243,168,95,0.14)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] },
  backZ: { fontFamily: FONTS.display, color: '#F3A85F', transform: [{ rotate: '-30deg' }] },
  wildCorners: { position: 'absolute', width: '46%', height: '46%', borderRadius: 100, overflow: 'hidden', opacity: 0.9 },
  wq: { position: 'absolute', width: '50%', height: '50%' },
});


