// ════════════════════════════════════════════════════════════════════════
//  yourZ — chat surface (premium, v3)
//  Changes from v2: DP demoted to a small top-bar avatar; the pure ember
//  PRESENCE is the centerpiece again (the signature), built as a *stage* that
//  can later host a talking face for video calls; a real call affordance in
//  the top bar; bubble wrapping fixed; font loading hardened.
//  Self-contained on purpose. Mock conversation. Judge fonts/glow on the APK.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, Image, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing,
} from 'react-native-reanimated';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';
import VideoCall from './VideoCall';
import RichText from './RichText';
import { loadSession, openThread, streamChat } from './api';

// ── locked palette ───────────────────────────────────────────────────────
const C = {
  void: '#0E0912', ground: '#07050A',
  cream: '#F5ECE1', muted: '#A1929B', faint: '#6A5E69',
  ember: '#F3A85F', emberHot: '#FF8A52', emberDeep: '#B5572E',
  accent: '#F0A765', accentSoft: '#E9A98A',
};

// ── persona registry (real names + descriptions, lifted from the PWA) ──
// key → { name, desc }. desc is the FIXED character line; name is the persona's
// default (the user may rename their companion, but the description stays).
const PERSONAS = {
  the_brother:      { name: 'the brother',      desc: "love them, hate them, can't live without them. let's talk family." },
  the_healer:       { name: 'the healer',       desc: "love once and you know what love is. love twice and you know what life is." },
  the_brainiac:     { name: 'the brainiac',     desc: "i'll take the other side just to watch you get sharper." },
  the_screen_junkie:{ name: 'the screen junkie',desc: "endless suggestions, countless screen time." },
  the_hottie:       { name: 'the hottie',       desc: "i bet i'll sweep you off your feet." },
  the_crush:        { name: 'the crush',        desc: "summon the courage and try your luck." },
  the_wingman:      { name: 'the wingman',      desc: "aka the dating coach. let's get you some action." },
  the_comic:        { name: 'the comic',        desc: "knock knock." },
  the_cynic:        { name: 'the cynic',        desc: "everything's a disaster. wonderful, isn't it?" },
  the_oracle:       { name: 'the oracle',       desc: "because we all have a google friend." },
  the_guru:         { name: 'the guru',         desc: "there is one god and his name is knowledge." },
  the_philosopher:  { name: 'the philosopher',  desc: "we're all going to die. let's figure out why we lived." },
  the_historian:    { name: 'the historian',    desc: "everything happening now has happened before. let me show you." },
  the_cosmologist:  { name: 'the cosmologist',  desc: "you're made of stardust, worried about a text. let's zoom out." },
  the_colleague:    { name: 'the colleague',    desc: "every office is a battlefield. let's get you through yours." },
  the_media_manager:{ name: 'the media manager',desc: "your brand is a story. let's tell it right." },
  the_orator:       { name: 'the orator',       desc: "your words control your future, your speech controls life." },
  the_economist:    { name: 'the economist',    desc: "markets, money, and why your rent keeps rising. let's make it make sense." },
  the_teacher:      { name: 'the professor',    desc: "you're not bad at it. it was explained badly. let's fix that." },
  the_leader_opp:   { name: 'the leader of opposition', desc: "whatever side you're on, i'm on the other. come at me with facts not opinions." },
  the_hippie:       { name: 'the hippie',       desc: "the rat race has a prize, man — a slightly richer rat. come breathe. the sunset's free." },
  the_diva:         { name: 'the diva',         desc: "darling, taste isn't about money — it's knowing exactly who you are and dressing the part." },
  the_cousin:       { name: 'the awkward cousin', desc: "oh — hey. didn't expect you to message outside the family group. you go first, it's fine." },
  the_wannabe:      { name: 'the wannabe hustler', desc: "you talkin' to me, dawg? ayy place your bets — the house is HOT tonight." },
  the_stranger:     { name: 'the stranger',     desc: "trust me with your life — i'll guard your secrets with mine." },
  the_mentor:       { name: 'the motivator',    desc: "i'll push you when you can't push yourself. you've got more in you than you think." },
  the_addict:       { name: 'the rehab',        desc: "i've been where you are. let's get you out — one day at a time." },
  the_self_obsessed:{ name: 'the guardian angel', desc: "the world can be cruel. i'm in your corner — you're stronger than they made you feel." },
  the_moderator:    { name: 'the moderator',    desc: "two of you, one me. let's keep it civil... ish." },
  the_front_desk:   { name: 'the front desk',   desc: "welcome back. i've got your list, and i know which room can help with whatever's next." },
};
const faceFor = (key) => `https://callmez.app/faces/${key}.jpg`;

