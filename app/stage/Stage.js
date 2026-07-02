// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE STAGE. Roadmap §4, move 1: kill the chat — render a
//  SCREENPLAY with BEAT REVEAL. Scene-setting as centered italic stage
//  direction; cast lines as nameplated dialogue with faces; your lines as
//  the lead's. The multi-persona response is HELD: one beat shows, a quiet
//  "next" waits, tap = page-turn. Spoken cadence WITHIN a beat; the pause
//  between beats belongs to the player's thumb. Every scene has a mission.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import Grain from '../Grain';
import { C, FONTS } from '../theme';
import { roleplayStart, streamStage } from '../api';
import { buzz } from '../games/common';
import { LIBRARY, PINNED, GENRES, shuffleFeatured, byId, KICKOFF } from './library';

const VIOLET = '#C99BE8';
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const NAME_TONES = ['#C99BE8', '#6FC9E0', '#F0708C', '#8FD98F', '#E0C088', '#F0A765'];

// ── a card in the library ──
function SceneCard({ s, wide, onPress }) {
  return (
    <Pressable style={[st.card, wide && st.cardWide]} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={st.cardIc}>{s.ic}</Text>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={st.cardName} numberOfLines={1}>{s.name}</Text>
          <Text style={st.cardTag} numberOfLines={1}>{s.tag}</Text>
        </View>
      </View>
      <Text style={st.cardDesc} numberOfLines={wide ? 3 : 4}>{s.desc}</Text>
      <View style={st.castRow}>
        {s.cast.slice(0, 5).map((k, i) => (
          <Image key={k} source={{ uri: faceFor(k) }} style={[st.castFace, i > 0 && { marginLeft: -8 }]} />
        ))}
      </View>
    </Pressable>
  );
}

// ── one revealed beat, typed on at spoken cadence ──
function Beat({ beat, playerName, onTyped, instant }) {
  const isDirection = beat.key === 'the_moderator';
  const isYou = beat.key === '__you__';
  const [shown, setShown] = useState(instant ? beat.text : '');
  useEffect(() => {
    if (instant) { setShown(beat.text); return; }
    const words = beat.text.split(/(\s+)/);
    let i = 0;
    const iv = setInterval(() => {
      i += 2;
      setShown(words.slice(0, i).join(''));
      if (i >= words.length) { clearInterval(iv); setShown(beat.text); onTyped && onTyped(); }
    }, 34);
    return () => clearInterval(iv);
  }, []);
  if (isYou) {
    return (
      <View style={st.youBeat}>
        <Text style={st.youName}>YOU</Text>
        <Text style={st.youLine}>{shown}</Text>
      </View>
    );
  }
  if (isDirection) {
    return <Text style={st.direction}>{shown}</Text>;
  }
  return (
    <View style={st.dlgBeat}>
      <View style={st.plateRow}>
        <Image source={{ uri: faceFor(beat.key) }} style={[st.plateFace, { borderColor: beat.tone }]} />
        <Text style={[st.plateName, { color: beat.tone }]}>{(beat.name || beat.key.replace(/^the_/, 'the ')).toUpperCase()}</Text>
      </View>
      <Text style={st.dlgLine}>{shown}</Text>
    </View>
  );
}

function CurtainPulse() {
  const b = useSharedValue(0.4);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const a = useAnimatedStyle(() => ({ opacity: b.value }));
  return <Animated.Text style={[st.curtain, a]}>the scene unfolds…</Animated.Text>;
}

