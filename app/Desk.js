// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE FRONT DESK (home), as a CONCIERGE CHAT (not a dashboard).
//  Z talks to you, reads what you need, and surfaces TAPPABLE persona routes
//  (the [[GOTO:key]] chips) inline in its replies → tap → carried into that
//  chat. Letters (Z writes to you) surface here too. Your profile: corner avatar.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

// Z's concierge presence — a warm ember at the desk
function ConciergePresence({ size = 46 }) {
  const b = useSharedValue(0.7);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 3800, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: 0.96 + b.value * 0.08 }], opacity: 0.6 + b.value * 0.4 }));
  return (
    <Animated.View style={orb}>
      <Svg width={size} height={size} viewBox="0 0 46 46"><Defs><RadialGradient id="concierge" cx="38%" cy="33%" r="70%">
        <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="45%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
      </RadialGradient></Defs><Circle cx="23" cy="23" r="16" fill="url(#concierge)" /></Svg>
    </Animated.View>
  );
}

// a routing chip: tap → carried into that persona's chat
function RouteChip({ pkey, label, onRoute }) {
  const [ok, setOk] = useState(true);
  return (
    <Pressable style={styles.routeChip} onPress={() => onRoute(pkey)}>
      <View style={styles.chipFace}>
        {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
            : <View style={{ flex: 1, backgroundColor: C.emberDeep }} />}
      </View>
      <Text style={styles.chipLabel}>{label}</Text>
      <Text style={styles.chipGo}>›</Text>
    </Pressable>
  );
}

