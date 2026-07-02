// ════════════════════════════════════════════════════════════════════════
//  yourZ — TRIVIA DUEL. The streak format: survival, difficulty climbs,
//  one miss ends the run — the run IS the score. No question caps, ever.
//  Sprint mode trades the miss for a 120-second total clock. Any persona
//  hosts in their own voice; the moderator rules; the streak burns bigger
//  as it grows.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { arenaStart, streamStage } from '../../api';
import { buzz, faceFor } from '../common';

const SPRINT_MS = 120000;
const TOPICS = ['cricket', 'bollywood', 'world history', 'science', 'geography', 'tech & internet', 'music', 'mythology', 'football', 'space', 'food', 'surprise me'];
const LEVELS = [[15, 'legend'], [10, 'expert'], [5, 'sharp'], [0, 'warm-up']];
const levelFor = (n) => LEVELS.find(([min]) => n >= min)[1];
const clean = (t) => (t || '').replace(/\[\[[^\]]*\]\]/g, '').trim()
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2');

function SprintClock({ deadline, onExpire }) {
  const [left, setLeft] = useState(SPRINT_MS);
  useEffect(() => {
    const iv = setInterval(() => {
      const l = Math.max(0, deadline - Date.now());
      setLeft(l);
      if (l <= 10500 && l > 9900) buzz('tick');
      if (l <= 0) { clearInterval(iv); onExpire(); }
    }, 250);
    return () => clearInterval(iv);
  }, []);
  const s = Math.ceil(left / 1000);
  return (
    <View style={st.clockRow}>
      <View style={st.clockTrack}>
        <View style={[st.clockFill, { width: `${(left / SPRINT_MS) * 100}%`, backgroundColor: s <= 20 ? '#F0708C' : '#8FD98F' }]} />
      </View>
      <Text style={[st.clockN, s <= 20 && { color: '#F0708C' }]}>{s}s</Text>
    </View>
  );
}

