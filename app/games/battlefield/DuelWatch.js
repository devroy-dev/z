// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE BATTLEFIELD, WATCHED. The spectator's view of a live duel.
//  Subscribes to the debater's live keystroke stream (the "watch them write it"
//  drama) AND polls the committed transcript + verdict. Works on a human-vs-AI
//  practice duel: you watch the human compose in real time, the house's turns
//  arrive as delivered speeches, the adjudicator's running notes appear, and the
//  final Matter/Manner verdict lands. Spectators can VOTE (people's choice).
//
//  Register: crimson — the arena, watched from the stands.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from '../../theme';
import { watchBattlefieldDuel } from '../../api';
import { subscribeDuelKeys, unsubscribeDuel } from '../../realtime';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';
const PHASES = ['Opening', 'Rebuttal', 'Closing'];

function Swords({ size = 18, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function PhaseRail({ current }) {
  const idx = PHASES.indexOf(current);
  return (
    <View style={st.rail}>
      {PHASES.map((p, i) => (
        <React.Fragment key={p}>
          <View style={st.railItem}>
            <View style={[st.railDot, i <= idx && st.railDotOn, i === idx && st.railDotNow]} />
            <Text style={[st.railTxt, i === idx && st.railTxtNow]}>{p}</Text>
          </View>
          {i < PHASES.length - 1 ? <View style={[st.railLine, i < idx && st.railLineOn]} /> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function TurnBubble({ turn }) {
  const isPro = turn.seat === 0;
  return (
    <View style={[st.bubbleWrap, isPro ? st.bubbleLeft : st.bubbleRight]}>
      <View style={st.bubbleHead}>
        <View style={[st.sideTag, { borderColor: isPro ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
          <Text style={[st.sideTagTxt, { color: isPro ? BLUE : CRIMSON }]}>{isPro ? 'PRO' : 'CON'}</Text>
        </View>
        <Text style={st.bubbleWho}>{turn.seat === 0 ? 'the challenger' : 'the house'} · {turn.role}</Text>
      </View>
      <View style={[st.bubble, { borderColor: isPro ? 'rgba(120,200,255,0.18)' : 'rgba(224,87,111,0.2)' }]}>
        <Text style={st.bubbleTxt}>{turn.text}</Text>
      </View>
    </View>
  );
}

export default function BattlefieldDuelWatch({ sessionId, onBack = () => {} }) {
  const [duel, setDuel] = useState(null);
  const [liveKeys, setLiveKeys] = useState(null);   // { seat, phase, text, done } — the debater composing now
  const [vote, setVote] = useState(null);
  const scrollRef = useRef(null);
  const pollRef = useRef(null);

  // poll the committed transcript + verdict
  useEffect(() => {
    let on = true;
    const pull = async () => {
      try { const d = await watchBattlefieldDuel(sessionId); if (on && d) setDuel(d); } catch (e) {}
    };
    pull();
    pollRef.current = setInterval(pull, 1500);
    return () => { on = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [sessionId]);

  // subscribe to the live keystroke stream once we know the thread
  useEffect(() => {
    if (!duel?.threadId) return;
    let unsub = () => {};
    (async () => {
      unsub = await subscribeDuelKeys(duel.threadId, (k) => {
        // a 'done' frame clears the live-typing surface (the turn was committed)
        setLiveKeys(k?.done ? null : k);
      });
    })();
    return () => { try { unsub(); } catch (e) {} unsubscribeDuel(); };
  }, [duel?.threadId]);

  useEffect(() => { scrollRef.current?.scrollToEnd?.({ animated: true }); }, [duel?.turns?.length, liveKeys?.text, duel?.phase]);

  const phase = duel?.phase || 'Opening';
  const isVerdict = phase === 'verdict';
  const turns = duel?.turns || [];
  const notes = duel?.notes || [];
  const v = duel?.verdict;

  // the live typing bubble — only show while a debater is mid-composition and the
  // text isn't already committed as a turn
  const showLive = liveKeys && liveKeys.text && !isVerdict;

  return (
    <View style={st.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <View style={st.liveTag}>
            <View style={st.liveDot} />
            <Text style={st.liveTxt}>{isVerdict ? 'ENDED' : 'LIVE'} · WATCHING</Text>
          </View>
          <View style={{ width: 20 }} />
        </View>

        <View style={st.motionBar}>
          <Swords size={16} />
          <Text style={st.motionBarTxt}>{duel?.motion ? `"${duel.motion}"` : 'finding the duel…'}</Text>
        </View>

        <PhaseRail current={isVerdict ? 'Closing' : phase} />

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
          {turns.map((t, i) => <TurnBubble key={i} turn={t} />)}

          {/* the live-typing surface — the human composing, streamed keystroke-by-keystroke */}
          {showLive ? (
            <View style={[st.bubbleWrap, liveKeys.seat === 0 ? st.bubbleLeft : st.bubbleRight]}>
              <View style={st.bubbleHead}>
                <View style={[st.sideTag, { borderColor: liveKeys.seat === 0 ? 'rgba(120,200,255,0.5)' : 'rgba(224,87,111,0.55)' }]}>
                  <Text style={[st.sideTagTxt, { color: liveKeys.seat === 0 ? BLUE : CRIMSON }]}>{liveKeys.seat === 0 ? 'PRO' : 'CON'}</Text>
                </View>
                <Text style={st.bubbleWho}>composing live · {liveKeys.phase}</Text>
              </View>
              <View style={[st.bubble, st.bubbleLive, { borderColor: liveKeys.seat === 0 ? 'rgba(120,200,255,0.35)' : 'rgba(224,87,111,0.35)' }]}>
                <Text style={st.bubbleTxt}>{liveKeys.text}<Text style={st.caret}>▊</Text></Text>
              </View>
            </View>
          ) : null}

          {notes.map((n, i) => (
            <View key={`note-${i}`} style={st.noteCard}>
              <Text style={st.noteLabel}>THE ADJUDICATOR · after {n.phase}</Text>
              <Text style={st.noteTxt}>{n.note}</Text>
            </View>
          ))}

          {/* verdict */}
          {isVerdict && v ? (
            <View style={st.verdictWrap}>
              <Text style={st.vKicker}>THE ADJUDICATOR RULES</Text>
              <Text style={st.vWinner}><Text style={{ color: duel.winner === 'PRO' ? BLUE : CRIMSON }}>{duel.winner}</Text> takes the floor</Text>
              <Text style={st.vSummary}>{v.summary}</Text>
              {!!v.matter && (<View style={st.vMetric}><Text style={st.vMetricLabel}>MATTER</Text><Text style={st.vMetricBody}>{v.matter}</Text></View>)}
              {!!v.manner && (<View style={st.vMetric}><Text style={st.vMetricLabel}>MANNER</Text><Text style={st.vMetricBody}>{v.manner}</Text></View>)}
              {vote ? (
                <View style={st.crowdCard}>
                  <Text style={st.crowdLabel}>YOUR VOTE</Text>
                  <Text style={st.crowdVote}>You called it for <Text style={{ color: vote === 'PRO' ? BLUE : CRIMSON }}>{vote}</Text>.
                    {vote === duel.winner ? ' You and the adjudicator agree.' : ' The adjudicator saw it differently — that gap is the debate.'}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {/* the vote dock — spectators vote (people's choice) */}
        {!isVerdict ? (
          <View style={st.voteDock}>
            <Text style={st.voteLabel}>{vote ? 'your vote is in — change it any time' : 'who is winning? cast your vote'}</Text>
            <View style={st.voteRow}>
              <Pressable style={[st.voteBtn, vote === 'PRO' && st.voteBtnProOn]} onPress={() => setVote('PRO')}>
                <Text style={[st.voteBtnTxt, vote === 'PRO' && { color: INK }]}>the challenger · PRO</Text>
              </Pressable>
              <Pressable style={[st.voteBtn, vote === 'CON' && st.voteBtnConOn]} onPress={() => setVote('CON')}>
                <Text style={[st.voteBtnTxt, vote === 'CON' && { color: INK }]}>the house · CON</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },
  liveTag: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CRIMSON },
  liveTxt: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 10.5, letterSpacing: 2 },

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

  bubbleWrap: { marginVertical: 8, maxWidth: '92%' },
  bubbleLeft: { alignSelf: 'flex-start' },
  bubbleRight: { alignSelf: 'flex-end' },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, paddingHorizontal: 2 },
  bubbleWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11 },
  bubble: { borderWidth: 1, borderRadius: 16, padding: 14, backgroundColor: 'rgba(255,255,255,0.025)' },
  bubbleLive: { backgroundColor: 'rgba(224,87,111,0.06)' },
  bubbleTxt: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.9)', fontSize: 14.5, lineHeight: 21 },
  caret: { color: CRIMSON, fontFamily: FONTS.body },

  noteCard: { alignSelf: 'center', maxWidth: '94%', marginVertical: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.3)', backgroundColor: 'rgba(240,167,101,0.05)' },
  noteLabel: { fontFamily: FONTS.semibold, color: '#F0A765', fontSize: 9.5, letterSpacing: 1.5, marginBottom: 5 },
  noteTxt: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.75)', fontSize: 13, lineHeight: 19 },

  verdictWrap: { marginTop: 18, alignItems: 'center', paddingHorizontal: 8 },
  vKicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  vWinner: { fontFamily: FONTS.display, color: CREAM, fontSize: 26, marginTop: 10, marginBottom: 12 },
  vSummary: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.85)', fontSize: 15, lineHeight: 23 },
  vMetric: { marginTop: 18, borderLeftWidth: 2, borderLeftColor: 'rgba(224,87,111,0.4)', paddingLeft: 14, alignSelf: 'stretch' },
  vMetricLabel: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 10.5, letterSpacing: 1.5 },
  vMetricBody: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  crowdCard: { marginTop: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, alignSelf: 'stretch' },
  crowdLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.5)', fontSize: 10.5, letterSpacing: 2 },
  crowdVote: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.8)', fontSize: 14, lineHeight: 21, marginTop: 8 },

  voteDock: { borderTopWidth: 1, borderTopColor: 'rgba(224,87,111,0.2)', backgroundColor: 'rgba(20,7,12,0.7)', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  voteLabel: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  voteRow: { flexDirection: 'row', gap: 10 },
  voteBtn: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 11, paddingVertical: 11, alignItems: 'center' },
  voteBtnProOn: { backgroundColor: BLUE, borderColor: BLUE },
  voteBtnConOn: { backgroundColor: CRIMSON, borderColor: CRIMSON },
  voteBtnTxt: { fontFamily: FONTS.semibold, color: CREAM, fontSize: 13 },
});
