// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE CALLBREAK TABLE. You + three personas, five rounds, spades
//  always boss. Engine harness-proven (must-head law cross-checked every
//  play); the personas bid like themselves and talk like themselves.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor } from '../common';
import { resolveStyle, TABLE_CAST } from '../personas';
import { dealRound, newRound, placeBid, playCard, legalCards, roundScores, fmtScore, SPADE } from './engine.js';
import { suggestBid, chooseCard } from './ai.js';

const ROUNDS = 5;
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_TONE = ['#E9E4DA', '#F0708C', '#F0A765', '#8FD98F'];
const rankName = (r) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));
const STYLE_KEYS = { calculator: 'calculator', gambler: 'gambler', guardian: 'guardian', chaos: 'chaos', smooth: 'smooth', steady: 'steady' };
const keyOf = (c) => c.s + ':' + c.r;

function CCard({ c, size = 'hand', dim, onPress, disabled }) {
  const [w, h, rf, sf] = size === 'hand' ? [44, 62, 17, 14] : [40, 56, 15, 13];
  return (
    <Pressable disabled={disabled || !onPress} onPress={onPress}
      style={[st.card, { width: w, height: h }, dim && { opacity: 0.35 }]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{rankName(c.r)}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_GLYPH[c.s]}</Text>
    </Pressable>
  );
}

