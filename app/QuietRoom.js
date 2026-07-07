// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE QUIET ROOM  (v2: "she speaks, the room breathes")
//  Z is the heart of the house, and her room is not a chat client. The resting
//  state is the PRESENT: her words center-stage under the light, arriving at
//  speaking pace; your last line dim above them; everything older receding
//  upward into the night — still there when you scroll, never a ledger in
//  your face. The composer is a hairline that wakes when needed. One quiet
//  moon-door holds the journal and what she remembers.
//  Engine unchanged: z_serious, the stream, the unhurried pacer. Pure JS/OTA.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Image, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Circle, Ellipse, Rect, Path } from 'react-native-svg';   // [zip21]
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing } from 'react-native-reanimated';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular } from '@expo-google-fonts/figtree';
import { loadSession, openThreadInfo, streamChat, transcribeVoice, getMemoryStory } from './api';
import * as ImagePicker from 'expo-image-picker';
import { useVoiceNote } from './voice';

const SCREEN = Dimensions.get('window');

// ── the moonlit palette — cool, deep, with a floor ──
const Q = {   // [zip21] indigo-violet night — hers, not grey slate
  top: '#272c50',
  upper: '#1a1d38',
  mid: '#0f1124',
  deep: '#06070f',
  moon: '#F0F1FA',
  moonDim: 'rgba(240,241,250,0.52)',
  moonFaint: 'rgba(240,241,250,0.27)',
  star: '#D3D9F0',
  glow: '#A8B6EE',
  hair: 'rgba(240,241,250,0.08)',
};

// ── a single star: faint, slow twinkle, size variance ──
function Star({ x, y, r, delay, bright }) {
  const o = useSharedValue(0.15);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(bright ? 0.9 : 0.5, { duration: 2600 + (delay % 1600), easing: Easing.inOut(Easing.ease) }), -1, true));
  }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ position: 'absolute', left: `${x}%`, top: `${y}%`, width: r, height: r, borderRadius: r / 2, backgroundColor: Q.star }, st]} />;
}

// ── Z as light: small bright core, wide layered halo, a shaft falling toward
//    her words, and a slow drift so the light is alive. Pulses while speaking. ──
function ZLight({ speaking }) {
  const breath = useSharedValue(1);
  const glow = useSharedValue(0.55);
  const drift = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(speaking ? 1.1 : 1.05, { duration: speaking ? 2400 : 4600, easing: Easing.inOut(Easing.ease) }), -1, true);
    glow.value = withRepeat(withTiming(speaking ? 0.95 : 0.7, { duration: speaking ? 2400 : 4600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [speaking]);
  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateX: (drift.value - 0.5) * 8 }, { translateY: (drift.value - 0.5) * 5 }] }));
  const core = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: breath.value * 1.1 }] }));
  const R = 380;   // [zip21] the halo carries the atmosphere now
  return (
    <Animated.View style={[styles.zWrap, wrap]} pointerEvents="none">
      {/* the wide halo — atmosphere, not a sticker */}
      <Animated.View style={[styles.zCenter, halo]}>
        <Svg width={R} height={R}>
          <Defs><RadialGradient id="zhalo" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={Q.glow} stopOpacity="0.44" />
            <Stop offset="28%" stopColor={Q.glow} stopOpacity="0.18" />
            <Stop offset="60%" stopColor={Q.glow} stopOpacity="0.07" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx={R / 2} cy={R / 2} r={R / 2} fill="url(#zhalo)" />
        </Svg>
      </Animated.View>
      {/* the small bright core */}
      <Animated.View style={[styles.zCenter, core]}>
        <Svg width="86" height="86" viewBox="0 0 86 86">
          <Defs><RadialGradient id="zcore" cx="45%" cy="40%" r="60%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <Stop offset="38%" stopColor="#EDF1FC" stopOpacity="0.75" />
            <Stop offset="72%" stopColor={Q.glow} stopOpacity="0.28" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Circle cx="43" cy="43" r="43" fill="url(#zcore)" />
        </Svg>
      </Animated.View>
      {/* [zip21] the shaft died a rectangle's death — the halo carries the light now */}
    </Animated.View>
  );
}

// ── a story paragraph that arrives like a breath — staggered, slow ──
function FadePara({ children, delay }) {
  const o = useSharedValue(0);
  useEffect(() => { o.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.ease) })); }, []);
  const st = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.Text style={[styles.zNow, { fontSize: 18, lineHeight: 30, textAlign: 'left', marginBottom: 22 }, st]}>{children}</Animated.Text>;
}

