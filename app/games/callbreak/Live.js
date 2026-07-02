// yourZ — CALLBREAK LIVE: the multiplayer table. Server owns the rules;
// this renders your filtered view (others' hands are just counts).
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz, faceFor } from '../common';
import { useLiveSession, seatLabelFn, seatFace } from '../liveCommon';
import { fmtScore, RANK_LABEL as _RL } from './engine.js';

const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_TONE = ['#E9E4DA', '#F0708C', '#F0A765', '#8FD98F'];
const rankName = (r) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));
const keyOf = (c) => c.s + ':' + c.r;

function CCard({ c, small, onPress, dim }) {
  const [w, h, rf, sf] = small ? [38, 54, 14, 12] : [44, 62, 17, 14];
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[st.card, { width: w, height: h }, dim && { opacity: 0.4 }]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{rankName(c.r)}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_GLYPH[c.s]}</Text>
    </Pressable>
  );
}

export default function CallbreakLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const s = view?.state;
  const g = s?.g;
  const me = view?.mySeat ?? -1;
  const myBid = g && g.phase === 'bidding' && g.toBid === me;
  const myPlay = g && g.phase === 'play' && g.toPlay === me;
  const lastTrick = g?.history?.length ? g.history[g.history.length - 1] : null;

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0F1310', '#0B0E0B', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>callbreak live · round {(s?.round ?? 0) + 1} of 5</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={st.oppArc}>
          {(view?.seats || []).map((seat, i) => {
            if (i === me) return null;
            const pk = seatFace(view, i);
            const acting = g && ((g.phase === 'bidding' && g.toBid === i) || (g.phase === 'play' && g.toPlay === i));
            return (
              <View key={i} style={st.seat}>
                <View style={[st.faceWrap, acting && { borderColor: C.ember }]}>
                  {pk ? <Image source={{ uri: faceFor(pk) }} style={st.face} /> : <View style={[st.face, st.human]}><Text style={st.humanG}>☺</Text></View>}
                </View>
                <Text style={st.seatName} numberOfLines={1}>{label(i)}</Text>
                <Text style={st.seatBid}>{g?.bids?.[i] != null ? `${g.tricks[i]}/${g.bids[i]}` : '…'}</Text>
                <Text style={st.seatTotal}>{s ? fmtScore(s.totals[i]) : ''}</Text>
              </View>
            );
          })}
        </View>

        <View style={st.felt}>
          {s?.done ? (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>{s.totals.indexOf(Math.max(...s.totals)) === me ? 'THE MATCH IS YOURS' : `${label(s.totals.indexOf(Math.max(...s.totals))).toUpperCase()} TAKES THE MATCH`}</Text>
              <Text style={st.bannerSub}>{s.totals.map((t, i) => `${label(i)} ${fmtScore(t)}`).join(' · ')}</Text>
              <Pressable style={st.btn} onPress={onExit}><Text style={st.btnTxt}>back to the room</Text></Pressable>
            </View>
          ) : s?.between ? (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>{s.lastScores?.[me] > 0 ? `CALL MADE — +${fmtScore(s.lastScores[me])}` : `CALL MISSED — ${fmtScore(s.lastScores?.[me] ?? 0)}`}</Text>
              <Text style={st.bannerSub}>{(s.lastScores || []).map((x, i) => `${label(i)} ${x > 0 ? '+' : ''}${fmtScore(x)}`).join(' · ')}</Text>
              <Pressable style={st.btn} onPress={() => { move({ type: 'next' }); buzz('tap'); }}><Text style={st.btnTxt}>next round</Text></Pressable>
            </View>
          ) : (
            <>
              <View style={st.trick}>
                {((g?.trick?.length ? g.trick : lastTrick?.trick) || []).map((t, i) => (
                  <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                    <CCard c={t.card} small dim={!g?.trick?.length && lastTrick && t.seat !== lastTrick.winner} />
                    <Text style={st.who}>{label(t.seat)}</Text>
                  </View>
                ))}
                {g && !g.trick?.length && !lastTrick && <Text style={st.hint}>{myPlay ? 'your lead' : `${label(g.toPlay)} leads`}</Text>}
              </View>
              <Text style={st.meLine}>{g?.phase === 'bidding' ? (myBid ? 'your call — how many?' : 'the table is calling…') : g ? `you: ${g.tricks[me]}/${g.bids?.[me] ?? '–'} · total ${fmtScore(s?.totals?.[me] ?? 0)}` : 'taking your seat…'}</Text>
            </>
          )}
        </View>

        {myBid ? (
          <View style={st.bidRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Pressable key={n} style={st.bidBtn} onPress={() => { move({ type: 'bid', n }); buzz('tick'); }}>
                <Text style={st.bidTxt}>{n}</Text>
              </Pressable>
            ))}
          </View>
        ) : !s?.done && Array.isArray(g?.hands?.[me]) ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hand}>
            {g.hands[me].map((c) => (
              <CCard key={keyOf(c)} c={c} dim={!myPlay} onPress={myPlay ? () => { move({ type: 'card', card: c }); buzz('tick'); } : null} />
            ))}
          </ScrollView>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0E0B' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#8FD98F', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8 },
  seat: { alignItems: 'center', width: 100 },
  faceWrap: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  face: { width: 41, height: 41, borderRadius: 21, backgroundColor: '#0f120f' },
  human: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,217,143,0.1)' },
  humanG: { fontSize: 19, color: '#8FD98F' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  seatBid: { fontFamily: FONTS.display, color: '#8FD98F', fontSize: 13.5 },
  seatTotal: { fontFamily: FONTS.light, color: C.faint, fontSize: 10 },
  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  trick: { flexDirection: 'row', gap: 10, minHeight: 78, alignItems: 'center' },
  who: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1 },
  hint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },
  meLine: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.7)', fontSize: 12.5 },
  banner: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(143,217,143,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 16, textAlign: 'center' },
  bannerSub: { fontFamily: FONTS.body, color: C.muted, fontSize: 11.5, marginTop: 4, textAlign: 'center' },
  btn: { marginTop: 10, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 13.5 },
  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#141712', alignItems: 'center', justifyContent: 'center' },
  cardRank: { fontFamily: FONTS.display, lineHeight: 20 },
  cardSuit: { lineHeight: 16 },
  bidRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 14, justifyContent: 'center' },
  bidBtn: { width: 40, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(143,217,143,0.45)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,217,143,0.07)' },
  bidTxt: { fontFamily: FONTS.display, color: '#8FD98F', fontSize: 18 },
  hand: { paddingHorizontal: 12, gap: 6, paddingBottom: 12 },
});
