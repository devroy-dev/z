// Gallery.js — THE GALLERY (spectator view of a live duel, shell / mocked).
//
// What a WATCHER sees: the live duel streaming in (read-only — spectators watch, they
// do not debate), a live crowd VOTE, the "green room" chat where registered users react
// (debaters cannot see it), and at the end the TWO RESULTS — the adjudicator's verdict
// and the crowd's vote, shown side by side, their gap featured. One scrolling surface,
// the way you'd actually watch. No engine yet: a scripted live-watch so every state is
// felt. Step B wires this + the Duel Room to the same live event at once.
//
// This is the growth surface: the ungated watch-link opens straight here.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { FONTS } from './theme';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

const MOTION = 'This house believes economic sanctions do more to entrench regimes than to weaken them.';
const PHASES = ['Opening', 'Rebuttal', 'Closing'];

// the duel being watched — two named debaters (spectators see names, not "you/house")
const STREAM = [
  { phase: 'Opening', side: 'PRO', name: 'Aarav', text: "Sanctions hand a regime its perfect alibi. Every empty shelf becomes the enemy's fault — never the government's. The state seizes the black market and rewards loyalists with access. The people grow poorer and more dependent on the very regime the sanctions meant to topple." },
  { phase: 'Opening', side: 'CON', name: 'Meera', text: "That assumes the regime is a closed box. Sanctions raise the cost of repression — they starve the patronage networks that keep elites loyal. Apartheid South Africa bent under them. The alibi argument proves too much: by that logic no pressure could ever work." },
  { phase: 'Rebuttal', side: 'CON', name: 'Meera', text: "Aarav points to shortages but never shows the counterfactual — poorer than what? A regime with full oil revenue represses more efficiently, not less. Strip the revenue and you strip the machine." },
  { phase: 'Rebuttal', side: 'PRO', name: 'Aarav', text: "South Africa had an internal mass movement and a defecting business class — sanctions were the last ounce on a scale already tipping. Where that pressure is absent, sanctions just centralize scarcity in the regime's hands. You named the exception and called it the rule." },
  { phase: 'Closing', side: 'PRO', name: 'Aarav', text: "The mechanism is the whole case: sanctions transfer control of the economy to the state, and control is what an authoritarian craves. You cannot starve a regime that owns the last loaf." },
  { phase: 'Closing', side: 'CON', name: 'Meera', text: "And you cannot buy loyalty with an empty treasury. Sanctions need not topple a regime alone — only make it weaker and more brittle than it would otherwise be. That, they do." },
];

// the green-room chat — registered users reacting live (mocked, streams alongside)
const CHAT = [
  { at: 1, name: 'rhea', text: 'aarav opening strong ngl' },
  { at: 2, name: 'devjroy', text: 'the alibi point is real though' },
  { at: 3, name: 'sam_k', text: 'meera with the south africa counter 🔥' },
  { at: 4, name: 'nnn', text: '"poorer than what" oof' },
  { at: 5, name: 'rhea', text: 'ok aarav recovered with the "last ounce" line' },
  { at: 6, name: 'devjroy', text: 'last loaf line is going to win the crowd' },
  { at: 7, name: 'sam_k', text: 'but did he answer the counterfactual? no he didnt' },
  { at: 8, name: 'nnn', text: 'this is actually close' },
];

const VERDICT = {
  winner: 'CON', winnerName: 'Meera',
  summary: "A close, well-matched duel. Aarav built the sharper single idea — sanctions centralize scarcity, and control is what an autocrat wants. But Meera did the one thing that wins a debate: she forced the counterfactual Aarav never answered. \"Poorer than what?\" hung over the floor unanswered.",
  matter: 'Aarav 82 · Meera 85',
  manner: 'Aarav 86 · Meera 83',
};