export default function TriviaMatch({ opponent, roster, onExit = () => {} }) {
  const host = (Array.isArray(roster) && roster[0]) || opponent || { key: 'the_brainiac', name: 'the brainiac', tone: '#6FC9E0' };
  const tone = host.tone || '#6FC9E0';

  const [topic, setTopic] = useState(null);
  const [ownTopic, setOwnTopic] = useState('');
  const [mode, setMode] = useState('streak');       // 'streak' | 'sprint'
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');

  const [match, setMatch] = useState(null);
  const [feed, setFeed] = useState([]);
  const [streak, setStreak] = useState(0);
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [line, setLine] = useState('');
  const [hintUsed, setHintUsed] = useState(false);
  const [deadline, setDeadline] = useState(null);
  const scroll = useRef(null);
  const matchRef = useRef(null); useEffect(() => { matchRef.current = match; }, [match]);
  const streakRef = useRef(0); useEffect(() => { streakRef.current = streak; }, [streak]);

  const topicText = topic === '__own__' ? ownTopic.trim() : topic;

  const send = useCallback((text, threadId, silent = false) => {
    if (!silent) setFeed((f) => [...f, { kind: 'you', text, id: Math.random() }]);
    setStreaming(true);
    streamStage({
      threadId, message: text,
      onBeat: (b) => {
        const kind = b.key === 'the_moderator' ? 'chair' : 'host';
        setFeed((f) => [...f, { kind, text: clean(b.text), id: Math.random() }]);
        buzz(kind === 'chair' ? 'tick' : 'tap');
      },
      onScore: (sc) => {
        const n = sc.you || 0;
        setStreak((prev) => { if (n > prev) buzz('knock'); else if (n < prev || n === prev) {} return n; });
      },
      onResult: (r) => {
        setResult(r); setDeadline(null);
        buzz(r.winner === 'you' ? 'win' : r.winner === 'z' ? 'lose' : 'knock');
      },
      onDone: () => setStreaming(false),
      onError: (m) => { setStreaming(false); setFeed((f) => [...f, { kind: 'chair', text: m, id: Math.random() }]); },
    });
  }, []);

  const begin = async () => {
    if (!topicText || starting) return;
    setStarting(true); setErr('');
    try {
      const j = await arenaStart({ game: 'trivia', personaKey: host.key });
      const m = { threadId: j.threadId, mode };
      setMatch(m); matchRef.current = m;
      setFeed([]); setStreak(0); setResult(null); setHintUsed(false);
      buzz('tap');
      const kick = `TRIVIA SETUP — topic: "${topicText}". Mode: ${mode.toUpperCase()}${mode === 'sprint' ? ' — the clock is running, keep everything rapid' : ' — survival, difficulty climbs with my streak'}. Host, first question.`;
      send(kick, j.threadId, true);
      if (mode === 'sprint') setDeadline(Date.now() + SPRINT_MS);
    } catch (e) { setErr(String(e.message || e)); }
    setStarting(false);
  };

  const submit = () => {
    const t = line.trim();
    if (!t || streaming || !match || result) return;
    setLine('');
    send(t, match.threadId);
  };
  const askHint = () => {
    if (streaming || !match || result || hintUsed) return;
    setHintUsed(true); buzz('tick');
    send('(lifeline) — a hint, please.', match.threadId);
  };
  const onSprintOver = useCallback(() => {
    const m = matchRef.current;
    if (!m || result) return;
    buzz('thud');
    send("(time! the sprint is over — tally my score and call it.)", m.threadId);
  }, [result, send]);

  useEffect(() => { scroll.current?.scrollToEnd?.({ animated: true }); }, [feed]);

  // ═══ THE RUN ═══
  if (match) {
    const lvl = levelFor(streak);
    return (
      <View style={st.root}>
        <LinearGradient colors={['#121A16', '#0C110E', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <Grain />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={st.bar}>
              <Pressable hitSlop={12} onPress={() => setMatch(null)}><Text style={st.chev}>‹</Text></Pressable>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={st.kicker}>{match.mode === 'sprint' ? 'sprint · beat the clock' : `streak · ${lvl}`}</Text>
                <Text style={st.topicLine} numberOfLines={1}>{topicText}</Text>
              </View>
              <View style={{ alignItems: 'center', marginRight: 10 }}>
                <Text style={[st.streakN, streak >= 10 && { color: '#F0708C' }]}>{streak}</Text>
                <Text style={st.streakLabel}>{streak === 1 ? 'answer' : 'answers'}</Text>
              </View>
              <Image source={{ uri: faceFor(host.key) }} style={[st.hostFace, { borderColor: tone }]} />
            </View>
            {match.mode === 'sprint' && deadline && !result && <SprintClock deadline={deadline} onExpire={onSprintOver} />}

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={st.feed} showsVerticalScrollIndicator={false}>
              {feed.map((b) => {
                if (b.kind === 'chair') return (
                  <View key={b.id} style={st.chairBeat}>
                    <Text style={st.chairText}>{b.text}</Text>
                  </View>
                );
                if (b.kind === 'you') return <Text key={b.id} style={st.youLine}>{b.text}</Text>;
                return (
                  <View key={b.id} style={st.hostBeat}>
                    <Text style={[st.hostName, { color: tone }]}>{host.name.toUpperCase()}</Text>
                    <Text style={st.hostLine}>{b.text}</Text>
                  </View>
                );
              })}
              {streaming && <Text style={[st.thinking, { color: tone }]}>…</Text>}
              {result && (
                <View style={st.resultCard}>
                  <Text style={st.resultKicker}>the run</Text>
                  <Text style={[st.resultWord, { color: result.winner === 'you' ? '#8FD98F' : result.winner === 'z' ? '#F0708C' : C.accentSoft }]}>
                    {result.winner === 'you' ? `${streak} STRAIGHT — ${levelFor(streak).toUpperCase()} RUN` : result.winner === 'z' ? 'THE QUESTIONS WON' : `${streak} — A FAIR RUN`}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable style={st.againBtn} onPress={() => { setMatch(null); setResult(null); }}>
                      <Text style={st.againTxt}>run it back</Text>
                    </Pressable>
                    <Pressable style={st.leaveBtn} onPress={onExit}>
                      <Text style={st.leaveTxt}>enough knowledge</Text>
                    </Pressable>
                  </View>
                </View>
              )}
              <View style={{ height: 16 }} />
            </ScrollView>

            {!result && (
              <View style={st.composer}>
                {match.mode === 'streak' && (
                  <Pressable onPress={askHint} disabled={hintUsed || streaming} hitSlop={8}
                    style={[st.hintBtn, (hintUsed || streaming) && { opacity: 0.3 }]}>
                    <Text style={st.hintTxt}>hint</Text>
                  </Pressable>
                )}
                <TextInput
                  value={line} onChangeText={setLine}
                  placeholder={streaming ? '…' : 'your answer…'}
                  placeholderTextColor={C.faint}
                  style={[st.input, streaming && { opacity: 0.5 }]}
                  editable={!streaming}
                  onSubmitEditing={submit}
                  returnKeyType="send"
                />
                <Pressable onPress={submit} disabled={streaming || !line.trim()} hitSlop={8}
                  style={[st.sendBtn, (streaming || !line.trim()) && { opacity: 0.35 }]}>
                  <Text style={st.sendTxt}>↑</Text>
                </Pressable>
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
      <LinearGradient colors={['#121A16', '#0C110E', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.kicker}>how many can you get</Text>
            <Text style={st.title}>trivia duel</Text>
          </View>
          <Image source={{ uri: faceFor(host.key) }} style={[st.hostFace, { borderColor: tone }]} />
        </View>
        <Text style={st.vsLine}>{host.name} asks. one miss ends a streak — how far can you ride?</Text>
        {err ? <Text style={st.err}>{err}</Text> : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
          <Text style={st.section}>pick your ground</Text>
          <View style={st.topicWrap}>
            {TOPICS.map((t) => (
              <Pressable key={t} style={[st.topicChip, topic === t && st.topicChipOn]} onPress={() => { buzz('tick'); setTopic(t); }}>
                <Text style={[st.topicTxt, topic === t && { color: '#8FD98F' }]}>{t}</Text>
              </Pressable>
            ))}
            <Pressable style={[st.topicChip, topic === '__own__' && st.topicChipOn]} onPress={() => { buzz('tick'); setTopic('__own__'); }}>
              <Text style={[st.topicTxt, { color: C.ember }, topic === '__own__' && { color: '#8FD98F' }]}>✎ your topic</Text>
            </Pressable>
          </View>
          {topic === '__own__' && (
            <TextInput value={ownTopic} onChangeText={setOwnTopic}
              placeholder="anything — 90s ads, test cricket, greek myths, your city…"
              placeholderTextColor={C.faint} style={st.ownInput} />
          )}
        </ScrollView>

        <View style={st.dock}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[['streak', 'streak · survival'], ['sprint', 'sprint · 120s ⏱']].map(([m, label]) => (
              <Pressable key={m} style={[st.pill, mode === m && st.pillOn]} onPress={() => { buzz('tick'); setMode(m); }}>
                <Text style={[st.pillTxt, mode === m && st.pillTxtOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={[st.beginBtn, (!topicText || starting) && { opacity: 0.4 }]} disabled={!topicText || starting} onPress={begin}>
            <Text style={st.beginTxt}>{starting ? 'sharpening the questions…' : 'first question'}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C110E' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#8FD98F', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 25 },
  topicLine: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 14.5 },
  hostFace: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#12160f' },
  vsLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5, paddingHorizontal: 18, paddingTop: 4 },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, paddingHorizontal: 18, paddingTop: 6 },
  streakN: { fontFamily: FONTS.display, color: '#8FD98F', fontSize: 26, lineHeight: 28 },
  streakLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },

  feed: { paddingHorizontal: 18, paddingTop: 8 },
  chairBeat: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 8 },
  chairText: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  hostBeat: { marginVertical: 8, maxWidth: '90%' },
  hostName: { fontFamily: FONTS.semibold, fontSize: 10.5, letterSpacing: 1.8, marginBottom: 3 },
  hostLine: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, lineHeight: 22 },
  youLine: { fontFamily: FONTS.body, color: '#FFE9C7', fontSize: 14.5, lineHeight: 21, textAlign: 'right', marginVertical: 8, alignSelf: 'flex-end', maxWidth: '88%' },
  thinking: { fontFamily: FONTS.display, fontSize: 18, textAlign: 'center', marginVertical: 8 },

  resultCard: { marginVertical: 16, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(143,217,143,0.35)', backgroundColor: 'rgba(143,217,143,0.05)', alignItems: 'center' },
  resultKicker: { fontFamily: FONTS.body, color: '#8FD98F', fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  resultWord: { fontFamily: FONTS.display, fontSize: 19, marginTop: 8, textAlign: 'center' },
  againBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.1)' },
  againTxt: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 13.5 },
  leaveBtn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },

  clockRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 10, paddingTop: 6 },
  clockTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  clockFill: { height: 4, borderRadius: 2 },
  clockN: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 12, width: 36, textAlign: 'right' },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  hintBtn: { paddingHorizontal: 12, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,192,136,0.45)' },
  hintTxt: { fontFamily: FONTS.medium, color: '#E0C088', fontSize: 12 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', color: C.cream, fontFamily: FONTS.body, fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,217,143,0.14)', borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)' },
  sendTxt: { color: '#8FD98F', fontSize: 19 },

  section: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 10 },
  topicWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  topicChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  topicChipOn: { borderColor: '#8FD98F', backgroundColor: 'rgba(143,217,143,0.1)' },
  topicTxt: { fontFamily: FONTS.medium, color: C.muted, fontSize: 13 },
  ownInput: { marginHorizontal: 16, marginTop: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.35)', backgroundColor: 'rgba(0,0,0,0.25)', color: C.cream, fontFamily: FONTS.body, fontSize: 14, padding: 12 },

  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, gap: 10, backgroundColor: 'rgba(12,17,14,0.94)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.07)' },
  pill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  pillOn: { borderColor: '#8FD98F', backgroundColor: 'rgba(143,217,143,0.12)' },
  pillTxt: { fontFamily: FONTS.medium, color: C.muted, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 1 },
  pillTxtOn: { color: '#8FD98F' },
  beginBtn: { paddingVertical: 14, borderRadius: 16, alignItems: 'center', backgroundColor: 'rgba(143,217,143,0.12)', borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)' },
  beginTxt: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 15 },
});