// a concierge turn: Z's line + optional route chips
function ConciergeLine({ turn, onRoute }) {
  if (turn.who === 'you') {
    return (
      <View style={[styles.row, { justifyContent: 'flex-end' }]}>
        <LinearGradient colors={['rgba(243,168,95,0.17)', 'rgba(232,116,60,0.10)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.bubble, styles.bubbleYou]}>
          <Text style={styles.bubbleText}>{turn.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={[styles.row, { justifyContent: 'flex-start' }]}>
      <View style={{ maxWidth: '90%' }}>
        <BlurView intensity={18} tint="dark" style={[styles.bubble, styles.bubbleZ]}>
          <Text style={styles.bubbleText}>{turn.text}</Text>
        </BlurView>
        {turn.routes && (
          <View style={styles.chipsWrap}>
            {turn.routes.map((r) => <RouteChip key={r.key} pkey={r.key} label={r.label} onRoute={onRoute} />)}
          </View>
        )}
      </View>
    </View>
  );
}

// a surfaced letter card ("i wrote you something")
function LetterPeek({ onOpen }) {
  return (
    <Pressable style={styles.letterPeek} onPress={onOpen}>
      <View style={styles.letterDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.letterPeekTag}>a letter from Z</Text>
        <Text style={styles.letterPeekBody} numberOfLines={1}>you carried a lot this week — i noticed something…</Text>
      </View>
      <Text style={styles.chipGo}>›</Text>
    </Pressable>
  );
}

// a tiny scripted "read" so the concierge feels alive without the engine yet
function readMood(text) {
  const t = text.toLowerCase();
  if (/\b(sad|down|rough|hard|tired|low|passed over|hate|angry|upset|stress)\b/.test(t))
    return { text: "that sounds heavy. you don't have to carry it alone tonight — here's who i'd point you to.",
      routes: [{ key: 'the_brother', label: 'the brother' }, { key: 'the_healer', label: 'the healer' }, { key: 'z_serious', label: 'just talk to me' }] };
  if (/\b(laugh|fun|bored|light|happy|good|celebrate)\b/.test(t))
    return { text: "let's keep that going. these two never let the mood drop.",
      routes: [{ key: 'the_comic', label: 'the comic' }, { key: 'the_wingman', label: 'the wingman' }] };
  if (/\b(think|learn|idea|why|question|understand|debate)\b/.test(t))
    return { text: "the good stuff. take your pick — they'll all push you.",
      routes: [{ key: 'the_brainiac', label: 'the brainiac' }, { key: 'the_philosopher', label: 'the philosopher' }, { key: 'the_teacher', label: 'the professor' }] };
  return { text: "tell me a little more — what's the night actually feeling like?",
    routes: null };
}

export default function Desk({ onRoute = () => {}, onOpenYou = () => {}, onOpenLetter = () => {} }) {
  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'still up?' : hour < 12 ? 'good morning.' : hour < 17 ? 'good afternoon.' : hour < 22 ? 'good evening.' : 'late night.';

  const [turns, setTurns] = useState([
    { who: 'z', text: `${greeting} i've got your list — and i know which room can help with whatever's next. what's on your mind?` },
  ]);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  const send = (text) => {
    const t = (text ?? draft).trim();
    if (!t) return;
    setDraft('');
    setTurns((cur) => [...cur, { who: 'you', text: t }]);
    setTimeout(() => {
      const r = readMood(t);
      setTurns((cur) => [...cur, { who: 'z', ...r }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }, 650); // a beat — the concierge takes a moment (pacing law)
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A1020', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* header: concierge presence + your profile corner */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <ConciergePresence size={40} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.deskName}>the front desk</Text>
              <Text style={styles.deskRole}>Z, at your service</Text>
            </View>
          </View>
          <Pressable onPress={onOpenYou} style={styles.youAvatar}><Text style={styles.youInitial}>D</Text></Pressable>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.convo} keyboardShouldPersistTaps="handled">
          <LetterPeek onOpen={onOpenLetter} />
          {turns.map((t, i) => <ConciergeLine key={i} turn={t} onRoute={onRoute} />)}
        </ScrollView>

        {/* composer */}
        <View style={styles.composer}>
          <BlurView intensity={24} tint="dark" style={styles.field}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={() => send()}
              placeholder="tell Z what you need…"
              placeholderTextColor={C.faint}
              style={styles.input}
              returnKeyType="send"
            />
          </BlurView>
          <Pressable style={styles.send} onPress={() => send()}>
            <Svg width="46" height="46" viewBox="0 0 46 46"><Defs><RadialGradient id="dsend" cx="40%" cy="34%" r="70%">
              <Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
            </RadialGradient></Defs><Circle cx="23" cy="23" r="23" fill="url(#dsend)" /><Path d="M15 23 L31 16 L26 31 L22.5 24.5 Z" fill="#3A1505" /></Svg>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  deskName: { fontFamily: FONTS.display, color: C.cream, fontSize: 18 },
  deskRole: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 12, marginTop: 1 },
  youAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(243,168,95,0.4)', backgroundColor: 'rgba(243,168,95,0.08)' },
  youInitial: { fontFamily: FONTS.display, color: C.accent, fontSize: 17 },

  convo: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12 },

  letterPeek: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(243,168,95,0.20)', backgroundColor: 'rgba(243,168,95,0.04)', marginBottom: 16 },
  letterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.ember },
  letterPeekTag: { fontFamily: FONTS.body, color: C.accentSoft, fontSize: 10.5, letterSpacing: 1.5, textTransform: 'uppercase' },
  letterPeekBody: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14, marginTop: 2 },

  row: { flexDirection: 'row', marginBottom: 14 },
  bubble: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, overflow: 'hidden' },
  bubbleZ: { backgroundColor: 'rgba(255,241,230,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', borderTopLeftRadius: 6 },
  bubbleYou: { borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', borderBottomRightRadius: 6, maxWidth: '84%' },
  bubbleText: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 15, lineHeight: 22 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, marginLeft: 2 },
  routeChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, paddingRight: 12, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', backgroundColor: 'rgba(255,255,255,0.03)' },
  chipFace: { width: 24, height: 24, borderRadius: 12, overflow: 'hidden', backgroundColor: '#1a121f' },
  chipLabel: { fontFamily: FONTS.medium, color: C.cream, fontSize: 13 },
  chipGo: { fontFamily: FONTS.semibold, color: C.accent, fontSize: 16 },

  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  field: { flex: 1, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  input: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, paddingVertical: 11 },
  send: { width: 46, height: 46 },
});