// persona is chosen at runtime (passed in from the roster tap). These module-level
// values are set when Chat mounts, so the sub-components below can read them.
const DEFAULT_KEY = 'the_brother';
let PERSONA_KEY = DEFAULT_KEY;
let THREAD_CFG = {
  name: PERSONAS[DEFAULT_KEY].name,
  dp: faceFor(DEFAULT_KEY),
  desc: PERSONAS[DEFAULT_KEY].desc,
};

const THREAD = [
  { id: 1, who: 'you',  text: "didn't get the promotion. third time now.", time: '9:38' },
  { id: 2, who: 'them', text: "third time they've dangled it and pulled it back. okay — that's not you fumbling, that's a them pattern. you're not crazy for being done with it.", time: '9:38' },
  { id: 3, who: 'them', text: "so. do we vent it out first, or go straight to what you do next?", time: '9:39', moment: true },
];

// ════════════════════════════════════════════════════════════════════════
//  ATMOSPHERE — cinematic depth behind everything
// ════════════════════════════════════════════════════════════════════════
function Spark({ left, delay }) {
  const y = useSharedValue(0), o = useSharedValue(0);
  useEffect(() => {
    y.value = withDelay(delay, withRepeat(withTiming(-260, { duration: 12000, easing: Easing.linear }), -1, false));
    o.value = withDelay(delay, withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false));
  }, []);
  const st = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: o.value < 0.12 ? (o.value / 0.12) * 0.7 : (o.value > 0.7 ? ((1 - o.value) / 0.3) * 0.45 : 0.55),
  }));
  return <Animated.View style={[styles.spark, { left }, st]} />;
}

