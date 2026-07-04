// DuelRoom.js — THE DUEL ROOM (shell / practice-vs-house, mocked).
//
// This is the surface you are INSIDE during a live Battlefield duel. It establishes
// every real state — motion + phase rail, PRO/CON sides, turn-locking (your turn /
// their turn / watching), the transcript, the two media modes (TEXT keystroke-stream +
// VOICE performance), and the adjudicator's verdict — so the room is felt before the
// live duel engine is wired (that is step B). No engine, no external call: a scripted
// practice duel against the house so every state can be walked through on device.
//
// Register: crimson — the arena of argument. Serious, electric, not warm.
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

// ── the scripted practice duel. You are PRO. The house is CON. Three phases, six turns.
const MOTION = 'This house believes economic sanctions do more to entrench regimes than to weaken them.';
const SCRIPT = [
  { phase: 'Opening', side: 'PRO', who: 'you',
    text: "Sanctions hand a regime its perfect alibi. Every shortage, every empty shelf, becomes the enemy's fault — never the government's. The state seizes the black market, controls what little flows in, and rewards loyalists with access. The people grow poorer and more dependent on the very regime the sanctions were meant to topple." },
  { phase: 'Opening', side: 'CON', who: 'house',
    text: "That assumes the regime is a closed box. It is not. Sanctions raise the cost of repression — they starve the patronage networks that keep elites loyal. Apartheid South Africa bent under them. The alibi argument proves too much: by that logic no pressure could ever work, because a determined regime can always blame someone." },
  { phase: 'Rebuttal', side: 'CON', who: 'house',
    text: "PRO points to shortages but never shows the counterfactual — poorer than what? A regime with full oil revenue represses more efficiently, not less. Strip the revenue and you strip the machine." },
  { phase: 'Rebuttal', side: 'PRO', who: 'you',
    text: "South Africa had an internal mass movement and a defecting business class — sanctions were the last ounce on a scale already tipping. Where that internal pressure is absent, sanctions just centralize scarcity in the regime's hands. You've named the exception and called it the rule." },
  { phase: 'Closing', side: 'PRO', who: 'you',
    text: "The mechanism is the whole case: sanctions transfer control of the economy to the state, and control is what an authoritarian craves. You cannot starve a regime that owns the last loaf." },
  { phase: 'Closing', side: 'CON', who: 'house',
    text: "And you cannot buy loyalty with an empty treasury. Sanctions do not need to topple a regime alone — they need only make it weaker and more brittle than it would otherwise be. That, they do." },
];
const PHASES = ['Opening', 'Rebuttal', 'Closing'];

const VERDICT = {
  winner: 'CON',
  summary: "A close, well-matched duel. PRO built a clean causal mechanism — sanctions centralize scarcity, and control is what an autocrat wants. It was the sharper single idea. But CON did the one thing that wins a debate: it forced the counterfactual PRO never answered. \"Poorer than what?\" hung over the floor unanswered, and CON's brittleness framing quietly conceded PRO's point while denying it mattered.",
  matter: "PRO 82 · CON 85. PRO's mechanism was elegant but rested on an unproven premise — that sanctions never bite the machinery of repression. CON's demand for the counterfactual was the decisive move; PRO's South Africa rebuttal was strong but narrowed the claim rather than defending it.",
  manner: "PRO 86 · CON 83. PRO was the more vivid — \"you cannot starve a regime that owns the last loaf\" was the line of the night. CON was steadier and more disciplined, but less quotable.",
  note: "No fabricated evidence on either side; both worked within the contested record honestly.",
};