export default function CallbreakTable({ opponent, roster, onExit = () => {} }) {
  const [opps] = useState(() => {
    const picked = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : [])).slice(0, 3);
    const have = new Set(picked.map((p) => p.key));
    for (const p of TABLE_CAST) {
      if (picked.length >= 3) break;
      if (!have.has(p.key)) { picked.push(p); have.add(p.key); }
    }
    return picked;
  });
  const styleKeys = opps.map((p) => resolveStyle(STYLE_KEYS, p.key, 'steady'));

  const [g, setG] = useState(null);
  const [round, setRound] = useState(0);            // 0-indexed
  const [totals, setTotals] = useState([0, 0, 0, 0]); // tenths
  const [roundEnd, setRoundEnd] = useState(null);   // scores of the finished round
  const [matchOver, setMatchOver] = useState(false);
  const [talk, setTalk] = useState(null);
  const [lastTrick, setLastTrick] = useState(null);
  const banterAt = useRef(0);
  const busy = useRef(false);

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 7000) return;
    banterAt.current = now;
    const p = opps[seat - 1]; if (!p) return;
    try {
      const { line } = await banter(p.key, `Callbreak table, five rounds, spades are trump, play-money. ONE short in-character line, no quotes. ${prompt}`);
      if (line) { setTalk({ seat, line }); setTimeout(() => setTalk(null), 4200); }
    } catch (e) {}
  }, [opps]);

  const startRound = useCallback((r) => {
    const hands = dealRound();
    const ng = newRound(hands, r % 4);
    setG({ ...ng }); setRoundEnd(null); setLastTrick(null);
    buzz('tap');
  }, []);

  useEffect(() => { startRound(0); }, [startRound]);

  // AI bids + plays
  useEffect(() => {
    if (!g || busy.current || matchOver) return;
    if (g.phase === 'bidding' && g.toBid !== 0) {
      busy.current = true;
      const seat = g.toBid;
      const t = setTimeout(() => {
        busy.current = false;
        setG((cur) => {
          if (!cur || cur.phase !== 'bidding' || cur.toBid !== seat) return cur;
          const bid = suggestBid(cur.hands[seat], styleKeys[seat - 1]);
          if (bid >= 5) say(seat, `You just called ${bid} tricks — a big call. One confident line.`);
          return { ...placeBid(cur, seat, bid) };
        });
        buzz('tick');
      }, 600 + Math.random() * 700);
      return () => clearTimeout(t);
    }
    if (g.phase === 'play' && g.toPlay !== 0) {
      busy.current = true;
      const seat = g.toPlay;
      const t = setTimeout(() => {
        busy.current = false;
        setG((cur) => {
          if (!cur || cur.phase !== 'play' || cur.toPlay !== seat) return cur;
          const card = chooseCard(cur, seat, styleKeys[seat - 1]);
          const before = cur.tricks.slice();
          const next = { ...playCard(cur, seat, card) };
          if (next.history.length && next.trick.length === 0) {
            const h = next.history[next.history.length - 1];
            setLastTrick(h);
            if (h.winner !== 0 && h.trick.some((t2) => t2.seat === 0)) buzz('thud');
            if (h.winner === 0) buzz('knock');
          }
          if (card.s === SPADE && cur.trick.length && cur.trick[0].card.s !== SPADE && Math.random() < 0.35) say(seat, 'You just cut with a spade and stole the trick. One smug line.');
          return next;
        });
      }, 500 + Math.random() * 700);
      return () => clearTimeout(t);
    }
    if (g.phase === 'over' && !roundEnd) {
      const scores = roundScores(g);
      setRoundEnd(scores);
      setTotals((t) => t.map((v, i) => v + scores[i]));
      const youMade = scores[0] > 0;
      buzz(youMade ? 'win' : 'lose');
      const bigMiss = scores.findIndex((s, i) => i > 0 && s < 0);
      if (!youMade) say(1 + Math.floor(Math.random() * 3), `The player just MISSED their call of ${g.bids[0]}. One line of gentle mockery.`);
      else if (bigMiss > 0) say(bigMiss, `You missed your own call this round. One line of self-directed grumbling.`);
    }
  }, [g, matchOver, roundEnd, say, styleKeys]);

  const yourBid = (n) => {
    setG((cur) => (cur && cur.phase === 'bidding' && cur.toBid === 0 ? { ...placeBid(cur, 0, n) } : cur));
    buzz('tick');
  };
  const yourPlay = (card) => {
    setG((cur) => {
      if (!cur || cur.phase !== 'play' || cur.toPlay !== 0) return cur;
      try {
        const next = { ...playCard(cur, 0, card) };
        if (next.history.length && next.trick.length === 0) setLastTrick(next.history[next.history.length - 1]);
        return next;
      } catch (e) { return cur; }
    });
    buzz('tick');
  };
  const nextRound = () => {
    if (round + 1 >= ROUNDS) { setMatchOver(true); buzz(totals[0] >= Math.max(...totals) ? 'win' : 'lose'); return; }
    setRound((r) => r + 1);
    startRound(round + 1);
  };

  const legal = g && g.phase === 'play' && g.toPlay === 0 ? new Set(legalCards(g, 0).map(keyOf)) : null;
  const winnerSeat = matchOver ? totals.indexOf(Math.max(...totals)) : -1;
  const seatName = (i) => (i === 0 ? 'you' : opps[i - 1]?.name?.replace(/^the /, '') || '?');

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0F1310', '#0B0E0B', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>callbreak · round {Math.min(round + 1, ROUNDS)} of {ROUNDS} · ♠ rules</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* the three of them */}
        <View style={st.oppArc}>
          {opps.map((p, i) => {
            const seat = i + 1;
            const acting = g && ((g.phase === 'bidding' && g.toBid === seat) || (g.phase === 'play' && g.toPlay === seat));
            return (
              <View key={p.key} style={st.seat}>
                <View style={[st.seatFaceWrap, acting && { borderColor: p.tone }]}>
                  <Image source={{ uri: faceFor(p.key) }} style={st.seatFace} />
                </View>
                <Text style={st.seatName} numberOfLines={1}>{p.name.replace(/^the /, '')}</Text>
                <Text style={[st.seatBidLine, { color: p.tone }]}>
                  {g && g.bids[seat] != null ? `${g.tricks[seat]}/${g.bids[seat]}` : g && g.phase === 'bidding' ? '…' : ''}
                </Text>
                <Text style={st.seatTotal}>{fmtScore(totals[seat])}</Text>
                {talk && talk.seat === seat && (
                  <View style={[st.talk, { borderColor: `${p.tone}66` }]}><Text style={st.talkTxt} numberOfLines={3}>{talk.line}</Text></View>
                )}
              </View>
            );
          })}
        </View>

        {/* the trick */}
        <View style={st.felt}>
          {matchOver ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{winnerSeat === 0 ? 'THE TABLE IS YOURS' : `${seatName(winnerSeat).toUpperCase()} TAKES THE MATCH`}</Text>
              <Text style={st.bannerScores}>{totals.map((t, i) => `${seatName(i)} ${fmtScore(t)}`).join('  ·  ')}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable style={st.nextBtn} onPress={() => { setTotals([0, 0, 0, 0]); setRound(0); setMatchOver(false); startRound(0); }}>
                  <Text style={st.nextTxt}>run it back</Text>
                </Pressable>
                <Pressable style={st.leaveBtn} onPress={onExit}><Text style={st.leaveTxt}>leave</Text></Pressable>
              </View>
            </View>
          ) : roundEnd ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{roundEnd[0] > 0 ? `CALL MADE — +${fmtScore(roundEnd[0])}` : `CALL MISSED — ${fmtScore(roundEnd[0])}`}</Text>
              <Text style={st.bannerScores}>{roundEnd.map((s, i) => `${seatName(i)} ${s > 0 ? '+' : ''}${fmtScore(s)}`).join('  ·  ')}</Text>
              <Pressable style={[st.nextBtn, { marginTop: 10 }]} onPress={nextRound}>
                <Text style={st.nextTxt}>{round + 1 >= ROUNDS ? 'final tally' : 'next round'}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={st.trickArea}>
                {(g?.trick.length ? g.trick : (lastTrick?.trick || [])).map((t, i) => (
                  <View key={i} style={st.trickCard}>
                    <CCard c={t.card} size="trick" dim={!g?.trick.length && lastTrick && t.seat !== lastTrick.winner} />
                    <Text style={st.trickWho}>{seatName(t.seat)}</Text>
                  </View>
                ))}
                {g && !g.trick.length && !lastTrick && g.phase === 'play' && (
                  <Text style={st.leadHint}>{g.toPlay === 0 ? 'your lead' : `${seatName(g.toPlay)} leads`}</Text>
                )}
              </View>
              <Text style={st.yourLine}>
                {g?.phase === 'bidding' ? (g.toBid === 0 ? 'your call — how many tricks?' : 'the table is calling…')
                  : g ? `you: ${g.tricks[0]}/${g.bids[0] ?? '–'} · total ${fmtScore(totals[0])}` : ''}
              </Text>
            </>
          )}
        </View>

        {/* your bid sheet or your hand */}
        {g?.phase === 'bidding' && g.toBid === 0 && !matchOver ? (
          <View style={st.bidRow}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <Pressable key={n} style={st.bidBtn} onPress={() => yourBid(n)}>
                <Text style={st.bidTxt}>{n}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.handRow}>
            {(g?.hands[0] || []).map((c) => {
              const ok = legal ? legal.has(keyOf(c)) : false;
              return <CCard key={keyOf(c)} c={c} dim={legal ? !ok : false} disabled={!ok} onPress={() => yourPlay(c)} />;
            })}
          </ScrollView>
        )}
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
  seatFaceWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  seatFace: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#0f120f' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  seatBidLine: { fontFamily: FONTS.display, fontSize: 14 },
  seatTotal: { fontFamily: FONTS.light, color: C.faint, fontSize: 10 },
  talk: { position: 'absolute', top: 100, width: 140, padding: 7, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(8,10,8,0.93)', zIndex: 9 },
  talkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 11, textAlign: 'center' },

  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  trickArea: { flexDirection: 'row', gap: 10, minHeight: 84, alignItems: 'center' },
  trickCard: { alignItems: 'center', gap: 3 },
  trickWho: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: 1 },
  leadHint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },
  yourLine: { fontFamily: FONTS.body, color: 'rgba(231,215,199,0.7)', fontSize: 12.5 },

  bannerWrap: { alignItems: 'center', paddingHorizontal: 20, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(143,217,143,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 16.5, textAlign: 'center' },
  bannerScores: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 5, textAlign: 'center' },
  nextBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.1)' },
  nextTxt: { fontFamily: FONTS.semibold, color: '#8FD98F', fontSize: 13.5 },
  leaveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },

  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#141712', alignItems: 'center', justifyContent: 'center' },
  cardRank: { fontFamily: FONTS.display, lineHeight: 20 },
  cardSuit: { lineHeight: 16 },

  bidRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 14, paddingBottom: 14, justifyContent: 'center' },
  bidBtn: { width: 40, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(143,217,143,0.45)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(143,217,143,0.07)' },
  bidTxt: { fontFamily: FONTS.display, color: '#8FD98F', fontSize: 18 },
  handRow: { paddingHorizontal: 12, gap: 6, paddingBottom: 12 },
});