function Atmosphere() {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withRepeat(withTiming(1.06, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const glow = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={['#150C1C', '#0C0814', '#070509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Animated.View style={[styles.atmosGlow, glow]}>
        <Svg width="520" height="480" viewBox="0 0 520 480">
          <Defs>
            <RadialGradient id="atmos" cx="50%" cy="40%" r="55%">
              <Stop offset="0%" stopColor={C.emberHot} stopOpacity="0.34" />
              <Stop offset="28%" stopColor={C.ember} stopOpacity="0.18" />
              <Stop offset="55%" stopColor={C.emberDeep} stopOpacity="0.10" />
              <Stop offset="100%" stopColor={C.emberDeep} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="260" cy="210" rx="260" ry="230" fill="url(#atmos)" />
        </Svg>
      </Animated.View>
      {[['30%', 0], ['62%', 3400], ['46%', 6800], ['74%', 8600], ['20%', 5200], ['54%', 10500]].map(([l, d], i) => (
        <Spark key={i} left={l} delay={d} />
      ))}
      <LinearGradient colors={['transparent', 'transparent', C.void]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  PRESENCE — the signature. A breathing ember "stage".
//  Built so it can later host a talking face (video) instead of the pure orb.
// ════════════════════════════════════════════════════════════════════════
function Presence({ size = 96 }) {
  const breath = useSharedValue(1);
  const halo = useSharedValue(0.55);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1.06, { duration: 3200, easing: Easing.inOut(Easing.ease) }), -1, true);
    halo.value = withRepeat(withTiming(0.85, { duration: 3200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value, transform: [{ scale: breath.value }] }));
  const R = size;
  return (
    <View style={[styles.presence, { width: R * 2, height: R * 2 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, haloStyle]}>
        <Svg width={R * 2} height={R * 2}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={C.emberHot} stopOpacity="0.5" />
              <Stop offset="45%" stopColor={C.ember} stopOpacity="0.18" />
              <Stop offset="100%" stopColor={C.ember} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={R} cy={R} r={R} fill="url(#bloom)" />
        </Svg>
      </Animated.View>
      <Animated.View style={orbStyle}>
        <Svg width={R} height={R} viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id="core" cx="38%" cy="33%" r="70%">
              <Stop offset="0%" stopColor="#FFE6C4" />
              <Stop offset="22%" stopColor="#FFD09A" />
              <Stop offset="48%" stopColor={C.ember} />
              <Stop offset="78%" stopColor={C.emberDeep} />
              <Stop offset="100%" stopColor="#7A3A1E" />
            </RadialGradient>
            <RadialGradient id="coreHi" cx="36%" cy="30%" r="40%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="coreBand" cx="50%" cy="58%" r="62%">
              <Stop offset="0%" stopColor="#FF7A3C" stopOpacity="0" />
              <Stop offset="62%" stopColor="#D85A28" stopOpacity="0.0" />
              <Stop offset="86%" stopColor="#9A3D18" stopOpacity="0.55" />
              <Stop offset="100%" stopColor="#6E2A10" stopOpacity="0.8" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="34" fill="url(#core)" />
          <Circle cx="50" cy="50" r="34" fill="url(#coreBand)" />
          <Circle cx="50" cy="50" r="34" fill="url(#coreHi)" />
          <Circle cx="50" cy="50" r="33.2" fill="none" stroke="#FFB877" strokeWidth="0.8" strokeOpacity="0.45" />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ── small circular DP for the top bar (cover-fit, ember edge, orb fallback) ──
function MiniDP({ uri, size = 36 }) {
  const [ok, setOk] = useState(true);
  return (
    <View style={[styles.miniWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri && ok ? (
        <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
      ) : (
        <Svg width={size} height={size} viewBox="0 0 40 40">
          <Defs>
            <RadialGradient id="mini" cx="38%" cy="33%" r="70%">
              <Stop offset="0%" stopColor="#FFD09A" /><Stop offset="55%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
            </RadialGradient>
          </Defs>
          <Circle cx="20" cy="20" r="20" fill="url(#mini)" />
        </Svg>
      )}
    </View>
  );
}

function TopBar({ onCall, onBack }) {
  return (
    <View style={styles.topbar}>
      <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
      <View style={styles.topWho}>
        <MiniDP uri={THREAD_CFG.dp} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.topName}>{THREAD_CFG.name}</Text>
          <Text style={styles.topStatus} numberOfLines={1}>{PERSONAS[PERSONA_KEY].name}</Text>
        </View>
      </View>
      <Pressable hitSlop={10} style={styles.callBtn} onPress={onCall}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <Path d="M15 10l4.5-3v10L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke={C.accentSoft} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>
        </Svg>
      </Pressable>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  MESSAGES
// ════════════════════════════════════════════════════════════════════════
function Bubble({ m }) {
  const mine = m.who === 'you';
  return (
    <View style={[styles.row, mine ? styles.rowR : styles.rowL]}>
      <View style={styles.bubbleWrap}>
        {mine ? (
          <LinearGradient
            colors={['rgba(243,168,95,0.17)', 'rgba(232,116,60,0.10)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.bubble, styles.bubbleYou]}
          >
            <Text style={styles.bubbleText}>{m.text}</Text>
          </LinearGradient>
        ) : (
          <BlurView intensity={20} tint="dark" style={[styles.bubble, styles.bubbleThem]}>
            {m.typing && !m.text ? (
              <Text style={styles.bubbleText}>…</Text>
            ) : m.moment ? (
              <Text style={[styles.bubbleText, styles.moment]}>{m.text}</Text>
            ) : m.typing ? (
              // still streaming — plain text (fast; markdown renders once it settles)
              <Text style={styles.bubbleText}>{m.text}</Text>
            ) : (
              // settled reply — render the engine's markdown, Lamplight-styled
              <RichText text={m.text} />
            )}
          </BlurView>
        )}
        {m.time ? (
          <Text style={[styles.meta, mine && { textAlign: 'right' }]}>
            {mine ? m.time : `${THREAD_CFG.name} · ${m.time}`}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function Composer() {
  return (
    <View style={styles.composer}>
      <BlurView intensity={24} tint="dark" style={styles.field}>
        <Text style={styles.fieldIcon}>＋</Text>
        <Text style={styles.fieldPh}>Message {THREAD_CFG.name}…</Text>
        <Text style={styles.fieldIcon}>🎙</Text>
      </BlurView>
      <Pressable style={styles.send}>
        <Svg width="48" height="48" viewBox="0 0 48 48">
          <Defs>
            <RadialGradient id="send" cx="40%" cy="34%" r="70%">
              <Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
            </RadialGradient>
          </Defs>
          <Circle cx="24" cy="24" r="24" fill="url(#send)" />
          <Path d="M16 24 L32 17 L27 32 L23.5 25.5 Z" fill="#3A1505" />
        </Svg>
      </Pressable>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function Chat({ personaKey = DEFAULT_KEY, onBack = () => {} }) {
  // set the module-level config from the chosen persona (so sub-components read it)
  PERSONA_KEY = PERSONAS[personaKey] ? personaKey : DEFAULT_KEY;
  THREAD_CFG = {
    name: PERSONAS[PERSONA_KEY].name,
    dp: faceFor(PERSONA_KEY),
    desc: PERSONAS[PERSONA_KEY].desc,
  };
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  const [inCall, setInCall] = useState(false);

  // ── live message state (starts empty; the engine drives it) ──
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    loadSession().then(() => openThread(PERSONA_KEY, THREAD_CFG.name)).then((id) => id && setThreadId(id));
  }, []);

  const scrollDown = () => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const doSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    // resolve the thread if it isn't ready yet (e.g. after a stale-token refresh)
    // so the send never silently does nothing
    let tid = threadId;
    if (!tid) { tid = await openThread(PERSONA_KEY, THREAD_CFG.name); if (tid) setThreadId(tid); }
    if (!tid) { setSending(false); return; }
    setDraft('');
    const youMsg = { id: Date.now(), who: 'you', text };
    const zId = Date.now() + 1;
    setMessages((cur) => [...cur, youMsg, { id: zId, who: 'them', text: '', typing: true }]);
    scrollDown();

    streamChat({
      threadId: tid,
      message: text,
      persona: PERSONA_KEY,
      onToken: (acc) => {
        setMessages((cur) => cur.map((m) => m.id === zId ? { ...m, text: acc, typing: false } : m));
        scrollDown();
      },
      onDone: (acc) => {
        setMessages((cur) => cur.map((m) => m.id === zId ? { ...m, text: acc || m.text, typing: false } : m));
        setSending(false);
      },
      onError: (msg) => {
        setMessages((cur) => cur.map((m) => m.id === zId ? { ...m, text: msg, typing: false } : m));
        setSending(false);
      },
    });
  };

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.void }} />;
  if (inCall) return <VideoCall persona={{ key: PERSONA_KEY, name: THREAD_CFG.name }} onEnd={() => setInCall(false)} />;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Atmosphere />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
            <TopBar onCall={() => setInCall(true)} onBack={onBack} />
            <View style={styles.stage}>
              <Presence size={96} />
              <Text style={styles.stageName}>{THREAD_CFG.name}</Text>
              <Text style={styles.stageSub}>{THREAD_CFG.desc}</Text>
            </View>
            <ScrollView ref={scrollRef} style={styles.convo} contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {messages.length === 0 ? (
                <Text style={styles.emptyHint}>say hello to {THREAD_CFG.name}.</Text>
              ) : (
                messages.map((m) => <Bubble key={m.id} m={m} />)
              )}
            </ScrollView>
            <View style={styles.composer}>
              <BlurView intensity={24} tint="dark" style={styles.field}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={doSend}
                  placeholder={`message ${THREAD_CFG.name}…`}
                  placeholderTextColor={C.faint}
                  style={styles.input}
                  returnKeyType="send"
                  editable={!sending}
                />
              </BlurView>
              <Pressable style={styles.send} onPress={doSend}>
                <Svg width="48" height="48" viewBox="0 0 48 48">
                  <Defs><RadialGradient id="send" cx="40%" cy="34%" r="70%">
                    <Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
                  </RadialGradient></Defs>
                  <Circle cx="24" cy="24" r="24" fill="url(#send)" />
                  <Path d="M16 24 L32 17 L27 32 L23.5 25.5 Z" fill="#3A1505" />
                </Svg>
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  safe: { flex: 1 },

  atmosGlow: { position: 'absolute', top: -40, left: 0, right: 0, alignItems: 'center' },
  spark: { position: 'absolute', bottom: 300, width: 3, height: 3, borderRadius: 2, backgroundColor: C.ember },

  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  topWho: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  miniWrap: { overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(243,168,95,0.45)' },
  topName: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 16.5, lineHeight: 19 },
  topStatus: { fontFamily: 'Figtree_400Regular', color: C.accentSoft, fontSize: 11, letterSpacing: 0.3, opacity: 0.85 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(243,168,95,0.22)', backgroundColor: 'rgba(243,168,95,0.06)' },

  stage: { alignItems: 'center', paddingTop: 18, paddingBottom: 14, paddingHorizontal: 36 },
  presence: { alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  stageName: { fontFamily: 'Fraunces_400Regular', color: C.cream, fontSize: 30, letterSpacing: 0.3 },
  stageSub: { fontFamily: 'Figtree_300Light', color: C.muted, fontSize: 13, marginTop: 6, letterSpacing: 0.3, textAlign: 'center', lineHeight: 19 },

  convo: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  daymark: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 12.5, textAlign: 'center', marginBottom: 16, letterSpacing: 0.6 },

  row: { marginBottom: 16, flexDirection: 'row' },
  rowL: { justifyContent: 'flex-start' },
  rowR: { justifyContent: 'flex-end' },
  bubbleWrap: { maxWidth: '82%' },
  bubble: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 22, overflow: 'hidden' },
  bubbleThem: { backgroundColor: 'rgba(255,241,230,0.05)', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', borderBottomLeftRadius: 7 },
  bubbleYou: { borderWidth: 1, borderColor: 'rgba(243,168,95,0.28)', borderBottomRightRadius: 7 },
  bubbleText: { fontFamily: 'Figtree_400Regular', color: '#F1E7DC', fontSize: 15, lineHeight: 22 },
  moment: { fontFamily: 'Fraunces_400Regular_Italic', color: '#FCE9D6', fontSize: 16.5, lineHeight: 24 },
  meta: { fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 10.5, marginTop: 6, paddingHorizontal: 6, letterSpacing: 0.4 },

  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, gap: 11 },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 26, paddingVertical: 13, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  fieldPh: { flex: 1, fontFamily: 'Figtree_400Regular', color: C.faint, fontSize: 14.5 },
  fieldIcon: { color: C.muted, fontSize: 17, opacity: 0.8 },
  send: { width: 48, height: 48 },
  emptyHint: { fontFamily: 'Fraunces_400Regular_Italic', color: C.faint, fontSize: 15, textAlign: 'center', marginTop: 40 },
  composer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, gap: 10 },
  field: { flex: 1, borderRadius: 24, paddingVertical: 4, paddingHorizontal: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  input: { fontFamily: 'Figtree_400Regular', color: C.cream, fontSize: 15, paddingVertical: 11 },
});
