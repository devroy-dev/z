// ════════════════════════════════════════════════════════════════════════
//  yourZ — DEBATE ZONE. Argument as sport. The momentum format: no rounds,
//  no turn caps — a conviction bar that moves on every exchange, phases
//  called by the chair (openings → the clash → closings), and a verdict
//  that names the argument that decided it. Blitz mode puts YOUR replies
//  on a real 75-second shot clock; expiry yields the floor.
//  Beats flow automatically here (a fight, not a page-turner) — the reveal
//  law belongs to the Stage; the Zone runs on momentum.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { arenaStart, streamStage } from '../../api';
import { buzz, faceFor } from '../common';
import { MOTIONS, MOTION_CATS, shuffleMotions } from './motions';

const BLITZ_MS = 75000;
const clean = (t) => (t || '').replace(/\[\[[^\]]*\]\]/g, '').trim()
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2');

function MomentumBar({ you, oppTone, oppName }) {
  const w = useSharedValue(50);
  useEffect(() => { w.value = withTiming(you, { duration: 900, easing: Easing.out(Easing.cubic) }); }, [you]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value}%` }));
  return (
    <View style={st.momWrap}>
      <View style={st.momLabels}>
        <Text style={[st.momPct, { color: C.ember }]}>{you}</Text>
        <Text style={st.momTitle}>momentum</Text>
        <Text style={[st.momPct, { color: oppTone }]}>{100 - you}</Text>
      </View>
      <View style={[st.momTrack, { backgroundColor: `${oppTone}44` }]}>
        <Animated.View style={[st.momFill, fill]} />
      </View>
      <View style={st.momNames}>
        <Text style={st.momName}>you</Text>
        <Text style={st.momName}>{oppName}</Text>
      </View>
    </View>
  );
}

function ShotClock({ deadline, onExpire }) {
  const [left, setLeft] = useState(BLITZ_MS);
  useEffect(() => {
    const iv = setInterval(() => {
      const l = Math.max(0, deadline - Date.now());
      setLeft(l);
      if (l <= 5200 && l > 4800) buzz('tick');
      if (l <= 0) { clearInterval(iv); onExpire(); }
    }, 200);
    return () => clearInterval(iv);
  }, [deadline]);
  const s = Math.ceil(left / 1000);
  return (
    <View style={st.clockRow}>
      <View style={st.clockTrack}>
        <View style={[st.clockFill, { width: `${(left / BLITZ_MS) * 100}%`, backgroundColor: s <= 15 ? '#F0708C' : C.ember }]} />
      </View>
      <Text style={[st.clockN, s <= 15 && { color: '#F0708C' }]}>{s}s</Text>
    </View>
  );
}

export default function DebateMatch({ opponent, roster, onExit = () => {} }) {
  const opp = (Array.isArray(roster) && roster[0]) || opponent || { key: 'the_leader_opp', name: 'the opposition', tone: '#6FC9E0' };
  const oppTone = opp.tone || '#6FC9E0';

  // setup state
  const [motion, setMotion] = useState(null);
  const [own, setOwn] = useState('');
  const [side, setSide] = useState('for');           // 'for' | 'against'
  const [format, setFormat] = useState('full');      // 'full' | 'blitz'
  const [featured] = useState(() => shuffleMotions(4));
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');

  // match state
  const [match, setMatch] = useState(null);          // { threadId }
  const [feed, setFeed] = useState([]);              // { kind:'you'|'opp'|'chair', text }
  const [momentum, setMomentum] = useState(50);
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [line, setLine] = useState('');
  const [deadline, setDeadline] = useState(null);    // blitz shot clock
  const scroll = useRef(null);
  const matchRef = useRef(null); useEffect(() => { matchRef.current = match; }, [match]);

  const motionText = motion === '__own__' ? own.trim() : motion?.text;

  const send = useCallback((text, threadId, silent = false) => {
    if (!silent) setFeed((f) => [...f, { kind: 'you', text, id: Math.random() }]);
    setStreaming(true); setDeadline(null);
    streamStage({
      threadId,
      message: text,
      onBeat: (b) => {
        const kind = b.key === 'the_moderator' ? 'chair' : 'opp';
        setFeed((f) => [...f, { kind, text: clean(b.text), id: Math.random() }]);
        buzz(kind === 'chair' ? 'tick' : 'tap');
      },
      onScore: (sc) => {
        const total = (sc.you || 0) + (sc.z || 0) || 100;
        setMomentum(Math.round(((sc.you || 0) / total) * 100));
      },
      onResult: (r) => { setResult(r); buzz(r.winner === 'you' ? 'win' : r.winner === 'z' ? 'lose' : 'knock'); },
      onDone: () => {
        setStreaming(false);
        const m = matchRef.current;
        if (m && m.format === 'blitz') setDeadline(Date.now() + BLITZ_MS);
      },
      onError: (msg) => { setStreaming(false); setFeed((f) => [...f, { kind: 'chair', text: msg, id: Math.random() }]); },
    });
  }, []);

  const begin = async () => {
    const mt = motionText;
    if (!mt || starting) return;
    setStarting(true); setErr('');
    try {
      const j = await arenaStart({ game: 'debate', personaKey: opp.key });
      const m = { threadId: j.threadId, format };
      setMatch(m); matchRef.current = m;
      setFeed([]); setMomentum(50); setResult(null);
      buzz('tap');
      const kick = `DEBATE SETUP — the motion: "${mt}". I argue ${side.toUpperCase()}; ${opp.name} argues ${side === 'for' ? 'AGAINST' : 'FOR'}. Format: ${format === 'blitz' ? 'BLITZ — the chamber is on the clock, short and punchy' : 'FULL debate'}. Chair, frame the motion and call for opening statements.`;
      send(kick, j.threadId, true);
    } catch (e) { setErr(String(e.message || e)); }
    setStarting(false);
  };

  const submit = () => {
    const t = line.trim();
    if (!t || streaming || !match || result) return;
    setLine(''); setDeadline(null);
    send(t, match.threadId);
  };

  const onClockExpire = useCallback(() => {
    const m = matchRef.current;
    if (!m || result) return;
    buzz('thud');
    setDeadline(null);
    setLine('');
    send('(my time expired — I yield the floor.)', m.threadId);
  }, [result, send]);

  useEffect(() => { scroll.current?.scrollToEnd?.({ animated: true }); }, [feed]);

  // ═══ THE MATCH ═══
  if (match) {
    return (
      <View style={st.root}>
        <LinearGradient colors={['#131A22', '#0C1015', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <Grain />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={st.bar}>
              <Pressable hitSlop={12} onPress={() => setMatch(null)}><Text style={st.chev}>‹</Text></Pressable>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={st.kicker}>{match.format === 'blitz' ? 'blitz · the chamber is on the clock' : 'debate zone'}</Text>
                <Text style={st.motionLine} numberOfLines={2}>“{motionText}”</Text>
              </View>
              <Image source={{ uri: faceFor(opp.key) }} style={[st.oppFace, { borderColor: oppTone }]} />
            </View>

            <MomentumBar you={momentum} oppTone={oppTone} oppName={opp.name} />

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={st.feed} showsVerticalScrollIndicator={false}>
              {feed.map((b) => {
                if (b.kind === 'chair') return (
                  <View key={b.id} style={st.chairBeat}>
                    <Text style={st.chairKicker}>the chair</Text>
                    <Text style={st.chairText}>{b.text}</Text>
                  </View>
                );
                if (b.kind === 'you') return (
                  <View key={b.id} style={st.youBeat}>
                    <Text style={st.youLine}>{b.text}</Text>
                  </View>
                );
                return (
                  <View key={b.id} style={st.oppBeat}>
                    <Text style={[st.oppName, { color: oppTone }]}>{opp.name.toUpperCase()}</Text>
                    <Text style={st.oppLine}>{b.text}</Text>
                  </View>
                );
              })}
              {streaming && <Text style={st.thinking}>the chamber stirs…</Text>}
              {result && (
                <View style={st.resultCard}>
                  <Text style={st.resultKicker}>the verdict</Text>
                  <Text style={[st.resultWord, { color: result.winner === 'you' ? '#8FD98F' : result.winner === 'z' ? '#F0708C' : C.accentSoft }]}>
                    {result.winner === 'you' ? 'MOTION CARRIED — YOU' : result.winner === 'z' ? `${opp.name.toUpperCase()} TAKES IT` : 'THE HOUSE IS SPLIT'}
                  </Text>
                  <Text style={st.resultScore}>{momentum} — {100 - momentum}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable style={st.setupBtnOn} onPress={() => { setMatch(null); setResult(null); }}>
                      <Text style={st.setupBtnOnTxt}>new motion</Text>
                    </Pressable>
                    <Pressable style={st.setupBtn} onPress={onExit}>
                      <Text style={st.setupBtnTxt}>leave the chamber</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={{ height: 16 }} />
            </ScrollView>

            {!result && (
              <View>
                {deadline && !streaming && <ShotClock deadline={deadline} onExpire={onClockExpire} />}
                <View style={st.composer}>
                  <TextInput
                    value={line} onChangeText={setLine} multiline
                    placeholder={streaming ? 'the floor is not yours yet…' : 'make your argument…'}
                    placeholderTextColor={C.faint}
                    style={[st.input, streaming && { opacity: 0.5 }]}
                    editable={!streaming}
                  />
                  <Pressable onPress={submit} disabled={streaming || !line.trim()} hitSlop={8}
                    style={[st.sendBtn, (streaming || !line.trim()) && { opacity: 0.35 }]}>
                    <Text style={st.sendTxt}>↑</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ═══ THE SETUP ═══
  return (
    <View style={st.root}>
      <LinearGradient colors={['#131A22', '#0C1015', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.kicker}>argue your side</Text>
            <Text style={st.title}>debate zone</Text>
          </View>
          <Image source={{ uri: faceFor(opp.key) }} style={[st.oppFace, { borderColor: oppTone }]} />
        </View>
        <Text style={st.vsLine}>vs {opp.name} — they take whichever side you don't.</Text>
        {err ? <Text style={st.err}>{err}</Text> : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <Text style={st.section}>tonight's motions</Text>
          {featured.map((m) => (
            <Pressable key={m.id} style={[st.motionRow, motion?.id === m.id && st.motionRowOn]} onPress={() => { buzz('tick'); setMotion(m); }}>
              <Text style={st.motionText}>{m.text}</Text>
            </Pressable>
          ))}
          <Pressable style={[st.motionRow, motion === '__own__' && st.motionRowOn]} onPress={() => { buzz('tick'); setMotion('__own__'); }}>
            <Text style={[st.motionText, { color: C.ember }]}>✎  bring your own motion</Text>
          </Pressable>
          {motion === '__own__' && (
            <TextInput value={own} onChangeText={setOwn} multiline
              placeholder="state the motion — one sharp sentence both sides can fight over…"
              placeholderTextColor={C.faint} style={st.ownInput} />
          )}

          {MOTION_CATS.map((cat) => (
            <View key={cat.id}>
              <Text style={st.section}>{cat.label}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.catRow}>
                {MOTIONS.filter((m) => m.c === cat.id).map((m) => (
                  <Pressable key={m.id} style={[st.motionCard, motion?.id === m.id && st.motionCardOn]} onPress={() => { buzz('tick'); setMotion(m); }}>
                    <Text style={st.motionCardText} numberOfLines={4}>{m.text}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ))}
        </ScrollView>

        {/* the launch dock */}
        <View style={st.dock}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['for', 'against'].map((sd) => (
              <Pressable key={sd} style={[st.pill, side === sd && st.pillOn]} onPress={() => { buzz('tick'); setSide(sd); }}>
                <Text style={[st.pillTxt, side === sd && st.pillTxtOn]}>{sd}</Text>
              </Pressable>
            ))}
            <View style={{ width: 10 }} />
            {[['full', 'full debate'], ['blitz', 'blitz ⏱']].map(([f, label]) => (
              <Pressable key={f} style={[st.pill, format === f && st.pillOn]} onPress={() => { buzz('tick'); setFormat(f); }}>
                <Text style={[st.pillTxt, format === f && st.pillTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[st.beginBtn, (!motionText || starting) && { opacity: 0.4 }]} disabled={!motionText || starting} onPress={begin}>
            <Text style={st.beginTxt}>{starting ? 'convening the chamber…' : 'take the floor'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C1015' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#6FC9E0', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 25 },
  motionLine: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 14, lineHeight: 19 },
  oppFace: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#141a20' },
  vsLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5, paddingHorizontal: 18, paddingTop: 4 },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, paddingHorizontal: 18, paddingTop: 6 },

  momWrap: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 4 },
  momLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  momPct: { fontFamily: FONTS.display, fontSize: 22 },
  momTitle: { fontFamily: FONTS.body, color: C.faint, fontSize: 9.5, letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 4 },
  momTrack: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 4 },
  momFill: { height: 6, backgroundColor: C.ember, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  momNames: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  momName: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5 },

  feed: { paddingHorizontal: 18, paddingTop: 8 },
  chairBeat: { alignItems: 'center', marginVertical: 10, paddingHorizontal: 10 },
  chairKicker: { fontFamily: FONTS.body, color: 'rgba(201,155,232,0.7)', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase' },
  chairText: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.8)', fontSize: 13.5, lineHeight: 20, textAlign: 'center', marginTop: 3 },
  oppBeat: { marginVertical: 8, maxWidth: '88%' },
  oppName: { fontFamily: FONTS.semibold, fontSize: 10.5, letterSpacing: 1.8, marginBottom: 3 },
  oppLine: { fontFamily: FONTS.body, color: C.cream, fontSize: 14.5, lineHeight: 21.5 },
  youBeat: { marginVertical: 8, alignItems: 'flex-end' },
  youLine: { fontFamily: FONTS.body, color: '#FFE9C7', fontSize: 14.5, lineHeight: 21.5, textAlign: 'right', maxWidth: '88%' },
  thinking: { fontFamily: FONTS.displayItalic, color: '#6FC9E0', fontSize: 12.5, textAlign: 'center', marginVertical: 12, opacity: 0.8 },

  resultCard: { marginVertical: 16, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(111,201,224,0.35)', backgroundColor: 'rgba(111,201,224,0.05)', alignItems: 'center' },
  resultKicker: { fontFamily: FONTS.body, color: '#6FC9E0', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  resultWord: { fontFamily: FONTS.display, fontSize: 20, marginTop: 8, textAlign: 'center' },
  resultScore: { fontFamily: FONTS.display, color: C.muted, fontSize: 15, marginTop: 4 },

  clockRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, paddingBottom: 2 },
  clockTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  clockFill: { height: 4, borderRadius: 2 },
  clockN: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 12, width: 32, textAlign: 'right' },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', color: C.cream, fontFamily: FONTS.body, fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(111,201,224,0.14)', borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)' },
  sendTxt: { color: '#6FC9E0', fontSize: 19 },

  section: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 8 },
  motionRow: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.03)' },
  motionRowOn: { borderColor: '#6FC9E0', backgroundColor: 'rgba(111,201,224,0.08)' },
  motionText: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, lineHeight: 20 },
  ownInput: { marginHorizontal: 16, marginBottom: 8, minHeight: 64, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.35)', backgroundColor: 'rgba(0,0,0,0.25)', color: C.cream, fontFamily: FONTS.body, fontSize: 14, padding: 12, textAlignVertical: 'top' },
  catRow: { paddingHorizontal: 14, gap: 8 },
  motionCard: { width: 180, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.03)', minHeight: 92 },
  motionCardOn: { borderColor: '#6FC9E0', backgroundColor: 'rgba(111,201,224,0.08)' },
  motionCardText: { fontFamily: FONTS.body, color: C.muted, fontSize: 12.5, lineHeight: 18 },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, gap: 10, backgroundColor: 'rgba(12,16,21,0.94)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  pillOn: { borderColor: '#6FC9E0', backgroundColor: 'rgba(111,201,224,0.12)' },
  pillTxt: { fontFamily: FONTS.medium, color: C.muted, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 1 },
  pillTxtOn: { color: '#6FC9E0' },
  beginBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(111,201,224,0.12)', borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)' },
  beginTxt: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 15 },
  setupBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  setupBtnTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },
  setupBtnOn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.1)' },
  setupBtnOnTxt: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 13.5 },
});
