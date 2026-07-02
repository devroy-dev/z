// ════════════════════════════════════════════════════════════════════════
//  yourZ — LIAR'S DICE, under the lamplight. You + three personas, five
//  dice each under a cup, and the only real currency is nerve. The engine
//  is harness-proven (5,314 reveals verified); the personas do the lying.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor, Die } from '../common';
import { resolveStyle, TABLE_CAST } from '../personas';
import { newGame, rollRound, placeBid, callLiar, legalBids, totalDice, nextAlive } from './engine.js';
import { decide } from './ai.js';

const STYLE_KEYS = { calculator: 'calculator', gambler: 'gambler', guardian: 'guardian', chaos: 'chaos', smooth: 'smooth', steady: 'steady' };
const FACE_GLYPH = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function LiarsDiceTable({ opponent, roster, onExit = () => {} }) {
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
  const [revealed, setRevealed] = useState(false);
  const [bidFace, setBidFace] = useState(0);
  const [talk, setTalk] = useState(null);
  const banterAt = useRef(0);
  const busy = useRef(false);

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6800) return;
    banterAt.current = now;
    const p = opps[seat - 1]; if (!p) return;
    try {
      const { line } = await banter(p.key, `Liar's dice table, cups and bluffs, play-money pride. ONE short in-character line, no quotes. ${prompt}`);
      if (line) { setTalk({ seat, line }); setTimeout(() => setTalk(null), 4200); }
    } catch (e) {}
  }, [opps]);

  const start = useCallback(() => {
    const ng = newGame(4);
    rollRound(ng);
    setG({ ...ng }); setRevealed(false); setBidFace(0);
    buzz('tap');
  }, []);
  useEffect(() => { start(); }, [start]);

  const nextRoundOrEnd = () => {
    setG((cur) => {
      if (!cur) return cur;
      if (cur.phase === 'over') return cur;
      const ng = { ...cur };
      rollRound(ng);
      setRevealed(false); setBidFace(0);
      buzz('tap');
      return { ...ng };
    });
  };

  // AI turns
  useEffect(() => {
    if (!g || g.phase !== 'bidding' || g.toAct === 0 || busy.current) return;
    busy.current = true;
    const seat = g.toAct;
    const t = setTimeout(() => {
      busy.current = false;
      setG((cur) => {
        if (!cur || cur.phase !== 'bidding' || cur.toAct !== seat) return cur;
        const d = decide(cur, seat, styleKeys[seat - 1]);
        if (d.type === 'liar') {
          const next = { ...callLiar(cur, seat) };
          setRevealed(true);
          buzz(next.lastResult.truthful ? 'thud' : 'win');
          return next;
        }
        const next = { ...placeBid(cur, seat, d.qty, d.face) };
        if (d.qty >= Math.ceil(totalDice(cur) / 3) && Math.random() < 0.4) say(seat, `You just bid ${d.qty} ${d.face}s with a straight face. One line selling the lie (or the truth).`);
        buzz('tick');
        return next;
      });
    }, 700 + Math.random() * 900);
    return () => clearTimeout(t);
  }, [g, styleKeys, say]);

  // reveal aftermath banter
  useEffect(() => {
    if (!g || g.phase === 'bidding' || !g.lastResult || !revealed) return;
    const r = g.lastResult;
    if (r.bidder !== 0 && !r.truthful) say(r.bidder, 'Your bluff just got caught in the open. One line of theatrical damage control.');
    else if (r.caller !== 0 && r.truthful) say(r.caller, 'You called liar and were wrong. One line eating it.');
    else if (r.loser !== 0 && r.eliminated) say(r.loser, 'You just lost your last die and are OUT. One dignified (or not) exit line.');
  }, [g, revealed, say]);

  const yourBid = (qty, face) => {
    setG((cur) => {
      if (!cur || cur.phase !== 'bidding' || cur.toAct !== 0) return cur;
      try { buzz('tick'); return { ...placeBid(cur, 0, qty, face) }; } catch (e) { return cur; }
    });
    setBidFace(0);
  };
  const yourLiar = () => {
    setG((cur) => {
      if (!cur || cur.phase !== 'bidding' || cur.toAct !== 0 || !cur.bid) return cur;
      try {
        const next = { ...callLiar(cur, 0) };
        setRevealed(true);
        buzz(next.lastResult.truthful ? 'lose' : 'win');
        return next;
      } catch (e) { return cur; }
    });
  };

  const legal = g && g.phase === 'bidding' && g.toAct === 0 ? legalBids(g) : [];
  const faces = [...new Set(legal.map((b) => b.face))];
  const qtysFor = (f) => [...new Set(legal.filter((b) => b.face === f).map((b) => b.qty))].slice(0, 6);
  const seatName = (i) => (i === 0 ? 'you' : opps[i - 1]?.name?.replace(/^the /, '') || '?');
  const over = g?.phase === 'over';

  return (
    <View style={st.root}>
      <LinearGradient colors={['#12100E', '#0D0B09', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>liar's dice · {g ? totalDice(g) : 0} dice on the table</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* their cups */}
        <View style={st.oppArc}>
          {opps.map((p, i) => {
            const seat = i + 1;
            const acting = g && g.phase === 'bidding' && g.toAct === seat;
            const isOut = g?.out[seat];
            return (
              <View key={p.key} style={[st.seat, isOut && { opacity: 0.3 }]}>
                <View style={[st.seatFaceWrap, acting && { borderColor: p.tone }]}>
                  <Image source={{ uri: faceFor(p.key) }} style={st.seatFace} />
                </View>
                <Text style={st.seatName} numberOfLines={1}>{p.name.replace(/^the /, '')}</Text>
                {isOut ? <Text style={st.outTxt}>out</Text> : revealed && g?.cups[seat]?.length ? (
                  <View style={st.miniDiceRow}>
                    {g.cups[seat].map((d, k) => (
                      <Text key={k} style={[st.miniDie, g.lastResult && d === g.lastResult.bid.face && st.miniDieHot]}>{FACE_GLYPH[d]}</Text>
                    ))}
                  </View>
                ) : (
                  <Text style={st.cupTxt}>🥤 ×{g ? g.dice[seat] : 5}</Text>
                )}
                {talk && talk.seat === seat && (
                  <View style={[st.talkBox, { borderColor: `${p.tone}66` }]}><Text style={st.talkTxt} numberOfLines={3}>{talk.line}</Text></View>
                )}
              </View>
            );
          })}
        </View>

        {/* the bid, center stage */}
        <View style={st.felt}>
          {over ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{g.winner === 0 ? 'LAST CUP STANDING — YOU' : `${seatName(g.winner).toUpperCase()} OUTLASTS THE TABLE`}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable style={st.nextBtn} onPress={start}><Text style={st.nextTxt}>run it back</Text></Pressable>
                <Pressable style={st.leaveBtn} onPress={onExit}><Text style={st.leaveTxt}>leave</Text></Pressable>
              </View>
            </View>
          ) : revealed && g?.lastResult ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>
                {`"${g.lastResult.bid.qty} × ${FACE_GLYPH[g.lastResult.bid.face]}" — there were ${g.lastResult.actual}. `}
                {g.lastResult.truthful ? `${seatName(g.lastResult.caller).toUpperCase()} CALLED WRONG` : `${seatName(g.lastResult.bidder).toUpperCase()} WAS LYING`}
              </Text>
              <Text style={st.bannerSub}>{seatName(g.lastResult.loser)} loses a die{g.lastResult.eliminated ? ' — and is OUT' : ''}</Text>
              <Pressable style={[st.nextBtn, { marginTop: 10 }]} onPress={nextRoundOrEnd}><Text style={st.nextTxt}>next round</Text></Pressable>
            </View>
          ) : g?.bid ? (
            <>
              <Text style={st.bidBig}>{g.bid.qty} × {FACE_GLYPH[g.bid.face]}</Text>
              <Text style={st.bidWho}>{seatName(g.bid.by)} claims it</Text>
            </>
          ) : (
            <Text style={st.leadHint}>{g && g.toAct === 0 ? 'open the bidding' : `${seatName(g?.toAct ?? 0)} opens…`}</Text>
          )}
        </View>

        {/* your cup */}
        <View style={st.youRow}>
          <Text style={st.youLabel}>under your cup</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(g?.cups[0] || []).map((d, k) => (
              <Die key={k} value={d} rolling={false} enabled={false} tone={C.ember} />
            ))}
            {g?.out[0] && <Text style={st.outTxt}>you're out — watch the table finish</Text>}
          </View>
        </View>

        {/* your move */}
        <View style={st.actions}>
          {g && g.phase === 'bidding' && g.toAct === 0 && !g.out[0] ? (
            bidFace === 0 ? (
              <View style={st.actRow}>
                {faces.slice(0, 6).map((f) => (
                  <Pressable key={f} style={st.faceBtn} onPress={() => setBidFace(f)}>
                    <Text style={st.faceTxt}>{FACE_GLYPH[f]}</Text>
                  </Pressable>
                ))}
                {g.bid && (
                  <Pressable style={st.liarBtn} onPress={yourLiar}><Text style={st.liarTxt}>LIAR</Text></Pressable>
                )}
              </View>
            ) : (
              <View style={st.actRow}>
                <Pressable style={st.faceBtnLit}><Text style={st.faceTxt}>{FACE_GLYPH[bidFace]}</Text></Pressable>
                {qtysFor(bidFace).map((q) => (
                  <Pressable key={q} style={st.qtyBtn} onPress={() => yourBid(q, bidFace)}>
                    <Text style={st.qtyTxt}>{q}</Text>
                  </Pressable>
                ))}
                <Pressable style={st.backBtn} onPress={() => setBidFace(0)}><Text style={st.backTxt}>‹</Text></Pressable>
              </View>
            )
          ) : g && g.phase === 'bidding' ? (
            <Text style={st.waiting}>{seatName(g.toAct)} is weighing it…</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B09' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#F0A765', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },

  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8 },
  seat: { alignItems: 'center', width: 104 },
  seatFaceWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  seatFace: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#120f0c' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  cupTxt: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 2 },
  outTxt: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 11, marginTop: 3 },
  miniDiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1, marginTop: 2, maxWidth: 100 },
  miniDie: { fontSize: 17, color: 'rgba(245,236,225,0.55)' },
  miniDieHot: { color: '#F0A765' },
  talkBox: { position: 'absolute', top: 102, width: 140, padding: 7, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(10,8,6,0.93)', zIndex: 9 },
  talkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 11, textAlign: 'center' },

  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 18 },
  bidBig: { fontFamily: FONTS.display, color: C.cream, fontSize: 44 },
  bidWho: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  leadHint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },

  bannerWrap: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(240,167,101,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5, textAlign: 'center' },
  bannerSub: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 4 },
  nextBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,167,101,0.5)', backgroundColor: 'rgba(240,167,101,0.1)' },
  nextTxt: { fontFamily: FONTS.semibold, color: '#F0A765', fontSize: 13.5 },
  leaveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },

  youRow: { alignItems: 'center', gap: 6, paddingBottom: 8 },
  youLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },

  actions: { paddingHorizontal: 14, paddingBottom: 12, minHeight: 64, justifyContent: 'center' },
  actRow: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  faceBtn: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  faceBtnLit: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#F0A765', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,167,101,0.1)' },
  faceTxt: { fontSize: 26, color: C.cream },
  qtyBtn: { width: 40, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.45)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,167,101,0.07)' },
  qtyTxt: { fontFamily: FONTS.display, color: '#F0A765', fontSize: 17 },
  backBtn: { width: 34, height: 46, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: C.muted, fontSize: 24 },
  liarBtn: { paddingHorizontal: 16, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(240,112,140,0.6)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,112,140,0.08)' },
  liarTxt: { fontFamily: FONTS.semibold, color: '#F0708C', fontSize: 14, letterSpacing: 2 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, textAlign: 'center' },
});