function Swords({ size = 16, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StreamLine({ turn, live }) {
  const isPro = turn.side === 'PRO';
  const [shown, setShown] = useState(live ? '' : turn.text);
  useEffect(() => {
    if (!live) { setShown(turn.text); return; }
    // word-by-word reveal, like Z's chat — slow enough to WATCH the argument get built
    const words = turn.text.split(/(\s+)/);
    let i = 0; let alive = true;
    const push = () => {
      if (!alive || i >= words.length) return;
      const w = words[i]; i++;
      setShown((s) => s + w);
      const last = (w || '').replace(/\s+$/, '').slice(-1);
      const d = (last === '.' || last === '?' || last === '!') ? 420 : (last === ',' || last === ';' || last === '\u2014') ? 200 : 55;
      setTimeout(push, d);
    };
    push();
    return () => { alive = false; };
  }, [turn, live]);
  return (
    <View style={[styles.lineWrap, isPro ? styles.lineLeft : styles.lineRight]}>
      <View style={styles.lineHead}>
        <View style={[styles.sideTag, { borderColor: isPro ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
          <Text style={[styles.sideTagTxt, { color: isPro ? BLUE : CRIMSON }]}>{turn.side}</Text>
        </View>
        <Text style={styles.lineWho}>{turn.name} · {turn.phase}</Text>
      </View>
      <View style={[styles.lineBubble, { borderColor: isPro ? 'rgba(120,200,255,0.18)' : 'rgba(224,87,111,0.2)' }]}>
        <Text style={styles.lineTxt}>{shown}{live && shown.length < turn.text.length ? <Text style={styles.caret}>▊</Text> : null}</Text>
      </View>
    </View>
  );
}

export default function Gallery({ onBack = () => {} }) {
  const [shown, setShown] = useState(1);        // how many stream turns revealed
  const [chatShown, setChatShown] = useState(2);
  const [vote, setVote] = useState(null);        // 'PRO' | 'CON' | null
  const [ended, setEnded] = useState(false);
  const streamRef = useRef(null);
  const chatRef = useRef(null);

  // auto-advance: wait for the current turn to finish typing (word-by-word) + a beat,
  // so each argument is watched being built, not popped in whole.
  useEffect(() => {
    if (shown >= STREAM.length) { const t = setTimeout(() => setEnded(true), 1600); return () => clearTimeout(t); }
    const t = STREAM[shown - 1];
    const words = t.text.split(/(\s+)/).length;
    const typeMs = words * 60 + (t.text.match(/[.?!]/g) || []).length * 380; // rough type duration
    const id = setTimeout(() => setShown((s) => s + 1), typeMs + 1400);
    return () => clearTimeout(id);
  }, [shown]);

  useEffect(() => {
    if (chatShown >= CHAT.length) return;
    const t = setTimeout(() => setChatShown((c) => c + 1), 1900);
    return () => clearTimeout(t);
  }, [chatShown]);

  useEffect(() => { streamRef.current?.scrollToEnd?.({ animated: true }); }, [shown]);
  useEffect(() => { chatRef.current?.scrollToEnd?.({ animated: true }); }, [chatShown]);

  const turns = STREAM.slice(0, shown);
  const chat = CHAT.slice(0, chatShown);
  const currentPhase = turns.length ? turns[turns.length - 1].phase : 'Opening';

  // mocked live tally — shifts a touch when you vote
  const proBase = 61, conBase = 39;
  const pro = vote === 'PRO' ? proBase + 1 : proBase;
  const con = 100 - pro;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#160910', '#100710', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* top: back + LIVE + watching count */}
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={styles.liveWrap}>
            {!ended ? <View style={styles.liveDot} /> : null}
            <Text style={styles.liveTxt}>{ended ? 'ENDED' : 'LIVE'}</Text>
          </View>
          <Text style={styles.watchCount}>· 214 watching</Text>
          <View style={{ flex: 1 }} />
        </View>

        {/* motion + who's debating */}
        <View style={styles.motionBar}>
          <Swords size={15} />
          <Text style={styles.motionTxt} numberOfLines={3}>{MOTION}</Text>
        </View>
        <View style={styles.debatersRow}>
          <Text style={[styles.debaterName, { color: BLUE }]}>Aarav</Text>
          <Text style={styles.debaterSide}>PRO</Text>
          <Text style={styles.vs}>vs</Text>
          <Text style={styles.debaterSide}>CON</Text>
          <Text style={[styles.debaterName, { color: CRIMSON }]}>Meera</Text>
        </View>

        {/* the stream (read-only — spectators watch) */}
        <ScrollView ref={streamRef} style={styles.stream} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
          {turns.map((t, i) => <StreamLine key={i} turn={t} live={i === turns.length - 1 && !ended} />)}
          {!ended && shown < STREAM.length ? (
            <Text style={styles.streamingNote}>{currentPhase} · the floor is live…</Text>
          ) : null}

          {ended ? (
            <View style={styles.resultsBlock}>
              <Text style={styles.resultsKicker}>TWO VERDICTS</Text>

              <View style={styles.vCard}>
                <Text style={styles.vCardLabel}>THE ADJUDICATOR — on the merits</Text>
                <Text style={styles.vWinner}><Text style={{ color: CRIMSON }}>Meera (CON)</Text> takes the floor</Text>
                <Text style={styles.vSummary}>{VERDICT.summary}</Text>
                <View style={styles.vScores}>
                  <Text style={styles.vScore}>MATTER  {VERDICT.matter}</Text>
                  <Text style={styles.vScore}>MANNER  {VERDICT.manner}</Text>
                </View>
              </View>

              <View style={styles.vCard}>
                <Text style={styles.vCardLabel}>THE ROOM — people's choice</Text>
                <View style={styles.crowdBar}>
                  <View style={{ flex: pro, backgroundColor: 'rgba(120,200,255,0.6)', height: 10, borderRadius: 3 }} />
                  <View style={{ flex: con, backgroundColor: 'rgba(224,87,111,0.6)', height: 10, borderRadius: 3 }} />
                </View>
                <View style={styles.crowdRow}>
                  <Text style={[styles.crowdPct, { color: BLUE }]}>Aarav (PRO) {pro}%</Text>
                  <Text style={[styles.crowdPct, { color: CRIMSON }]}>{con}% Meera</Text>
                </View>
              </View>

              <Text style={styles.gapLine}>The room gave it to Aarav on charisma — the last-loaf line landed. The adjudicator gave it to Meera on the merits. That gap is the whole point.</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* the vote — spectators can ONLY vote (no comments) */}
        {!ended ? (
          <View style={styles.voteDock}>
            <Text style={styles.voteLabel}>{vote ? 'Your vote is in — you can change it any time.' : 'Who is winning? Cast your vote.'}</Text>
            <View style={styles.voteRow}>
              <Pressable style={[styles.voteBtn, vote === 'PRO' && styles.voteBtnPro]} onPress={() => setVote('PRO')}>
                <Text style={[styles.voteTxt, vote === 'PRO' && { color: INK }]}>Aarav · PRO</Text>
              </Pressable>
              <Pressable style={[styles.voteBtn, vote === 'CON' && styles.voteBtnCon]} onPress={() => setVote('CON')}>
                <Text style={[styles.voteTxt, vote === 'CON' && { color: INK }]}>Meera · CON</Text>
              </Pressable>
            </View>
            {/* live tally peek */}
            <View style={styles.tallyBar}>
              <View style={{ flex: pro, backgroundColor: 'rgba(120,200,255,0.45)', height: 4 }} />
              <View style={{ flex: con, backgroundColor: 'rgba(224,87,111,0.45)', height: 4 }} />
            </View>
          </View>
        ) : null}

        {/* the green room — registered users react; debaters cannot see this */}
        <View style={styles.greenRoom}>
          <View style={styles.greenHead}>
            <Text style={styles.greenLabel}>THE GREEN ROOM</Text>
            <Text style={styles.greenSub}>registered only · debaters can't see this</Text>
          </View>
          <ScrollView ref={chatRef} style={styles.chatScroll} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 6 }} showsVerticalScrollIndicator={false}>
            {chat.map((c, i) => (
              <Text key={i} style={styles.chatLine}><Text style={styles.chatName}>{c.name}</Text>  {c.text}</Text>
            ))}
          </ScrollView>
          <View style={styles.chatInputRow}>
            <TextInput style={styles.chatInput} placeholder="react to the duel…" placeholderTextColor="rgba(245,236,225,0.3)" editable={false} />
            <View style={styles.chatSend}><Text style={styles.chatSendTxt}>›</Text></View>
          </View>
          <Text style={styles.registerNudge}>Watching free. Register to join the green room and vote in tournaments.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 42, gap: 8 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },
  liveWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CRIMSON },
  liveTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 11, letterSpacing: 2 },
  watchCount: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11.5 },

  motionBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingHorizontal: 22, paddingTop: 4, paddingBottom: 8 },
  motionTxt: { flex: 1, fontFamily: FONTS.displayItalic, color: CREAM, fontSize: 14.5, lineHeight: 20 },
  debatersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 8 },
  debaterName: { fontFamily: FONTS.semibold, fontSize: 14 },
  debaterSide: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.45)', fontSize: 10, letterSpacing: 1 },
  vs: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.35)', fontSize: 13, marginHorizontal: 2 },

  stream: { flex: 1, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  streamingNote: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.7)', fontSize: 12.5, textAlign: 'center', marginTop: 10 },

  lineWrap: { marginVertical: 7, maxWidth: '92%' },
  lineLeft: { alignSelf: 'flex-start' },
  lineRight: { alignSelf: 'flex-end' },
  lineHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 4, paddingHorizontal: 2 },
  sideTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  sideTagTxt: { fontFamily: FONTS.semibold, fontSize: 10, letterSpacing: 1 },
  lineWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 10.5 },
  lineBubble: { borderWidth: 1, borderRadius: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.025)' },
  lineTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.88)', fontSize: 13.5, lineHeight: 20 },
  caret: { color: CRIMSON, fontFamily: FONTS.body },

  resultsBlock: { marginTop: 16, paddingTop: 4 },
  resultsKicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3, textAlign: 'center', marginBottom: 14 },
  vCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 12 },
  vCardLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 10, letterSpacing: 1.5 },
  vWinner: { fontFamily: FONTS.display, color: CREAM, fontSize: 20, marginTop: 8 },
  vSummary: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.8)', fontSize: 14, lineHeight: 21, marginTop: 10 },
  vScores: { flexDirection: 'row', gap: 18, marginTop: 12 },
  vScore: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.55)', fontSize: 12 },
  crowdBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 12, gap: 2 },
  crowdRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  crowdPct: { fontFamily: FONTS.semibold, fontSize: 12.5 },
  gapLine: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 14, lineHeight: 21, marginTop: 6, marginBottom: 10, textAlign: 'center' },

  voteDock: { paddingHorizontal: 18, paddingVertical: 10, borderTopWidth: 1, borderTopColor: 'rgba(224,87,111,0.18)', backgroundColor: 'rgba(22,9,16,0.6)' },
  voteLabel: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.55)', fontSize: 12, textAlign: 'center', marginBottom: 8 },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 11, paddingVertical: 10, alignItems: 'center' },
  voteBtnPro: { backgroundColor: BLUE, borderColor: BLUE },
  voteBtnCon: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  voteTxt: { fontFamily: FONTS.semibold, color: CREAM, fontSize: 13 },
  tallyBar: { flexDirection: 'row', height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10, gap: 1 },

  greenRoom: { height: 190, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.25)' },
  greenHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  greenLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 10, letterSpacing: 2 },
  greenSub: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.32)', fontSize: 10.5 },
  chatScroll: { flex: 1 },
  chatLine: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.78)', fontSize: 13, lineHeight: 20, marginVertical: 1 },
  chatName: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.85)', fontSize: 13 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  chatInput: { flex: 1, fontFamily: FONTS.body, color: CREAM, fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  chatSend: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(224,87,111,0.2)', alignItems: 'center', justifyContent: 'center' },
  chatSendTxt: { fontFamily: FONTS.display, color: CRIMSON, fontSize: 18, marginTop: -2 },
  registerNudge: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.38)', fontSize: 11, textAlign: 'center', paddingBottom: 6, paddingHorizontal: 14 },
});
