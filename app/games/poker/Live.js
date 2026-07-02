// yourZ — HOLD'EM LIVE: the continuous multiplayer table. Server deals,
// enforces, and hides (deck + holes never arrive); this renders and asks.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz, faceFor } from '../common';
import { useLiveSession, seatLabelFn, seatFace } from '../liveCommon';

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_TONE = ['#E9E4DA', '#F0708C', '#F0A765', '#8FD98F'];
const rankName = (r) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));

function PCard({ c, hidden, small }) {
  const [w, h, rf, sf] = small ? [26, 37, 12, 10] : [44, 62, 17, 14];
  if (hidden || !c) return <View style={[st.card, { width: w, height: h }, st.back]}>{!small && <Text style={st.backG}>✦</Text>}</View>;
  return (
    <View style={[st.card, { width: w, height: h }]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{rankName(c.r)}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_GLYPH[c.s]}</Text>
    </View>
  );
}

export default function PokerLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const s = view?.state;
  const g = s?.g;
  const me = view?.mySeat ?? -1;
  const myTurn = g && g.street !== 'over' && g.toAct === me && !g.folded?.[me] && !g.allIn?.[me];
  const owe = g ? Math.max(0, g.toMatch - (g.committed?.[me] || 0)) : 0;
  const pot = g ? (g.totalCommit || []).reduce((a, b) => a + b, 0) : 0;
  const showdown = g?.street === 'over' && g?.results?.scores;
  const handOver = g?.street === 'over';

  const bet = (mult) => {
    const target = mult === 'allin' ? (g.committed[me] + g.stacks[me]) : Math.round(g.toMatch + Math.max((pot + owe) * mult, 40));
    move({ type: owe > 0 ? 'raise' : 'bet', to: target });
    buzz(mult === 'allin' ? 'thud' : 'knock');
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#14100C', '#0E0B08', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>hold'em · live table</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={st.oppArc}>
          {(view?.seats || []).map((seat, i) => {
            if (i === me) return null;
            const pk = seatFace(view, i);
            const acting = g && g.street !== 'over' && g.toAct === i;
            const folded = g?.folded?.[i];
            const reveal = showdown && !folded && g.hole[i];
            return (
              <View key={i} style={[st.seat, folded && { opacity: 0.35 }]}>
                <View style={[st.faceWrap, acting && { borderColor: '#E0C088' }]}>
                  {pk ? <Image source={{ uri: faceFor(pk) }} style={st.face} /> : <View style={[st.face, st.human]}><Text style={st.humanG}>☺</Text></View>}
                  {g?.dealer === i && <Text style={st.btnMark}>Ⓓ</Text>}
                </View>
                <Text style={st.seatName} numberOfLines={1}>{label(i)}</Text>
                <Text style={st.stack}>{g ? g.stacks[i] : ''}</Text>
                <View style={{ flexDirection: 'row', gap: 3, minHeight: 39 }}>
                  {!folded && g && (reveal
                    ? <>{g.hole[i].map((c, k) => <PCard key={k} c={c} small />)}</>
                    : <><PCard hidden small /><PCard hidden small /></>)}
                  {folded && <Text style={st.foldTxt}>folded</Text>}
                </View>
                {g?.committed?.[i] > 0 && g.street !== 'over' && <Text style={st.committed}>{g.committed[i]}</Text>}
              </View>
            );
          })}
        </View>

        <View style={st.felt}>
          <Text style={st.potN}>{pot}</Text>
          <Text style={st.potL}>the pot{g && g.street !== 'over' ? ` · ${g.street === 'preflop' ? 'pre-flop' : g.street}` : ''}</Text>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => <PCard key={i} c={g?.board?.[i]} hidden={!g?.board?.[i]} />)}
          </View>
          {handOver && (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>
                {g.results?.reason === 'fold'
                  ? (g.winner === me ? 'THE TABLE FOLDS — YOURS' : `${label(g.winner).toUpperCase()} TAKES IT`)
                  : g.winner === 'chop' ? `A CHOP — ${String(g.results?.reason || '').toUpperCase()}`
                  : g.winner === me ? `YOURS — ${String(g.results?.reason || '').toUpperCase()}`
                  : `${label(g.winner).toUpperCase()} — ${String(g.results?.reason || '').toUpperCase()}`}
              </Text>
              <Pressable style={st.btn} onPress={() => { move({ type: 'deal' }); buzz('tap'); }}><Text style={st.btnTxt}>next hand</Text></Pressable>
            </View>
          )}
        </View>

        <View style={st.youRow}>
          <View>
            <Text style={[st.stack, { color: C.ember, fontSize: 18 }]}>{g && me >= 0 ? g.stacks[me] : ''}</Text>
            <Text style={st.youL}>your chips{g?.dealer === me ? ' · Ⓓ' : ''}{g?.committed?.[me] > 0 && g.street !== 'over' ? ` · in ${g.committed[me]}` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(g && me >= 0 && g.hole?.[me] ? g.hole[me] : [null, null]).map((c, k) => <PCard key={k} c={c} hidden={!c} />)}
          </View>
        </View>

        <View style={st.actions}>
          {myTurn ? (
            <>
              <View style={st.row}>
                {owe === 0 && <Pressable style={st.act} onPress={() => { move({ type: 'check' }); buzz('tick'); }}><Text style={st.actT}>check</Text></Pressable>}
                {owe > 0 && <Pressable style={[st.act, st.call]} onPress={() => { move({ type: 'call' }); buzz('tick'); }}><Text style={[st.actT, { color: '#8FD98F' }]}>call {Math.min(owe, g.stacks[me])}</Text></Pressable>}
                {owe > 0 && <Pressable style={[st.act, st.fold]} onPress={() => { move({ type: 'fold' }); buzz('thud'); }}><Text style={[st.actT, { color: '#F0708C' }]}>fold</Text></Pressable>}
              </View>
              <View style={st.row}>
                <Pressable style={st.bet} onPress={() => bet(0.5)}><Text style={st.betT}>½ pot</Text></Pressable>
                <Pressable style={st.bet} onPress={() => bet(1)}><Text style={st.betT}>pot</Text></Pressable>
                <Pressable style={[st.bet, st.allin]} onPress={() => bet('allin')}><Text style={[st.betT, { color: '#F0708C' }]}>all in</Text></Pressable>
              </View>
            </>
          ) : g && !handOver ? (
            <Text style={st.waiting}>{label(g.toAct)} is thinking…</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0B08' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#E0C088', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 },
  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8, flexWrap: 'wrap' },
  seat: { alignItems: 'center', width: 82 },
  faceWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  face: { width: 41, height: 41, borderRadius: 21, backgroundColor: '#141009' },
  human: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(224,192,136,0.1)' },
  humanG: { fontSize: 19, color: '#E0C088' },
  btnMark: { position: 'absolute', right: -6, top: -6, fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 13 },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10, marginTop: 3 },
  stack: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 13 },
  foldTxt: { fontFamily: FONTS.light, color: C.faint, fontSize: 10, fontStyle: 'italic', paddingTop: 10 },
  committed: { fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 11, marginTop: 2 },
  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  potN: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 28 },
  potL: { fontFamily: FONTS.body, color: C.faint, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' },
  banner: { marginTop: 14, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(224,192,136,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15, textAlign: 'center' },
  btn: { marginTop: 9, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,192,136,0.5)', backgroundColor: 'rgba(224,192,136,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 13.5 },
  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#171310', alignItems: 'center', justifyContent: 'center' },
  back: { backgroundColor: '#1a1409', borderColor: 'rgba(224,192,136,0.3)' },
  backG: { color: 'rgba(224,192,136,0.5)', fontSize: 16 },
  cardRank: { fontFamily: FONTS.display, lineHeight: 22 },
  cardSuit: { lineHeight: 17 },
  youRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  youL: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },
  actions: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, minHeight: 108 },
  row: { flexDirection: 'row', gap: 8 },
  act: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center' },
  call: { borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.08)' },
  fold: { borderColor: 'rgba(240,112,140,0.45)' },
  actT: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14 },
  bet: { flex: 1, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,192,136,0.4)', alignItems: 'center' },
  allin: { borderColor: 'rgba(240,112,140,0.5)', backgroundColor: 'rgba(240,112,140,0.06)' },
  betT: { fontFamily: FONTS.medium, color: '#E0C088', fontSize: 13 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, textAlign: 'center', paddingTop: 14 },
});