// ════════════════════════════════════════════════════════════════════════
export default function Stage({ onBack = () => {} }) {
  const [featured] = useState(() => shuffleFeatured(6));
  const [scene, setScene] = useState(null);            // { s, threadId }
  const [customOpen, setCustomOpen] = useState(false);
  const [customBrief, setCustomBrief] = useState('');
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');

  // ── scene state ──
  const [beats, setBeats] = useState([]);              // revealed beats
  const [queue, setQueue] = useState([]);              // held beats (the law)
  const [typing, setTyping] = useState(false);         // a beat is typing on
  const [streaming, setStreaming] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [line, setLine] = useState('');
  const scroll = useRef(null);
  const toneMap = useRef({});

  const toneFor = (key) => {
    if (!toneMap.current[key]) {
      const used = Object.keys(toneMap.current).length;
      toneMap.current[key] = NAME_TONES[used % NAME_TONES.length];
    }
    return toneMap.current[key];
  };

  const begin = useCallback(async (s, brief) => {
    if (starting) return;
    setStarting(true); setErr('');
    try {
      const fullBrief = (s.id === 'custom' ? (brief || '') : s.desc).slice(0, 990);
      const j = await roleplayStart({ scenario: s.id, brief: fullBrief, cast: s.cast });
      toneMap.current = {};
      setScene({ s, threadId: j.threadId });
      setBeats([]); setQueue([]); setVerdict(null); setTyping(false);
      setCustomOpen(false); setCustomBrief('');
      sendLine(KICKOFF(s.id), j.threadId, true);
      buzz('tap');
    } catch (e) { setErr(String(e.message || e)); }
    setStarting(false);
  }, [starting]);

  const sendLine = useCallback((text, threadId, silent = false) => {
    if (!silent) {
      setBeats((b) => [...b, { key: '__you__', name: 'you', text, id: Math.random() }]);
    }
    setStreaming(true);
    streamStage({
      threadId,
      message: text,
      onBeat: (beat) => setQueue((q) => [...q, { ...beat, tone: toneFor(beat.key), id: Math.random() }]),
      onVerdict: (v) => setVerdict(v),
      onDone: () => setStreaming(false),
      onError: (m) => { setStreaming(false); setQueue((q) => [...q, { key: 'the_moderator', name: 'the moderator', text: m, tone: VIOLET, id: Math.random() }]); },
    });
  }, []);

  const revealNext = () => {
    if (typing || !queue.length) return;
    buzz('tap');
    const [next, ...rest] = queue;
    setQueue(rest);
    setTyping(true);
    setBeats((b) => [...b, next]);
  };

  // auto-reveal the very first beat of a fresh scene (the curtain rises itself)
  useEffect(() => {
    if (beats.length === 0 && queue.length > 0 && !typing) revealNext();
  }, [queue, beats.length, typing]);

  useEffect(() => { scroll.current?.scrollToEnd?.({ animated: true }); }, [beats, queue.length, typing]);

  const sceneOver = verdict && queue.length === 0 && !typing && !streaming;
  useEffect(() => { if (sceneOver) buzz(verdict.outcome === 'win' ? 'win' : verdict.outcome === 'loss' ? 'lose' : 'knock'); }, [sceneOver]);

  const submit = () => {
    const t = line.trim();
    if (!t || streaming || queue.length || typing || !scene || verdict) return;
    setLine('');
    sendLine(t, scene.threadId);
  };

  // ═══ THE SCENE ═══
  if (scene) {
    const composerGated = streaming || queue.length > 0 || typing;
    return (
      <View style={st.root}>
        <LinearGradient colors={['#171223', '#0F0B16', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <Grain />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={st.sceneBar}>
              <Pressable hitSlop={12} onPress={() => setScene(null)}><Text style={st.chev}>‹</Text></Pressable>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={st.sceneKicker}>{scene.s.tag}</Text>
                <Text style={st.sceneTitle} numberOfLines={1}>{scene.s.name}</Text>
              </View>
            </View>
            <Text style={st.mission} numberOfLines={2}>{scene.s.id === 'custom' ? 'your scene, your mission — the moderator holds the verdict.' : scene.s.desc}</Text>

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={st.script} showsVerticalScrollIndicator={false}>
              {beats.map((b, i) => (
                <Beat key={b.id} beat={b} instant={i < beats.length - 1}
                  onTyped={() => setTyping(false)} />
              ))}
              {streaming && beats.length === 0 && <CurtainPulse />}
              {!typing && queue.length > 0 && (
                <Pressable style={st.nextBtn} onPress={revealNext}>
                  <Text style={st.nextTxt}>▸ &nbsp;next</Text>
                </Pressable>
              )}
              {sceneOver && (
                <View style={st.verdictCard}>
                  <Text style={st.verdictKicker}>the verdict</Text>
                  <Text style={[st.verdictWord, { color: verdict.outcome === 'win' ? '#8FD98F' : verdict.outcome === 'loss' ? '#F0708C' : C.accentSoft }]}>
                    {verdict.outcome === 'win' ? 'YOU WON THE SCENE' : verdict.outcome === 'loss' ? 'THE SCENE WON' : 'A DRAW'}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                    <Pressable style={st.vBtn} onPress={() => begin(scene.s, scene.s.id === 'custom' ? customBrief : undefined)}>
                      <Text style={st.vBtnTxt}>run it again</Text>
                    </Pressable>
                    <Pressable style={[st.vBtn, { borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'transparent' }]} onPress={() => setScene(null)}>
                      <Text style={[st.vBtnTxt, { color: C.muted }]}>take a bow</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={{ height: 20 }} />
            </ScrollView>

            {!sceneOver && (
              <View style={st.composer}>
                <TextInput
                  value={line} onChangeText={setLine}
                  placeholder={composerGated ? 'reveal the scene first ▸' : 'your line…'}
                  placeholderTextColor={C.faint}
                  style={[st.input, composerGated && { opacity: 0.5 }]}
                  editable={!composerGated}
                  multiline
                  onSubmitEditing={submit}
                />
                <Pressable onPress={submit} disabled={composerGated || !line.trim()} hitSlop={8}
                  style={[st.sendBtn, (composerGated || !line.trim()) && { opacity: 0.35 }]}>
                  <Text style={st.sendTxt}>↑</Text>
                </Pressable>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ═══ THE LIBRARY ═══
  return (
    <View style={st.root}>
      <LinearGradient colors={['#171223', '#0F0B16', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.sceneBar}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.sceneKicker}>live it out</Text>
            <Text style={st.sceneTitle}>the stage</Text>
          </View>
        </View>
        {err ? <Text style={st.err}>{err}</Text> : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* pinned rails */}
          <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 6 }}>
            {PINNED.map((s) => (
              <Pressable key={s.id} style={st.pinned} onPress={() => (s.id === 'custom' ? setCustomOpen(true) : begin(s))}>
                <Text style={st.pinnedIc}>{s.ic}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={st.pinnedName}>{s.name}</Text>
                  <Text style={st.pinnedTag}>{s.tag}</Text>
                </View>
                <Text style={st.pinnedGo}>▸</Text>
              </Pressable>
            ))}
          </View>

          {customOpen && (
            <View style={st.customBox}>
              <Text style={st.customLabel}>describe your scene — every scene gets a mission.</Text>
              <TextInput
                value={customBrief} onChangeText={setCustomBrief} multiline
                placeholder="a heist, a trial, a finale you'd rewrite, a moment from history…"
                placeholderTextColor={C.faint} style={st.customInput}
              />
              <Pressable style={[st.vBtn, { alignSelf: 'flex-end' }, !customBrief.trim() && { opacity: 0.4 }]}
                disabled={!customBrief.trim() || starting}
                onPress={() => begin(PINNED.find((p) => p.id === 'custom'), customBrief.trim())}>
                <Text style={st.vBtnTxt}>{starting ? 'raising the curtain…' : 'begin'}</Text>
              </Pressable>
            </View>
          )}

          {/* tonight's bill */}
          <Text style={st.section}>tonight's bill</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
            {featured.map((s) => <SceneCard key={s.id} s={s} wide onPress={() => begin(s)} />)}
          </ScrollView>

          {/* the full repertory, by genre */}
          {GENRES.map((g) => {
            const scenes = LIBRARY.filter((s) => s.g === g.id);
            if (!scenes.length) return null;
            return (
              <View key={g.id}>
                <Text style={st.section}>{g.label}{g.note ? <Text style={st.sectionNote}>  ·  {g.note}</Text> : null}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
                  {scenes.map((s) => <SceneCard key={s.id} s={s} onPress={() => begin(s)} />)}
                </ScrollView>
              </View>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F0B16' },
  sceneBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  sceneKicker: { fontFamily: FONTS.body, color: VIOLET, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.8 },
  sceneTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 25 },
  mission: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 12.5, paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, lineHeight: 17 },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, paddingHorizontal: 18, paddingTop: 6 },

  // library
  pinned: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,155,232,0.35)', backgroundColor: 'rgba(201,155,232,0.07)', paddingHorizontal: 16, paddingVertical: 13 },
  pinnedIc: { fontSize: 20, color: VIOLET },
  pinnedName: { fontFamily: FONTS.medium, color: C.cream, fontSize: 15.5 },
  pinnedTag: { fontFamily: FONTS.light, color: C.faint, fontSize: 11.5, marginTop: 1 },
  pinnedGo: { color: VIOLET, fontSize: 16 },
  customBox: { marginHorizontal: 16, marginTop: 10, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(201,155,232,0.3)', backgroundColor: 'rgba(0,0,0,0.25)', gap: 10 },
  customLabel: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5 },
  customInput: { minHeight: 70, color: C.cream, fontFamily: FONTS.body, fontSize: 14.5, textAlignVertical: 'top' },
  section: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 22, paddingBottom: 8 },
  sectionNote: { textTransform: 'none', letterSpacing: 0.3, color: 'rgba(201,155,232,0.6)' },
  row: { paddingHorizontal: 14, gap: 10 },
  card: { width: 210, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.03)', padding: 13 },
  cardWide: { width: 260, borderColor: 'rgba(201,155,232,0.3)', backgroundColor: 'rgba(201,155,232,0.05)' },
  cardIc: { fontSize: 17, color: VIOLET },
  cardName: { fontFamily: FONTS.medium, color: C.cream, fontSize: 14.5 },
  cardTag: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5, marginTop: 1 },
  cardDesc: { fontFamily: FONTS.light, color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 8, minHeight: 48 },
  castRow: { flexDirection: 'row', marginTop: 10 },
  castFace: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: 'rgba(0,0,0,0.5)', backgroundColor: '#1a121f' },

  // the script
  script: { paddingHorizontal: 20, paddingTop: 6 },
  direction: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.78)', fontSize: 15, lineHeight: 23, textAlign: 'center', paddingHorizontal: 10, marginVertical: 14 },
  dlgBeat: { marginVertical: 10 },
  plateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  plateFace: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.2, backgroundColor: '#1a121f' },
  plateName: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 1.8, marginLeft: 8 },
  dlgLine: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, lineHeight: 22.5, marginLeft: 30 },
  youBeat: { marginVertical: 10, alignItems: 'flex-end' },
  youName: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 11, letterSpacing: 1.8, marginBottom: 3 },
  youLine: { fontFamily: FONTS.body, color: '#FFE9C7', fontSize: 15, lineHeight: 22.5, textAlign: 'right', maxWidth: '86%' },
  curtain: { fontFamily: FONTS.displayItalic, color: VIOLET, fontSize: 13.5, textAlign: 'center', marginTop: 40 },

  nextBtn: { alignSelf: 'center', marginVertical: 12, paddingHorizontal: 26, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(201,155,232,0.45)', backgroundColor: 'rgba(201,155,232,0.08)' },
  nextTxt: { fontFamily: FONTS.body, color: VIOLET, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },

  verdictCard: { marginVertical: 18, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(201,155,232,0.35)', backgroundColor: 'rgba(201,155,232,0.06)', alignItems: 'center' },
  verdictKicker: { fontFamily: FONTS.body, color: VIOLET, fontSize: 10.5, letterSpacing: 3, textTransform: 'uppercase' },
  verdictWord: { fontFamily: FONTS.display, fontSize: 22, marginTop: 8, textAlign: 'center' },
  vBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(201,155,232,0.5)', backgroundColor: 'rgba(201,155,232,0.1)' },
  vBtnTxt: { fontFamily: FONTS.semibold, color: VIOLET, fontSize: 13.5 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 110, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', color: C.cream, fontFamily: FONTS.body, fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(201,155,232,0.15)', borderWidth: 1, borderColor: 'rgba(201,155,232,0.5)' },
  sendTxt: { color: VIOLET, fontSize: 19 },
});
