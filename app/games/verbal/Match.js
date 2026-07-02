// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE VERBAL DUELS. One surface, four games: Riddle Me (the
//  gauntlet), 20 Questions, Would You Rather, Dilemma Zone. All host/judge
//  shapes on the group-loop rails: any persona hosts in their own voice,
//  the moderator rules, nothing is capped — the player calls the run.
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

const clean = (t) => (t || '').replace(/\[\[[^\]]*\]\]/g, '').trim()
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2');

export const VERBAL_GAMES = {
  riddle: {
    title: 'riddle me', kicker: 'the gauntlet', tone: '#E0C088',
    defaultHost: { key: 'the_brainiac', name: 'the brainiac' },
    intro: 'riddles until you say stop. misses don\u2019t end it — riddles are supposed to hurt.',
    scoreLabel: 'cracked',
    beginLabel: 'first riddle',
    kickoff: () => 'RIDDLE SETUP — the gauntlet: pose riddles one at a time, varied difficulty, per the rules. I\u2019ll say "call it" when I\u2019m done; then tally and rule the run. First riddle.',
    chips: [
      { label: 'hint', text: '(one hint, please.)' },
      { label: 'call it', text: 'call it — tally my run and rule it.', ends: true },
    ],
  },
  twenty: {
    title: '20 questions', kicker: 'stump the mind', tone: '#C99BE8',
    defaultHost: { key: 'the_brainiac', name: 'the brainiac' },
    intro: 'think of a person, place, or thing. they get twenty yes/no questions to find it.',
    scoreLabel: 'stumped',
    beginLabel: 'i\u2019ve thought of something',
    kickoff: () => 'TWENTY QUESTIONS — I\u2019m thinking of something. Ready. Moderator, count the questions. Guesser — ask.',
    chips: [
      { label: 'yes', text: 'yes.' },
      { label: 'no', text: 'no.' },
      { label: 'sort of', text: 'sort of — partially.' },
      { label: 'call it', text: 'call it — tally the rounds and rule it.', ends: true },
    ],
  },
  wyr: {
    title: 'would you rather', kicker: 'pick one. defend it.', tone: '#F0A765',
    defaultHost: { key: 'the_leader_opp', name: 'the leader of opposition' },
    intro: 'you pick and defend; they champion the other. rounds roll until you call it.',
    scoreLabel: 'rounds',
    beginLabel: 'first one',
    kickoff: () => 'WOULD YOU RATHER — continuous rounds per the rules. Moderator, pose the first one.',
    chips: [
      { label: 'next one', text: 'next one.' },
      { label: 'call it', text: 'call it — totals and the verdict.', ends: true },
    ],
  },
  dilemma: {
    title: 'dilemma zone', kicker: 'no clean answers', tone: '#6FC9E0',
    defaultHost: { key: 'the_philosopher', name: 'the philosopher' },
    intro: 'a hard case, then pressure. hold your reasoning together — or crack.',
    scoreLabel: 'cases held',
    beginLabel: 'pose the first case',
    kickoff: () => 'DILEMMA ZONE — cases, per the rules: pose a hard one, pressure-test my choice until the case is spent, then rule it HELD or CRACKED. First case.',
    chips: [
      { label: 'next case', text: 'next case.' },
      { label: 'call it', text: 'call it — how many cases did I hold?', ends: true },
    ],
  },
};