function Swords({ size = 22, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// ── the phase rail: Opening ● Rebuttal ○ Closing ○ ──
function PhaseRail({ current }) {
  const idx = PHASES.indexOf(current);
  return (
    <View style={styles.rail}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p}>
          <View style={styles.railItem}>
            <View style={[styles.railDot, i <= idx && styles.railDotOn, i === idx && styles.railDotNow]} />
            <Text style={[styles.railTxt, i === idx && styles.railTxtNow]}>{p}</Text>
          </View>
          {i < PHASES.length - 1 ? <View style={[styles.railLine, i < idx && styles.railLineOn]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

// ── a delivered turn in the transcript ──
function TurnBubble({ turn }) {
  const isPro = turn.side === 'PRO';
  const isYou = turn.who === 'you';
  return (
    <View style={[styles.bubbleWrap, isPro ? styles.bubbleLeft : styles.bubbleRight]}>
      <View style={styles.bubbleHead}>
        <View style={[styles.sideTag, { borderColor: isPro ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
          <Text style={[styles.sideTagTxt, { color: isPro ? BLUE : CRIMSON }]}>{turn.side}</Text>
        </View>
        <Text style={styles.bubbleWho}>{isYou ? 'you' : 'the house'} · {turn.phase}</Text>
      </View>
      <View style={[styles.bubble, { borderColor: isPro ? 'rgba(120,200,255,0.18)' : 'rgba(224,87,111,0.2)' }]}>
        <Text style={styles.bubbleTxt}>{turn.text}</Text>
      </View>
    </View>
  );
}

// ── the opponent composing live: keystroke-stream (text) so waiting becomes suspense ──
function OpponentComposing({ turn, onDone }) {
  const [shown, setShown] = useState('');
  useEffect(() => {
    setShown('');
    const words = turn.text.split(/(\s+)/);
    let i = 0; let alive = true;
    const push = () => {
      if (!alive) return;
      if (i >= words.length) { setTimeout(onDone, 900); return; }
      const w = words[i]; i++;
      setShown((s) => s + w);
      const last = (w || '').replace(/\s+$/, '').slice(-1);
      const d = (last === '.' || last === '?' || last === '!') ? 420 : (last === ',' || last === ';' || last === '\u2014') ? 200 : 55;
      setTimeout(push, d);
    };
    push();
    return () => { alive = false; };
  }, [turn]);
  return (
    <View style={[styles.bubbleWrap, styles.bubbleRight]}>
      <View style={styles.bubbleHead}>
        <View style={[styles.sideTag, { borderColor: 'rgba(224,87,111,0.55)' }]}>
          <Text style={[styles.sideTagTxt, { color: CRIMSON }]}>{turn.side}</Text>
        </View>
        <Text style={styles.bubbleWho}>the house is composing · {turn.phase}</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleLive, { borderColor: 'rgba(224,87,111,0.35)' }]}>
        <Text style={styles.bubbleTxt}>{shown}<Text style={styles.caret}>▊</Text></Text>
      </View>
    </View>
  );
}

export default function DuelRoom({ onBack = () => {} }) {
  // step indexes into SCRIPT. 'watching' = opponent composing; 'yours' = your turn;
  // 'reveal' = your delivered turn just landed; 'verdict' = duel over.
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState('text'); // text | voice
  const [draft, setDraft] = useState('');
  const [state, setState] = useState('intro'); // intro | yours | watching | verdict
  const scrollRef = useRef(null);

  const delivered = SCRIPT.slice(0, step);
  const currentTurn = SCRIPT[step];
  const currentPhase = currentTurn ? currentTurn.phase : 'Closing';

  useEffect(() => {
    if (state === 'intro') return;
    if (!currentTurn) { setState('verdict'); return; }
    if (currentTurn.who === 'you') setState('yours');
    else setState('watching');
  }, [step]);

  useEffect(() => { scrollRef.current?.scrollToEnd?.({ animated: true }); }, [delivered.length, state]);

  const begin = () => { setState(SCRIPT[0].who === 'you' ? 'yours' : 'watching'); };
  const advance = () => setStep((s) => s + 1);
  const submitYours = () => { setDraft(''); advance(); };

  // ── the verdict view ──
  if (state === 'verdict') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.topRow}>
            <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
            <Text style={styles.topMotionSm} numberOfLines={1}>the verdict</Text>
            <View style={{ width: 20 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            <View style={styles.vHead}>
              <Text style={styles.vKicker}>THE ADJUDICATOR RULES</Text>
              <Text style={styles.vWinner}>
                <Text style={{ color: VERDICT.winner === 'PRO' ? BLUE : CRIMSON }}>{VERDICT.winner}</Text> takes the floor
              </Text>
              <Text style={styles.vYou}>{VERDICT.winner === 'PRO' ? 'You won.' : 'You argued PRO. The house took it — narrowly.'}</Text>
            </View>
            <Text style={styles.vSummary}>{VERDICT.summary}</Text>

            <View style={styles.vMetric}>
              <Text style={styles.vMetricLabel}>MATTER — logic · evidence · fact</Text>
              <Text style={styles.vMetricBody}>{VERDICT.matter}</Text>
            </View>
            <View style={styles.vMetric}>
              <Text style={styles.vMetricLabel}>MANNER — delivery · structure · control</Text>
              <Text style={styles.vMetricBody}>{VERDICT.manner}</Text>
            </View>
            <View style={styles.vFactNote}>
              <Text style={styles.vFactTxt}>{VERDICT.note}</Text>
            </View>

            {/* the crowd result — the second verdict (mocked) */}
            <View style={styles.crowdCard}>
              <Text style={styles.crowdLabel}>THE ROOM VOTED</Text>
              <View style={styles.crowdBar}>
                <View style={[styles.crowdFill, { flex: 61, backgroundColor: 'rgba(120,200,255,0.6)' }]} />
                <View style={[styles.crowdFill, { flex: 39, backgroundColor: 'rgba(224,87,111,0.6)' }]} />
              </View>
              <View style={styles.crowdRow}>
                <Text style={[styles.crowdPct, { color: BLUE }]}>PRO 61%</Text>
                <Text style={[styles.crowdPct, { color: CRIMSON }]}>39% CON</Text>
              </View>
              <Text style={styles.crowdGap}>The room gave it to you on charisma — the adjudicator gave it to the house on the merits. That gap is the whole point.</Text>
            </View>

            <Pressable style={styles.againBtn} onPress={() => { setStep(0); setState('intro'); }}>
              <Text style={styles.againTxt}>Run it again</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* top: back + motion + practice tag */}
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={styles.practiceTag}><Text style={styles.practiceTxt}>PRACTICE · vs the house</Text></View>
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.motionBar}>
          <Swords size={16} />
          <Text style={styles.motionBarTxt} numberOfLines={3}>{MOTION}</Text>
        </View>
        <PhaseRail current={currentPhase} />

        {/* your assignment */}
        <View style={styles.assignRow}>
          <Text style={styles.assignTxt}>You are </Text>
          <View style={[styles.sideTag, { borderColor: 'rgba(120,200,255,0.5)' }]}><Text style={[styles.sideTagTxt, { color: BLUE }]}>PRO</Text></View>
          <Text style={styles.assignTxt}>  ·  the house is </Text>
          <View style={[styles.sideTag, { borderColor: 'rgba(224,87,111,0.55)' }]}><Text style={[styles.sideTagTxt, { color: CRIMSON }]}>CON</Text></View>
        </View>

        {/* transcript */}
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          {state === 'intro' ? (
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>The floor is set.</Text>
              <Text style={styles.introBody}>You've been assigned PRO. You cannot choose the easy side — arguing the position you're given is the skill. Three phases: Opening, Rebuttal, Closing. Only one of you speaks at a time; the other watches, and so does the room.</Text>
              <Text style={styles.introBody}>This is a practice duel against the house. When it's your turn, make your case. When it's the house's turn, watch it build against you.</Text>
              <Pressable style={styles.beginBtn} onPress={begin}><Text style={styles.beginTxt}>Take the floor</Text></Pressable>
            </View>
          ) : null}

          {delivered.map((t, i) => <TurnBubble key={i} turn={t} />)}

          {state === 'watching' && currentTurn ? (
            <OpponentComposing turn={currentTurn} onDone={advance} />
          ) : null}
        </ScrollView>

        {/* the turn dock — your turn: compose (text) or perform (voice) */}
        {state === 'yours' && currentTurn ? (
          <View style={styles.dock}>
            <View style={styles.dockHead}>
              <Text style={styles.dockTurn}>YOUR TURN · {currentTurn.phase}</Text>
              <View style={styles.modeToggle}>
                <Pressable onPress={() => setMode('text')} style={[styles.modePill, mode === 'text' && styles.modePillOn]}>
                  <Text style={[styles.modePillTxt, mode === 'text' && styles.modePillTxtOn]}>TEXT</Text>
                </Pressable>
                <Pressable onPress={() => setMode('voice')} style={[styles.modePill, mode === 'voice' && styles.modePillOn]}>
                  <Text style={[styles.modePillTxt, mode === 'voice' && styles.modePillTxtOn]}>VOICE</Text>
                </Pressable>
              </View>
            </View>

            {mode === 'text' ? (
              <>
                <View style={styles.streamNote}><Text style={styles.streamNoteTxt}>The room watches you write — every keystroke, live.</Text></View>
                <TextInput
                  style={styles.input}
                  placeholder={currentTurn.phase === 'Closing' ? 'Your closing. No new arguments — land the case you built.' : 'Make your case…'}
                  placeholderTextColor="rgba(245,236,225,0.3)"
                  multiline value={draft} onChangeText={setDraft}
                />
                <View style={styles.dockRow}>
                  <Pressable style={styles.ghostBtn} onPress={() => setDraft(currentTurn.text)}>
                    <Text style={styles.ghostTxt}>use sample</Text>
                  </Pressable>
                  <Pressable style={[styles.sendBtn, !draft.trim() && styles.sendBtnOff]} onPress={submitYours} disabled={!draft.trim()}>
                    <Text style={styles.sendTxt}>Deliver ›</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <VoiceDock phase={currentTurn.phase} onDeliver={submitYours} />
            )}
          </View>
        ) : null}

        {state === 'watching' ? (
          <View style={styles.watchDock}>
            <Text style={styles.watchTxt}>Watching the house compose — you cannot interrupt. This is the case being built against you.</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

// ── the voice performance dock (shell): the premium tier — hear the live voice ──
function VoiceDock({ phase, onDeliver }) {
  const [rec, setRec] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (rec) {
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])).start();
    } else { pulse.stopAnimation(); pulse.setValue(1); }
  }, [rec]);
  return (
    <View style={styles.voiceDock}>
      <View style={styles.premiumTag}><Text style={styles.premiumTxt}>✦ PREMIUM · the room hears your voice</Text></View>
      <Text style={styles.voiceHint}>
        {rec ? "Recording — the room hears you live. Your words are transcribed after the turn, and enter the adjudicator's record." : 'Hold the floor and speak your ' + phase.toLowerCase() + '. No captions — the room is listening.'}
      </Text>
      <View style={styles.voiceRow}>
        <Pressable onPressIn={() => setRec(true)} onPressOut={() => setRec(false)}>
          <Animated.View style={[styles.micOrb, rec && styles.micOrbOn, { transform: [{ scale: pulse }] }]}>
            <Svg width="30" height="30" viewBox="0 0 24 24">
              <Path d="M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3z" stroke={rec ? INK : CREAM} strokeWidth="1.6" fill="none" strokeLinecap="round" />
              <Path d="M6 11v1a6 6 0 0012 0v-1M12 18v3" stroke={rec ? INK : CREAM} strokeWidth="1.6" fill="none" strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </Pressable>
        <Pressable style={styles.sendBtn} onPress={onDeliver}>
          <Text style={styles.sendTxt}>Deliver ›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },
  topMotionSm: { flex: 1, textAlign: 'center', fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 12, letterSpacing: 2 },
  practiceTag: { flex: 1, alignItems: 'center' },
  practiceTxt: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.8)', fontSize: 10, letterSpacing: 2 },

  motionBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 12 },
  motionBarTxt: { flex: 1, fontFamily: FONTS.displayItalic, color: CREAM, fontSize: 15.5, lineHeight: 21 },

  rail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 24 },
  railItem: { alignItems: 'center', gap: 5 },
  railDot: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(245,236,225,0.3)' },
  railDotOn: { backgroundColor: 'rgba(224,87,111,0.5)', borderColor: 'rgba(224,87,111,0.6)' },
  railDotNow: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  railTxt: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.35)', fontSize: 9.5, letterSpacing: 1.5 },
  railTxtNow: { color: CREAM },
  railLine: { width: 40, height: 1, backgroundColor: 'rgba(245,236,225,0.15)', marginHorizontal: 6, marginBottom: 14 },
  railLineOn: { backgroundColor: 'rgba(224,87,111,0.5)' },

  assignRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, flexWrap: 'wrap' },
  assignTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.45)', fontSize: 12.5 },
  sideTag: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 2 },
  sideTagTxt: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 1 },

  introCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.2)', borderRadius: 18, padding: 22, backgroundColor: 'rgba(224,87,111,0.04)', marginTop: 8 },
  introTitle: { fontFamily: FONTS.display, color: CREAM, fontSize: 22 },
  introBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.68)', fontSize: 14.5, lineHeight: 22, marginTop: 12 },
  beginBtn: { marginTop: 20, backgroundColor: CRIMSON, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  beginTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 15, letterSpacing: 0.5 },

  bubbleWrap: { marginVertical: 8, maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingHorizontal: 2 },
  bubbleWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11 },
  bubble: { borderWidth: 1, borderRadius: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.025)' },
  bubbleLive: { backgroundColor: 'rgba(224,87,111,0.06)' },
  bubbleTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.9)', fontSize: 14.5, lineHeight: 21 },
  caret: { color: CRIMSON, fontFamily: FONTS.body },

  dock: { borderTopWidth: 1, borderTopColor: 'rgba(224,87,111,0.2)', backgroundColor: 'rgba(20,7,12,0.7)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  dockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  dockTurn: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 11, letterSpacing: 2 },
  modeToggle: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: 2, gap: 2 },
  modePill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 7 },
  modePillOn: { backgroundColor: 'rgba(224,87,111,0.25)' },
  modePillTxt: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.45)', fontSize: 10.5, letterSpacing: 1 },
  modePillTxtOn: { color: CREAM },

  streamNote: { marginBottom: 8 },
  streamNoteTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11.5, fontStyle: 'italic' },
  input: { fontFamily: FONTS.light, color: CREAM, fontSize: 15, lineHeight: 22, minHeight: 70, maxHeight: 150, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 12, textAlignVertical: 'top' },
  dockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  ghostBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  ghostTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 12.5, textDecorationLine: 'underline' },
  sendBtn: { backgroundColor: CRIMSON, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 22 },
  sendBtnOff: { backgroundColor: 'rgba(224,87,111,0.3)' },
  sendTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 14 },

  watchDock: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 24, paddingVertical: 16 },
  watchTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.5)', fontSize: 13.5, lineHeight: 20, textAlign: 'center' },

  voiceDock: { alignItems: 'center', paddingTop: 4 },
  premiumTag: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.4)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 10 },
  premiumTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 10, letterSpacing: 1 },
  voiceHint: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 14, paddingHorizontal: 10 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 6 },
  micOrb: { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: 'rgba(245,236,225,0.4)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  micOrbOn: { backgroundColor: CRIMSON, borderColor: CRIMSON },

  // verdict
  vHead: { alignItems: 'center', marginBottom: 20 },
  vKicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  vWinner: { fontFamily: FONTS.display, color: CREAM, fontSize: 30, marginTop: 12 },
  vYou: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 14, marginTop: 8 },
  vSummary: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.85)', fontSize: 15.5, lineHeight: 24 },
  vMetric: { marginTop: 22, borderLeftWidth: 2, borderLeftColor: 'rgba(224,87,111,0.4)', paddingLeft: 14 },
  vMetricLabel: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 10.5, letterSpacing: 1.5 },
  vMetricBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  vFactNote: { marginTop: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 },
  vFactTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 12.5, lineHeight: 18, fontStyle: 'italic' },

  crowdCard: { marginTop: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 18 },
  crowdLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 10.5, letterSpacing: 2 },
  crowdBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 12, gap: 2 },
  crowdFill: { height: 10, borderRadius: 3 },
  crowdRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  crowdPct: { fontFamily: FONTS.semibold, fontSize: 13 },
  crowdGap: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 13.5, lineHeight: 20, marginTop: 12 },

  againBtn: { marginTop: 28, borderWidth: 1, borderColor: 'rgba(224,87,111,0.5)', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  againTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 14 },
});
