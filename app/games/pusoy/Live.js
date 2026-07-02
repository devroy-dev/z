// yourZ — PUSOY DOS LIVE: the multiplayer shed. Server owns rules and
// hides hands (counts only); tap to raise cards, PLAY or PASS.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz, faceFor } from '../common';
import { useLiveSession, seatLabelFn, seatFace } from '../liveCommon';
import { classify, beats, RANK_LABEL, SUIT_LABEL } from './engine.js';

const SUIT_TONE = ['#8FD98F', '#E9E4DA', '#F0708C', '#6FC9E0'];
const keyOf = (c) => c.r + ':' + c.s;
const COMBO_NAME = (combo) => combo.size === 1 ? 'a single' : combo.size === 2 ? 'a pair' : combo.size === 3 ? 'a trio'
  : ['a straight', 'a flush', 'a full house', 'quads', 'a straight flush'][combo.cat];

function PCard({ c, raised, onPress, small }) {
  const [w, h, rf, sf] = small ? [34, 48, 13, 11] : [44, 62, 16, 13];
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[st.card, { width: w, height: h }, raised && st.raised]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{RANK_LABEL[c.r]}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_LABEL[c.s]}</Text>
    </Pressable>
  );
}

export default function PusoyLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const [sel, setSel] = useState([]);
  const g = view?.state;
  const me = view?.mySeat ?? -1;
  const myTurn = g && g.phase === 'play' && g.toAct === me;
  const myHand = g && Array.isArray(g.hands?.[me]) ? g.hands[me] : [];
  const selected = myHand.filter((c) => sel.includes(keyOf(c)));
  const selCombo = selected.length ? classify(selected) : null;
  const playable = !!(myTurn && selCombo &&
    (!g.firstPlay || selected.some((c) => c.r === 0 && c.s === 0)) &&
    (!g.table || (selCombo.size === g.table.combo.size && beats(selCombo, g.table.combo))));

  const doPlay = () => { if (!playable) return; move({ type: 'play', cards: selected }); setSel([]); buzz('knock'); };
  const doPass = () => { move({ type: 'pass' }); setSel([]); buzz('tick'); };
  const over = g?.phase === 'over';

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0E1013', '#0A0C0E', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>pusoy dos live · ♦ is boss</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={st.oppArc}>
          {(view?.seats || []).map((s2, i) => {
            if (i === me) return null;
            const pk = seatFace(view, i);
            const acting = g && g.phase === 'play' && g.toAct === i;
            return (
              <View key={i} style={st.seat}>
                <View style={[st.faceWrap, acting && { borderColor: '#6FC9E0' }]}>
                  {pk ? <Image source={{ uri: faceFor(pk) }} style={st.face} /> : <View style={[st.face, st.human]}><Text style={st.humanG}>☺</Text></View>}
                </View>
                <Text style={st.seatName} numberOfLines={1}>{label(i)}</Text>
                <Text style={[st.count, g?.counts?.[i] === 1 && { color: '#F0708C' }]}>{g ? `${g.counts[i]} card${g.counts[i] === 1 ? '' : 's'}` : ''}</Text>
              </View>
            );
          })}
        </View>

        <View style={st.felt}>
          {over ? (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>{g.winner === me ? 'HAND EMPTY — YOURS' : `${label(g.winner).toUpperCase()} GOES OUT FIRST`}</Text>
              <Pressable style={st.btn} onPress={onExit}><Text style={st.btnTxt}>back to the room</Text></Pressable>
            </View>
          ) : g?.table ? (
            <>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {g.table.cards.map((c) => <PCard key={keyOf(c)} c={c} small />)}
              </View>
              <Text style={st.tableWho}>{COMBO_NAME(g.table.combo)} · {label(g.table.by)}</Text>
            </>
          ) : (
            <Text style={st.hint}>{g?.firstPlay ? `${label(g?.toAct)} opens with the 3♣` : g ? `${label(g.toAct)} leads fresh` : 'taking your seat…'}</Text>
          )}
        </View>

        {!over && myHand.length > 0 && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hand}>
              {myHand.map((c) => (
                <PCard key={keyOf(c)} c={c} raised={sel.includes(keyOf(c))}
                  onPress={() => { setSel((cur) => (cur.includes(keyOf(c)) ? cur.filter((x) => x !== keyOf(c)) : [...cur, keyOf(c)])); buzz('tick'); }} />
              ))}
            </ScrollView>
            <View style={st.row}>
              <Pressable style={[st.play, !playable && { opacity: 0.35 }]} disabled={!playable} onPress={doPlay}>
                <Text style={st.playT}>{selCombo ? `play ${COMBO_NAME(selCombo)}` : 'play'}</Text>
              </Pressable>
              <Pressable style={[st.pass, (!myTurn || !g?.table) && { opacity: 0.35 }]} disabled={!myTurn || !g?.table} onPress={doPass}>
                <Text style={st.passT}>pass</Text>
              </Pressable>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0C0E' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#6FC9E0', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8, flexWrap: 'wrap' },
  seat: { alignItems: 'center', width: 100 },
  faceWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  face: { width: 41, height: 41, borderRadius: 21, backgroundColor: '#0d0f11' },
  human: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(111,201,224,0.1)' },
  humanG: { fontSize: 19, color: '#6FC9E0' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  count: { fontFamily: FONTS.display, color: '#6FC9E0', fontSize: 12.5 },
  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 16 },
  tableWho: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 12.5 },
  hint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },
  banner: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(111,201,224,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5, textAlign: 'center' },
  btn: { marginTop: 9, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 13.5 },
  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#12151a', alignItems: 'center', justifyContent: 'center' },
  raised: { borderColor: '#6FC9E0', transform: [{ translateY: -10 }], backgroundColor: 'rgba(111,201,224,0.08)' },
  cardRank: { fontFamily: FONTS.display, lineHeight: 19 },
  cardSuit: { lineHeight: 15 },
  hand: { paddingHorizontal: 12, gap: 6, paddingBottom: 6, paddingTop: 12 },
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  play: { flex: 2, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.1)', alignItems: 'center' },
  playT: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 14 },
  pass: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center' },
  passT: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 14 },
});
