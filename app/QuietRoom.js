// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE QUIET ROOM
//  The cool counterpart to the warm Nightfall world. You come here when it's
//  actually heavy — drawn inward from the Front Desk ("come sit somewhere
//  quieter"). A grey-blue moonlit night, a field of faint stars, and Z as a
//  breathing blob of moonlight — no face, no candle, just presence. She only
//  listens here. Everything is slow. The pause is where the work happens.
//  Talks to z_serious (the deep-listen soul). Reuses the proven stream pacer,
//  reskinned to an unhurried cadence. Pure JS — ships OTA.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular } from '@expo-google-fonts/figtree';
import { loadSession, openThreadInfo, streamChat } from './api';

// ── the moonlit palette — cool, not the warm candle world ──
const Q = {
  top: '#1b1f30',        // moonlit slate (light falls from here)
  mid: '#101320',
  deep: '#07080e',       // near-black floor
  moon: '#EAECF5',       // moonlight (Z's voice)
  moonDim: 'rgba(234,236,245,0.5)',
  moonFaint: 'rgba(234,236,245,0.26)',
  star: '#CBD2E8',
  glow: '#9FB0E0',       // the cool blue-white of Z's light
  youBubble: 'rgba(159,176,224,0.09)',
  youBorder: 'rgba(159,176,224,0.16)',
  hair: 'rgba(234,236,245,0.08)',
};

// ── a single star: faint, slow twinkle ──
function Star({ x, y, r, delay, bright }) {
  const o = useSharedValue(0.2);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(bright ? 0.9 : 0.55, { duration: 2600 + (delay % 1400), easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: r, height: r, borderRadius: r / 2, backgroundColor: Q.star }, st]} />;
}