export default function VerbalMatch({ gameId, opponent, roster, onExit = () => {} }) {
  const G = VERBAL_GAMES[gameId] || VERBAL_GAMES.riddle;
  const host = (Array.isArray(roster) && roster[0]) || opponent || G.defaultHost;
  const tone = host.tone || G.tone;

  const [match, setMatch] = useState(null);
  const [feed, setFeed] = useState([]);
  const [score, setScore] = useState({ you: 0, z: 0 });
  const [result, setResult] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [line, setLine] = useState('');
  const [err, setErr] = useState('');
  const scroll = useRef(null);

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
      onScore: (sc) => setScore((prev) => {
        if ((sc.you || 0) > prev.you) buzz('knock');
        return { you: sc.you || 0, z: sc.z || 0 };
      }),
      onResult: (r) => { setResult(r); buzz(r.winner === 'you' ? 'win' : r.winner === 'z' ? 'lose' : 'knock'); },
      onDone: () => setStreaming(false),
      onError: (m) => { setStreaming(false); setFeed((f) => [...f, { kind: 'chair', text: m, id: Math.random() }]); },
    });
  }, []);

  const begin = async () => {
    if (starting) return;
    setStarting(true); setErr('');
    try {
      const j = await arenaStart({ game: gameId, personaKey: host.key });
      setMatch({ threadId: j.threadId });
      setFeed([]); setScore({ you: 0, z: 0 }); setResult(null);
      buzz('tap');
      send(G.kickoff(), j.threadId, true);
    } catch (e) { setErr(String(e.message || e)); }
    setStarting(false);
  };

  const submit = () => {
    const t = line.trim();
    if (!t || streaming || !match || result) return;
    setLine('');
    send(t, match.threadId);
  };
  const chip = (c) => {
    if (streaming || !match || result) return;
    buzz('tick');
    send(c.text, match.threadId);
  };

  useEffect(() => { scroll.current?.scrollToEnd?.({ animated: true }); }, [feed]);

  // ═══ THE MATCH ═══
  if (match) {
    return (
      <View style={[st.root]}>
        <LinearGradient colors={['#16131C', '#0E0C12', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
        <Grain />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <View style={st.bar}>
              <Pressable hitSlop={12} onPress={() => setMatch(null)}><Text style={st.chev}>‹</Text></Pressable>
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={[st.kicker, { color: tone }]}>{G.kicker}</Text>
                <Text style={st.title}>{G.title}</Text>
              </View>
              <View style={{ alignItems: 'center', marginRight: 10 }}>
                <Text style={[st.scoreN, { color: tone }]}>{score.you}{gameId === 'wyr' || gameId === 'twenty' ? ` – ${score.z}` : ''}</Text>
                <Text style={st.scoreLabel}>{G.scoreLabel}</Text>
              </View>
              <Image source={{ uri: faceFor(host.key) }} style={[st.hostFace, { borderColor: tone }]} />
            </View>

            <ScrollView ref={scroll} style={{ flex: 1 }} contentContainerStyle={st.feed} showsVerticalScrollIndicator={false}>
              {feed.map((b) => {
                if (b.kind === 'chair') return (
                  <View key={b.id} style={st.chairBeat}><Text style={st.chairText}>{b.text}</Text></View>
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
                <View style={[st.resultCard, { borderColor: `${tone}59`, backgroundColor: `${tone}0D` }]}>
                  <Text style={[st.resultKicker, { color: tone }]}>the ruling</Text>
                  <Text style={[st.resultWord, { color: result.winner === 'you' ? '#8FD98F' : result.winner === 'z' ? '#F0708C' : C.accentSoft }]}>
                    {result.winner === 'you' ? 'YOURS' : result.winner === 'z' ? `${host.name.toUpperCase()} TAKES IT` : 'HONOURS EVEN'}
                  </Text>
                  <Text style={st.resultScore}>{score.you} — {score.z}</Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                    <Pressable style={[st.againBtn, { borderColor: `${tone}80`, backgroundColor: `${tone}1A` }]} onPress={() => { setMatch(null); setResult(null); }}>
                      <Text style={[st.againTxt, { color: tone }]}>again</Text>
                    </Pressable>
                    <Pressable style={st.leaveBtn} onPress={onExit}><Text style={st.leaveTxt}>done</Text></Pressable>
                  </View>
                </View>
              )}
              <View style={{ height: 16 }} />
            </ScrollView>

            {!result && (
              <View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chipRow}>
                  {G.chips.map((c) => (
                    <Pressable key={c.label} onPress={() => chip(c)} disabled={streaming}
                      style={[st.chip, { borderColor: `${tone}59` }, streaming && { opacity: 0.35 }]}>
                      <Text style={[st.chipTxt, { color: tone }]}>{c.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={st.composer}>
                  <TextInput
                    value={line} onChangeText={setLine}
                    placeholder={streaming ? '…' : 'your answer…'}
                    placeholderTextColor={C.faint}
                    style={[st.input, streaming && { opacity: 0.5 }]}
                    editable={!streaming}
                    onSubmitEditing={submit} returnKeyType="send"
                  />
                  <Pressable onPress={submit} disabled={streaming || !line.trim()} hitSlop={8}
                    style={[st.sendBtn, { backgroundColor: `${tone}24`, borderColor: `${tone}80` }, (streaming || !line.trim()) && { opacity: 0.35 }]}>
                    <Text style={[st.sendTxt, { color: tone }]}>↑</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // ═══ THE THRESHOLD ═══
  return (
    <View style={st.root}>
      <LinearGradient colors={['#16131C', '#0E0C12', C.ground]} locations={[0, 0.45, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={[st.kicker, { color: tone }]}>{G.kicker}</Text>
            <Text style={st.title}>{G.title}</Text>
          </View>
          <Image source={{ uri: faceFor(host.key) }} style={[st.hostFace, { borderColor: tone }]} />
        </View>
        {err ? <Text style={st.err}>{err}</Text> : null}
        <View style={st.threshold}>
          <Text style={st.introLine}>{G.intro}</Text>
          <Text style={st.hostedBy}>with {host.name}</Text>
          <Pressable style={[st.beginBtn, { borderColor: `${tone}80`, backgroundColor: `${tone}1F` }, starting && { opacity: 0.5 }]} disabled={starting} onPress={begin}>
            <Text style={[st.beginTxt, { color: tone }]}>{starting ? 'setting the table…' : G.beginLabel}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0C12' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 25 },
  hostFace: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#141019' },
  err: { fontFamily: FONTS.body, color: '#F0708C', fontSize: 13, paddingHorizontal: 18, paddingTop: 6 },
  scoreN: { fontFamily: FONTS.display, fontSize: 22, lineHeight: 24 },
  scoreLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },

  threshold: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 34, gap: 14, paddingBottom: 80 },
  introLine: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 17, lineHeight: 25, textAlign: 'center' },
  hostedBy: { fontFamily: FONTS.light, color: C.muted, fontSize: 13 },
  beginBtn: { marginTop: 10, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 16, borderWidth: 1 },
  beginTxt: { fontFamily: FONTS.semibold, fontSize: 15 },

  feed: { paddingHorizontal: 18, paddingTop: 8 },
  chairBeat: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 8 },
  chairText: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.75)', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  hostBeat: { marginVertical: 8, maxWidth: '90%' },
  hostName: { fontFamily: FONTS.semibold, fontSize: 10.5, letterSpacing: 1.8, marginBottom: 3 },
  hostLine: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, lineHeight: 22 },
  youLine: { fontFamily: FONTS.body, color: '#FFE9C7', fontSize: 14.5, lineHeight: 21, textAlign: 'right', marginVertical: 8, alignSelf: 'flex-end', maxWidth: '88%' },
  thinking: { fontFamily: FONTS.display, fontSize: 18, textAlign: 'center', marginVertical: 8 },

  resultCard: { marginVertical: 16, padding: 20, borderRadius: 20, borderWidth: 1, alignItems: 'center' },
  resultKicker: { fontFamily: FONTS.body, fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' },
  resultWord: { fontFamily: FONTS.display, fontSize: 20, marginTop: 8, textAlign: 'center' },
  resultScore: { fontFamily: FONTS.display, color: C.muted, fontSize: 15, marginTop: 4 },
  againBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  againTxt: { fontFamily: FONTS.semibold, fontSize: 13.5 },
  leaveBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },

  chipRow: { paddingHorizontal: 14, gap: 8, paddingBottom: 6 },
  chip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1 },
  chipTxt: { fontFamily: FONTS.medium, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 1 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)', color: C.cream, fontFamily: FONTS.body, fontSize: 14.5, paddingHorizontal: 14, paddingVertical: 11 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  sendTxt: { fontSize: 19 },
});