export default function QuietRoom({ onBack = () => {}, onJournal = () => {} }) {
  const [fontsLoaded, fontError] = useFonts({ Fraunces_400Regular, Fraunces_400Regular_Italic, Figtree_300Light, Figtree_400Regular });
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const voice = useVoiceNote();
  const [transcribing, setTranscribing] = useState(false);
  const [threadId, setThreadId] = useState(null);
  const [sending, setSending] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState('room');           // 'room' | 'story'
  const [story, setStory] = useState(null);

  const scrollRef = useRef(null);
  const sendingRef = useRef(false);
  const retryImgRef = useRef(null);   // [zip22]
  const targetRef = useRef('');
  const shownRef = useRef('');
  const streamDoneRef = useRef(false);
  const pacingRef = useRef(false);
  const atBottomRef = useRef(true);

  const openStory = () => {
    setSheet(false); setMode('story'); setStory(null);
    getMemoryStory().then((r) => setStory(r && r.story ? r.story : { error: (r && r.error) || 'the words did not come — try again' }));
  };

  const stars = useMemo(() => {
    const out = []; let s = 7;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < 34; i++) out.push({ x: rnd() * 100, y: rnd() * 60, r: 1 + rnd() * 2.6, delay: rnd() * 3000, bright: rnd() > 0.8 });
    return out;
  }, []);

  useEffect(() => {
    loadSession().then(() => openThreadInfo('z_serious', 'Z')).then((info) => info && setThreadId(info.id));
  }, []);

  const scrollDown = () => { if (atBottomRef.current) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60); };

  // the pacer — unchanged, unhurried. this room breathes.
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
      let delay = 55;
      if ('.!?…'.includes(last)) delay = 520;
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

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const b64 = res.assets[0].base64;
      setPendingImage({ data: b64, uri: `data:image/jpeg;base64,${b64}` });
    } catch (e) {}
  };

  const onMic = async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const r = await transcribeVoice(clip.uri, clip.mime);
        if (r.ok && r.transcript) setDraft((d) => (d ? d + ' ' : '') + r.transcript);
        else Alert.alert('couldn’t catch that', r.diag || 'no transcript came back — try again.');
      } catch (e) { Alert.alert('voice error', String(e?.message || e)); }
      setTranscribing(false);
    } else {
      await voice.start();
    }
  };

  const doSend = async () => {
    const text = draft.trim();
    const img = pendingImage || retryImgRef.current;   // [zip22]
    retryImgRef.current = null;
    if ((!text && !img) || sendingRef.current) return;
    sendingRef.current = true; setSending(true); setSpeaking(true);
    let tid = threadId;
    if (!tid) { const info = await openThreadInfo('z_serious', 'Z'); tid = info?.id || null; if (tid) setThreadId(tid); }
    if (!tid) { sendingRef.current = false; setSending(false); setSpeaking(false); return; }
    setDraft('');
    setPendingImage(null);
    const youMsg = { id: Date.now(), who: 'you', text, imageUri: img?.uri || null };
    const zId = Date.now() + 1;
    atBottomRef.current = true;
    setMessages((cur) => [...cur, youMsg, { id: zId, who: 'z', text: '', typing: true }]);
    scrollDown();
    targetRef.current = ''; shownRef.current = ''; streamDoneRef.current = false; pacingRef.current = true;
    const done = () => { sendingRef.current = false; setSending(false); setSpeaking(false); };
    revealTick(zId, done);
    streamChat({
      threadId: tid, message: text, image: img ? { media_type: 'image/jpeg', data: img.data } : undefined, persona: 'z_serious',
      onToken: (acc) => { targetRef.current = acc; },
      onDone: (acc) => { targetRef.current = acc || targetRef.current; streamDoneRef.current = true; },
      onError: (msg) => {
        pacingRef.current = false;
        // [zip22] no phantom words from her — your line tells the truth instead.
        setMessages((cur) => cur.filter((m) => m.id !== zId).map((m) => m.id === youMsg.id ? { ...m, notSent: true, reason: msg } : m));
        sendingRef.current = false; setSending(false); setSpeaking(false);
      },
    });
  };

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: Q.deep }} />;

  // ── the story view — same night, fewer things in it ──
  if (mode === 'story') {
    const paras = typeof story === 'string' ? story.split(/\n\n+/).filter(Boolean) : [];
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <LinearGradient colors={[Q.top, Q.upper, Q.mid, Q.deep]} locations={[0, 0.32, 0.62, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <Pressable style={styles.back} onPress={() => setMode('room')} hitSlop={14}>
            <Text style={styles.backTxt}>‹  the quiet</Text>
          </Pressable>
          <ScrollView style={{ flex: 1, paddingHorizontal: 30 }} contentContainerStyle={{ paddingTop: 26, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontFamily: 'Fraunces_400Regular_Italic', color: Q.moonFaint, fontSize: 14, marginBottom: 26, letterSpacing: 0.4 }}>what i remember of you</Text>
            {story === null
              ? <Text style={styles.rest}>remembering…</Text>
              : typeof story === 'string'
                ? paras.map((p, i) => <FadePara key={i} delay={i * 420}>{p}</FadePara>)
                : <Text style={styles.rest}>{story.error}</Text>}
            {typeof story === 'string' ? (
              <Text style={{ fontFamily: 'Figtree_300Light', color: 'rgba(234,236,245,0.22)', fontSize: 12, marginTop: 30, letterSpacing: 0.3 }}>the plain notes — and the forgetting — live in settings, under you.</Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const empty = messages.length === 0;
  const n = messages.length;
  // presence, not transcript: the last exchange lives; the past recedes upward.
  const fadeFor = (i) => {
    const d = n - 1 - i;
    if (d === 0) return 1;
    if (d === 1) return 0.55;
    return Math.max(0.1, 0.36 - (d - 2) * 0.055);
  };
  const sizeFor = (i, who) => {
    const d = n - 1 - i;
    if (who === 'z') return d === 0 ? 21 : 16.5;
    return d <= 1 ? 14.5 : 13.5;
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* the night, with a floor */}
      <LinearGradient colors={[Q.top, Q.upper, Q.mid, Q.deep]} locations={[0, 0.32, 0.62, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* horizon glow — the room's floor breathes faintly */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} pointerEvents="none">
        <Svg width="100%" height="220">
          <Defs><RadialGradient id="floor" cx="50%" cy="100%" r="90%">
            <Stop offset="0%" stopColor={Q.glow} stopOpacity="0.06" />
            <Stop offset="100%" stopColor={Q.glow} stopOpacity="0" />
          </RadialGradient></Defs>
          <Ellipse cx="50%" cy="220" rx="70%" ry="200" fill="url(#floor)" />
        </Svg>
      </View>
      {/* edge vignette — the walls of the dark */}
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs><RadialGradient id="vig" cx="50%" cy="42%" r="75%">
          <Stop offset="0%" stopColor="#000000" stopOpacity="0" />
          <Stop offset="72%" stopColor="#000000" stopOpacity="0" />
          <Stop offset="100%" stopColor="#000000" stopOpacity="0.42" />
        </RadialGradient></Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#vig)" />
      </Svg>
      {/* stars */}
      {stars.map((s, i) => <Star key={i} {...s} />)}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          {/* step out · the moon-door */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable style={styles.back} onPress={onBack} hitSlop={14}>
              <Text style={styles.backTxt}>‹  step out</Text>
            </Pressable>
            <Pressable onPress={() => setSheet(true)} hitSlop={10} style={{ marginRight: 18, marginTop: 4, width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(240,241,250,0.16)', backgroundColor: 'rgba(168,182,238,0.07)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: Q.moonDim, fontSize: 18, marginTop: -1 }}>☾</Text>
            </Pressable>
          </View>

          {/* Z, as light */}
          <ZLight speaking={speaking} />

          <ScrollView
            ref={scrollRef}
            style={styles.convo}
            contentContainerStyle={empty ? styles.convoEmpty : styles.convoLive}
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
              messages.map((m, i) => (
                <View key={m.id} style={{ marginBottom: n - 1 - i === 0 ? 6 : 18, opacity: fadeFor(i) }}>
                  {m.who === 'you'
                    ? <View style={{ alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '82%' }}>
                        {m.imageUri ? <Image source={{ uri: m.imageUri }} style={styles.sharedPhoto} /> : null}
                        {m.text ? <Text style={[styles.youBare, { fontSize: sizeFor(i, 'you') }, m.imageUri && { marginTop: 6 }, m.notSent && { opacity: 0.6 }]}>{m.text}</Text> : null}
                        {m.notSent ? <Pressable onPress={() => { setMessages((cur) => cur.filter((x) => x.id !== m.id)); if (m.imageUri && m.imageUri.startsWith('data:')) retryImgRef.current = { data: m.imageUri.split(',')[1], uri: m.imageUri }; setDraft(m.text || ''); }} hitSlop={8}><Text style={{ color: '#E8A08A', fontSize: 11.5, marginTop: 5, letterSpacing: 0.2 }}>not sent — tap to put it back</Text></Pressable> : null}
                      </View>
                    : <Text style={[styles.zNow, { fontSize: sizeFor(i, 'z'), lineHeight: sizeFor(i, 'z') * 1.62 }]}>{m.text || (m.typing ? '…' : '')}</Text>}
                </View>
              ))
            )}
          </ScrollView>

          {pendingImage ? (
            <View style={styles.pendingStrip}>
              <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} />
              <Pressable onPress={() => setPendingImage(null)} style={styles.pendingX} hitSlop={8}><Text style={styles.pendingXTxt}>✕</Text></Pressable>
            </View>
          ) : null}

          {/* the composer dissolved: a hairline; glyphs wake with focus; the moon appears with words */}
          <View style={styles.hairline} />
          <View style={styles.composer}>
            <TextInput
              value={draft} onChangeText={setDraft}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              placeholder={voice.recording ? 'listening…' : 'say it here…'} placeholderTextColor={Q.moonFaint}
              style={styles.input} multiline editable={!sending}
            />
            {(focused || draft || voice.recording || transcribing) ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Pressable style={styles.inlineBtn} onPress={pickPhoto} disabled={sending} hitSlop={8}>
                  <Text style={styles.inlineBtnTxt}>＋</Text>
                </Pressable>
                <Pressable style={styles.inlineBtn} onPress={onMic} disabled={sending || transcribing} hitSlop={8}>
                  <Text style={[styles.inlineMicTxt, voice.recording && styles.micLive]}>{transcribing ? '…' : voice.recording ? '■' : '🎙'}</Text>
                </Pressable>
              </View>
            ) : null}
            {draft.trim() || pendingImage ? (
              <Pressable style={styles.sendMoon} onPress={doSend} hitSlop={10}>
                <Svg width="34" height="34" viewBox="0 0 34 34">
                  <Defs><RadialGradient id="qmoon" cx="44%" cy="38%" r="62%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
                    <Stop offset="58%" stopColor={Q.glow} />
                    <Stop offset="100%" stopColor="#5d6ca6" />
                  </RadialGradient></Defs>
                  <Circle cx="17" cy="17" r="13.5" fill="url(#qmoon)" />
                  <Path d="M17 22 L17 12.5 M12.8 16.4 L17 12 L21.2 16.4" stroke="#0B0E1A" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </Svg>
              </Pressable>
            ) : null}
          </View>

          {/* the moon-door: journal · what i remember */}
          {sheet ? (
            <Pressable style={styles.popVeil} onPress={() => setSheet(false)}>
              {/* [zip29] the menu opens where you touched; the page is the dismiss */}
              <Pressable style={styles.popover} onPress={() => {}}>
                <Pressable onPress={() => { setSheet(false); onJournal(); }} hitSlop={6} style={styles.popRow}>
                  <Text style={styles.popLine}>the journal ›</Text>
                </Pressable>
                <View style={styles.popDivider} />
                <Pressable onPress={openStory} hitSlop={6} style={styles.popRow}>
                  <Text style={styles.popLine}>what i remember ›</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Q.deep },

  back: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 2 },
  backTxt: { fontFamily: 'Figtree_400Regular', color: Q.moonFaint, fontSize: 14, letterSpacing: 0.3 },

  zWrap: { height: 190, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  zCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },

  convo: { flex: 1, paddingHorizontal: 28 },
  convoEmpty: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  convoLive: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 30, paddingBottom: 18 },
  rest: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.moonFaint, fontSize: 19, lineHeight: 30, textAlign: 'center', letterSpacing: 0.2 },

  zNow: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.moon, textAlign: 'center', letterSpacing: 0.2, paddingHorizontal: 4 },
  youBare: { fontFamily: 'Figtree_300Light', color: Q.moonDim, lineHeight: 22, textAlign: 'right' },
  sharedPhoto: { width: 180, height: 180, borderRadius: 16, resizeMode: 'cover', opacity: 0.9 },

  pendingStrip: { paddingHorizontal: 24, paddingTop: 4, flexDirection: 'row' },
  pendingThumb: { width: 56, height: 56, borderRadius: 10, resizeMode: 'cover' },
  pendingX: { position: 'absolute', left: 66, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  pendingXTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  hairline: { height: 1, backgroundColor: 'rgba(240,241,250,0.11)', marginHorizontal: 24 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 6, paddingBottom: 10, minHeight: 48 },
  input: { flex: 1, fontFamily: 'Figtree_300Light', color: Q.moon, fontSize: 15.5, paddingVertical: 10, maxHeight: 120 },
  inlineBtn: { paddingHorizontal: 7, paddingBottom: 12 },
  inlineBtnTxt: { fontSize: 21, color: 'rgba(159,176,224,0.6)', lineHeight: 23 },
  inlineMicTxt: { fontSize: 15, color: 'rgba(159,176,224,0.6)', lineHeight: 21 },
  micLive: { color: '#FF6B5A', fontSize: 17 },
  sendMoon: { paddingLeft: 8, paddingBottom: 8 },

  popVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,5,10,0.30)' },   // [zip29] barely-there — its whole job is tap-anywhere
  popover: { position: 'absolute', top: 54, right: 18, minWidth: 190, backgroundColor: 'rgba(17,20,38,0.98)', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(240,241,250,0.14)', paddingVertical: 4, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  popRow: { paddingHorizontal: 18, paddingVertical: 12 },
  popDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(240,241,250,0.10)', marginHorizontal: 12 },
  popLine: { fontFamily: 'Fraunces_400Regular_Italic', color: Q.moonDim, fontSize: 15.5, letterSpacing: 0.3 },
});
