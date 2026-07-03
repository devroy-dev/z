// yourZ — TRIVIA DUEL LIVE: human v human over the sessions layer, the house
// asking. Server owns questions and truth (correct answers never arrive
// before the reveal); this renders the filtered view. First answerer
// alternates each question, so answering second confers nothing.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz } from '../common';
import { useLiveSession, seatLabelFn } from '../liveCommon';

const UP = '#8FD98F';
const DOWN = '#F0708C';

export default function TriviaDuelLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const g = view?.state;
  const me = view?.mySeat ?? -1;
  const first = g ? g.qi % 2 : 0;
  const myTurn = g && g.phase === 'answer' && g.question && g.myPick == null && (first === me || g.oppAnswered);

  return (
    <View style={st.root}>
      <LinearGradient colors={['#120F16', '#0C0A10', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>{g ? `trivia duel · ${g.topic} · q${Math.min(g.qi + 1, g.total)}/${g.total}` : 'trivia duel'}</Text>
          <View style={{ width: 26 }} />
        </View>

        {g ? (
          <View style={st.scoreRow}>
            <Text style={[st.score, me === 0 && { color: C.ember }]}>{label(0)}  {g.scores[0]}</Text>
            <Text style={st.scoreDot}>·</Text>
            <Text style={[st.score, me === 1 && { color: C.ember }]}>{g.scores[1]}  {label(1)}</Text>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 30 }}>
          {!g ? (
            <Text style={st.wait}>taking your seat…</Text>
          ) : g.phase === 'over' ? (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>
                {g.winner === 'draw' ? 'DEAD LEVEL — A DRAW'
                  : g.winner === me ? `YOU TAKE IT ${g.scores[me]}–${g.scores[1 - me]}`
                  : `${label(g.winner).toUpperCase()} TAKES IT ${g.scores[g.winner]}–${g.scores[1 - g.winner]}`}
              </Text>
              <Text style={st.bannerSub}>on the record — both ledgers.</Text>
              <Pressable style={st.btn} onPress={onExit}><Text style={st.btnTxt}>back to the room</Text></Pressable>
            </View>
          ) : g.phase === 'reveal' && g.lastResult ? (
            <>
              <Text style={st.q}>{g.lastResult.q}</Text>
              {g.lastResult.opts.map((o, i) => {
                const right = i === g.lastResult.correct;
                const mine = g.lastResult.picks[me] === i;
                const who = [0, 1].filter((s2) => g.lastResult.picks[s2] === i).map((s2) => label(s2)).join(', ');
                return (
                  <View key={i} style={[st.opt, right && st.optRight, mine && !right && st.optWrong, mine && st.optMine]}>
                    <Text style={st.optTxt}>{o}{who ? <Text style={st.optWho}>  — {who}</Text> : null}</Text>
                  </View>
                );
              })}
              <Pressable style={[st.btn, { alignSelf: 'center', marginTop: 14 }]} onPress={() => { move({ type: 'next' }); buzz('tap'); }}>
                <Text style={st.btnTxt}>next question</Text>
              </Pressable>
            </>
          ) : myTurn ? (
            <>
              <Text style={st.q}>{g.question.q}</Text>
              {g.question.opts.map((o, i) => (
                <Pressable key={i} style={st.opt} onPress={() => { move({ type: 'answer', pick: i }); buzz('tap'); }}>
                  <Text style={st.optTxt}>{o}</Text>
                </Pressable>
              ))}
            </>
          ) : g.myPick != null ? (
            <>
              {g.question ? <Text style={st.q}>{g.question.q}</Text> : null}
              <Text style={st.wait}>answer locked — waiting on {label(1 - me)}…</Text>
            </>
          ) : (
            <Text style={st.wait}>{label(1 - me)} answers first this one…</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0A0E' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#F3A85F', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.85, flex: 1, textAlign: 'center' },
  scoreRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 14, paddingVertical: 8 },
  score: { fontFamily: FONTS.display, color: C.cream, fontSize: 19 },
  scoreDot: { color: C.faint, fontSize: 16 },
  q: { fontFamily: FONTS.display, color: C.cream, fontSize: 19, lineHeight: 27, textAlign: 'center', marginBottom: 16 },
  opt: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', backgroundColor: 'rgba(255,255,255,0.04)', paddingVertical: 13, paddingHorizontal: 15, marginBottom: 9 },
  optRight: { borderColor: UP, backgroundColor: 'rgba(143,217,143,0.12)' },
  optWrong: { borderColor: DOWN, backgroundColor: 'rgba(240,112,140,0.10)' },
  optMine: { shadowColor: C.ember, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 },
  optTxt: { fontFamily: FONTS.medium, color: C.cream, fontSize: 14.5, lineHeight: 20 },
  optWho: { fontFamily: FONTS.light, color: C.faint, fontSize: 12 },
  wait: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14.5, textAlign: 'center', marginTop: 10 },
  banner: { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(240,167,101,0.4)', backgroundColor: 'rgba(0,0,0,0.35)', padding: 18, alignItems: 'center' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, textAlign: 'center' },
  bannerSub: { fontFamily: FONTS.light, color: C.faint, fontSize: 12, marginTop: 6 },
  btn: { marginTop: 12, paddingVertical: 11, paddingHorizontal: 20, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,167,101,0.5)', backgroundColor: 'rgba(240,167,101,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 13.5 },
});