// ── Z, as a breathing blob of moonlight. brighter + a touch faster while speaking. ──
function ZLight({ speaking }) {
  const breath = useSharedValue(1);
  const glow = useSharedValue(0.55);
  useEffect(() => {
    breath.value = withRepeat(withTiming(speaking ? 1.11 : 1.06, { duration: speaking ? 2600 : 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
    glow.value = withRepeat(withTiming(speaking ? 0.95 : 0.72, { duration: speaking ? 2600 : 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [speaking]);
  const core = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: breath.value * 1.12 }] }));
  const R = 230;
  return (
    <View style={styles.zWrap} pointerEvents="none">
      <Animated.View style={[styles.zCenter, halo]}>
        <Svg width={R} height={R}>
          <Defs><RadialGradient id="zhalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={Q.glow} stopOpacity="0.42" />
            <Stop offset="45%" stopColor={Q.glow} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx={R / 2} cy={R / 2} r={R / 2} fill="url(#zhalo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[styles.zCenter, core]}>
        <Svg width="120" height="120" viewBox="0 0 120 120">
          <Defs><RadialGradient id="zcore" cx="46%" cy="42%" r="58%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
            <Stop offset="35%" stopColor="#E7ECFA" stopOpacity="0.7" />
            <Stop offset="70%" stopColor={Q.glow} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="60" cy="60" r="60" fill="url(#zcore)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export default function QuietRoom({ onBack = () => {} }) {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic, Figtree_300Light, Figtree_400Regular });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const scrollRef = useRef(null);
  const sendingRef = useRef(false);
  const targetRef = useRef('');
  const shownRef = useRef('');
  const streamDoneRef = useRef(false);
  const pacingRef = useRef(false);
  const atBottomRef = useRef(true);

  // a fixed, gently-scattered star field (computed once)
  const stars = useMemo(() => {
    const out = []; let s = 7;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 30; i++) out.push({ x: rnd() * 100, y: rnd() * 62, r: 1 + rnd() * 2, delay: rnd() * 3000, bright: rnd() > 0.82 });
    return out;
  }, []);

  useEffect(() => {
    loadSession().then(() => openThreadInfo('z_serious', 'Z')).then((info) => info && setThreadId(info.id));
  }, []);

  const scrollDown = () => { if (atBottomRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60); };

  // the pacer — same mechanism as the main chat, but UNHURRIED. this room breathes.
  const revealTick = (zId, finalize) => {
    if (!pacingRef.current) return;
    const target = targetRef.current, shown = shownRef.current;
    if (shown.length < target.length) {
      const backlog = target.length - shown.length;
      const step = backlog > 160 ? Math.ceil(backlog / 90) : 1;
      const next = target.slice(0, shown.length + step);
      shownRef.current = next;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: next, typing: true } : m)));
      scrollDown();
      const last = next[next.length - 1];
      let delay = 55;                                 // slower than the main chat — calm
      if ('.!?…'.includes(last)) delay = 520;         // a long beat at the end of a thought
      else if (last === '\n') delay = 360;
      else if (',;:—'.includes(last)) delay = 240;
      delay += Math.random() * 30;
      setTimeout(() => revealTick(zId, finalize), delay);
    } else if (streamDoneRef.current) {
      pacingRef.current = false;
      setMessages((cur) => cur.map((m) => (m.id === zId ? { ...m, text: target, typing: false } : m)));
      finalize && finalize();
    } else {
      setTimeout(() => revealTick(zId, finalize), 45);
    }
  };

  const doSend = async () => {
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setSpeaking(true);
    let tid = threadId;
    if (!tid) { const info = await openThreadInfo('z_serious', 'Z'); tid = info?.id || null; if (tid) setThreadId(tid); }
    if (!tid) { sendingRef.current = false; setSending(false); setSpeaking(false); return; }
    setDraft('');
    const youMsg = { id: Date.now(), who: 'you', text };
    const zId = Date.now() + 1;
    atBottomRef.current = true;
    setMessages((cur) => [...cur, youMsg, { id: zId, who: 'z', text: '', typing: true }]);
    scrollDown();
    targetRef.current = ''; shownRef.current = ''; streamDoneRef.current = false; pacingRef.current = true;
    const done = () => { sendingRef.current = false; setSending(false); setSpeaking(false); };
    revealTick(zId, done);
    streamChat({
      threadId: tid, message: text, persona: 'z_serious',
      onToken: (acc) => { targetRef.current = acc; },
      onDone: (acc) => { targetRef.current = acc || targetRef.current; streamDoneRef.current = true; },
      onError: (msg) => {
        pacingRef.current = false;
        setMessages((cur) => cur.map((m) => m.id === zId ? { ...m, text: msg, typing: false } : m));
        sendingRef.current = false; setSending(false); setSpeaking(false);
      },
    });
  };

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: Q.deep }} />;
  const empty = messages.length === 0;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* the moonlit night */}
      <LinearGradient colors={[Q.top, Q.mid, Q.deep]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* soft moon-glow at the top */}
      <View style={styles.moonGlow} pointerEvents="none">
        <Svg width="100%" height="340">
          <Defs><RadialGradient id="moon" cx="50%" cy="12%" r="60%">
            <Stop offset="0%" stopColor={Q.glow} stopOpacity="0.16" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="50%" cy="40" r="300" fill="url(#moon)" />
        </Svg>
      </View>
      {/* stars */}
      {stars.map((s, i) => <Star key={i} {...s} />)}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* draw the curtain back */}
          <Pressable style={styles.back} onPress={onBack} hitSlop={14}>
            <Text style={styles.backTxt}>‹  step out</Text>
          </Pressable>

          {/* Z, as light */}
          <ZLight speaking={speaking} />

          <ScrollView
            ref={scrollRef}
            style={styles.convo}
            contentContainerStyle={empty ? styles.convoEmpty : { paddingTop: 8, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
            }}>
            {empty ? (
              <Text style={styles.rest}>it's just us here.{'\n'}take your time.</Text>
            ) : (
              messages.map((m) => (
                <View key={m.id} style={{ marginBottom: 20 }}>
                  {m.who === 'you'
                    ? <View style={styles.youWrap}><Text style={styles.youText}>{m.text}</Text></View>
                    : <Text style={styles.zText}>{m.text || (m.typing ? '…' : '')}</Text>}
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.composer}>
            <View style={styles.field}>
              <TextInput
                value={draft} onChangeText={setDraft}
                placeholder="say it here…" placeholderTextColor={Q.moonFaint}
                style={styles.input} multiline editable={!sending}
              />
            </View>
            <Pressable style={styles.send} onPress={doSend} hitSlop={8}>
              <Svg width="44" height="44" viewBox="0 0 44 44">
                <Defs><RadialGradient id="qsend" cx="46%" cy="40%" r="60%">
                  <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" /><Stop offset="55%" stopColor={Q.glow} /><Stop offset="100%" stopColor="#5b6aa0" />
                </RadialGradient></Defs>
                <Circle cx="22" cy="22" r="16" fill="url(#qsend)" />
              </Svg>
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Q.deep },
  moonGlow: { position: 'absolute', top: 0, left: 0, right: 0 },

  back: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 },
  backTxt: { fontFamily: 'Figtree_400Regular', color: Q.moonFaint, fontSize: 14, letterSpacing: 0.3 },

  zWrap: { height: 210, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  zCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  convo: { flex: 1, paddingHorizontal: 26 },
  convoEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  rest: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.moonFaint, fontSize: 19, lineHeight: 30, textAlign: 'center', letterSpacing: 0.2 },

  zText: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.moon, fontSize: 19, lineHeight: 31, letterSpacing: 0.2 },
  youWrap: { alignSelf: 'flex-end', maxWidth: '80%', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 18, borderTopRightRadius: 6, backgroundColor: Q.youBubble, borderWidth: 1, borderColor: Q.youBorder },
  youText: { fontFamily: 'Figtree_300Light', color: Q.moon, fontSize: 15, lineHeight: 22 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  field: { flex: 1, borderRadius: 24, borderWidth: 1, borderColor: Q.hair, backgroundColor: 'rgba(159,176,224,0.05)' },
  input: { fontFamily: 'Figtree_400Regular', color: Q.moon, fontSize: 15, paddingHorizontal: 18, paddingVertical: 13, maxHeight: 120 },
  send: { width: 44, height: 44, marginBottom: 2 },
});
