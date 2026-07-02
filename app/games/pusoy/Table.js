// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE PUSOY DOS TABLE. Three personas, thirteen cards, diamonds
//  boss. Engine harness-proven (10,722 plays re-validated); tap cards to
//  raise them, PLAY or PASS. First empty hand takes the table.
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
import { newGame, play, pass, classify, beats, RANK_LABEL, SUIT_LABEL } from './engine.js';
import { choose } from './ai.js';

const STYLE_KEYS = { calculator: 'calculator', gambler: 'gambler', guardian: 'guardian', chaos: 'chaos', smooth: 'smooth', steady: 'steady' };
const SUIT_TONE = ['#8FD98F', '#E9E4DA', '#F0708C', '#6FC9E0'];   // ♣ ♠ ♥ ♦
const keyOf = (c) => c.r + ':' + c.s;

function PCard({ c, raised, onPress, small }) {
  const [w, h, rf, sf] = small ? [34, 48, 13, 11] : [44, 62, 16, 13];
  return (
    <Pressable disabled={!onPress} onPress={onPress}
      style={[st.card, { width: w, height: h }, raised && st.cardRaised]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{RANK_LABEL[c.r]}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_LABEL[c.s]}</Text>
    </Pressable>
  );
}

const COMBO_NAME = (combo) => combo.size === 1 ? 'a single' : combo.size === 2 ? 'a pair' : combo.size === 3 ? 'a trio'
  : ['a straight', 'a flush', 'a full house', 'quads', 'a straight flush'][combo.cat];

export default function PusoyTable({ opponent, roster, onExit = () => {} }) {
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
  const [sel, setSel] = useState([]);           // selected card keys
  const [talk, setTalk] = useState(null);
  const [passFlash, setPassFlash] = useState(null);
  const banterAt = useRef(0);
  const busy = useRef(false);

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6800) return;
    banterAt.current = now;
    const p = opps[seat - 1]; if (!p) return;
    try {
      const { line } = await banter(p.key, `Pusoy Dos table, thirteen cards, diamonds highest, play-money pride. ONE short in-character line, no quotes. ${prompt}`);
      if (line) { setTalk({ seat, line }); setTimeout(() => setTalk(null), 4200); }
    } catch (e) {}
  }, [opps]);

  const start = useCallback(() => {
    setG({ ...newGame() }); setSel([]); setPassFlash(null);
    buzz('tap');
  }, []);
  useEffect(() => { start(); }, [start]);

  // AI turns
  useEffect(() => {
    if (!g || g.phase !== 'play' || g.toAct === 0 || busy.current) return;
    busy.current = true;
    const seat = g.toAct;
    const t = setTimeout(() => {
      busy.current = false;
      setG((cur) => {
        if (!cur || cur.phase !== 'play' || cur.toAct !== seat) return cur;
        const d = choose(cur, seat, styleKeys[seat - 1]);
        if (d.type === 'pass') {
          const next = { ...pass(cur, seat) };
          setPassFlash(seat); setTimeout(() => setPassFlash(null), 900);
          buzz('tick');
          return next;
        }
        const combo = classify(d.cards);
        const next = { ...play(cur, seat, d.cards) };
        if (combo.size === 5 && combo.cat >= 2 && Math.random() < 0.5) say(seat, `You just dropped ${COMBO_NAME(combo)} on the table. One line of quiet menace.`);
        if (next.counts[seat] === 1) say(seat, 'You are down to your LAST CARD. One line — smug or nervous, your call.');
        if (next.phase === 'over') buzz('lose');
        else buzz('knock');
        return next;
      });
    }, 650 + Math.random() * 850);
    return () => clearTimeout(t);
  }, [g, styleKeys, say]);

  // winner banter
  useEffect(() => {
    if (!g || g.phase !== 'over' || g.winner === 0) return;
    say(g.winner, 'You just emptied your hand and won the whole table. Gloat, one line.');
  }, [g, say]);

  const toggle = (c) => {
    const k = keyOf(c);
    setSel((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));
    buzz('tick');
  };
  const selectedCards = () => (g ? g.hands[0].filter((c) => sel.includes(keyOf(c))) : []);
  const selCombo = g && sel.length ? classify(selectedCards()) : null;
  const playable = !!(g && g.phase === 'play' && g.toAct === 0 && selCombo &&
    (!g.firstPlay || selectedCards().some((c) => c.r === 0 && c.s === 0)) &&
    (!g.table || (selCombo.size === g.table.combo.size && beats(selCombo, g.table.combo))));

  const doPlay = () => {
    if (!playable) return;
    setG((cur) => {
      try { const next = { ...play(cur, 0, selectedCards()) }; buzz('knock'); if (next.phase === 'over') buzz('win'); return next; }
      catch (e) { return cur; }
    });
    setSel([]);
  };
  const doPass = () => {
    setG((cur) => {
      if (!cur || cur.toAct !== 0 || !cur.table) return cur;
      try { buzz('tick'); return { ...pass(cur, 0) }; } catch (e) { return cur; }
    });
    setSel([]);
  };

  const seatName = (i) => (i === 0 ? 'you' : opps[i - 1]?.name?.replace(/^the /, '') || '?');
  const over = g?.phase === 'over';

  return (
    <View style={st.root}>
      <LinearGradient colors={['#0E1013', '#0A0C0E', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>pusoy dos · ♦ is boss</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* them */}
        <View style={st.oppArc}>
          {opps.map((p, i) => {
            const seat = i + 1;
            const acting = g && g.phase === 'play' && g.toAct === seat;
            return (
              <View key={p.key} style={st.seat}>
                <View style={[st.seatFaceWrap, acting && { borderColor: p.tone }]}>
                  <Image source={{ uri: faceFor(p.key) }} style={st.seatFace} />
                </View>
                <Text style={st.seatName} numberOfLines={1}>{p.name.replace(/^the /, '')}</Text>
                <Text style={[st.seatCount, g?.counts[seat] === 1 && { color: '#F0708C' }]}>
                  {g ? `${g.counts[seat]} card${g.counts[seat] === 1 ? '' : 's'}` : ''}
                </Text>
                {passFlash === seat && <Text style={st.passTxt}>pass</Text>}
                {talk && talk.seat === seat && (
                  <View style={[st.talkBox, { borderColor: `${p.tone}66` }]}><Text style={st.talkTxt} numberOfLines={3}>{talk.line}</Text></View>
                )}
              </View>
            );
          })}
        </View>

        {/* the table */}
        <View style={st.felt}>
          {over ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{g.winner === 0 ? 'HAND EMPTY — THE TABLE IS YOURS' : `${seatName(g.winner).toUpperCase()} GOES OUT FIRST`}</Text>
              <Text style={st.bannerSub}>{[1, 2, 3].filter((s) => s !== g.winner).map((s) => `${seatName(s)} left with ${g.counts[s]}`).join(' · ')}{g.winner !== 0 ? ` · you left with ${g.counts[0]}` : ''}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Pressable style={st.nextBtn} onPress={start}><Text style={st.nextTxt}>run it back</Text></Pressable>
                <Pressable style={st.leaveBtn} onPress={onExit}><Text style={st.leaveTxt}>leave</Text></Pressable>
              </View>
            </View>
          ) : g?.table ? (
            <>
              <View style={{ flexDirection: 'row', gap: 5 }}>
                {g.table.cards.map((c) => <PCard key={keyOf(c)} c={c} small />)}
              </View>
              <Text style={st.tableWho}>{COMBO_NAME(g.table.combo)} · {seatName(g.table.by)}</Text>
            </>
          ) : (
            <Text style={st.leadHint}>{g?.firstPlay ? `${seatName(g.toAct)} opens with the 3♣` : g ? `${seatName(g.toAct)} leads fresh` : ''}</Text>
          )}
        </View>

        {/* your hand */}
        {!over && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.handRow}>
              {(g?.hands[0] || []).map((c) => (
                <PCard key={keyOf(c)} c={c} raised={sel.includes(keyOf(c))} onPress={() => toggle(c)} />
              ))}
            </ScrollView>
            <View style={st.actRow}>
              <Pressable style={[st.playBtn, !playable && { opacity: 0.35 }]} disabled={!playable} onPress={doPlay}>
                <Text style={st.playTxt}>{selCombo ? `play ${COMBO_NAME(selCombo)}` : 'play'}</Text>
              </Pressable>
              <Pressable style={[st.passBtn, (!g || g.toAct !== 0 || !g.table) && { opacity: 0.35 }]}
                disabled={!g || g.toAct !== 0 || !g.table} onPress={doPass}>
                <Text style={st.passBtnTxt}>pass</Text>
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

  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8 },
  seat: { alignItems: 'center', width: 104 },
  seatFaceWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  seatFace: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#0d0f11' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  seatCount: { fontFamily: FONTS.display, color: '#6FC9E0', fontSize: 12.5 },
  passTxt: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 11 },
  talkBox: { position: 'absolute', top: 100, width: 140, padding: 7, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(8,9,10,0.93)', zIndex: 9 },
  talkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 11, textAlign: 'center' },

  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 16 },
  tableWho: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 12.5 },
  leadHint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },

  bannerWrap: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(111,201,224,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5, textAlign: 'center' },
  bannerSub: { fontFamily: FONTS.body, color: C.muted, fontSize: 11.5, marginTop: 4, textAlign: 'center' },
  nextBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.1)' },
  nextTxt: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 13.5 },
  leaveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)' },
  leaveTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 13.5 },

  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#12151a', alignItems: 'center', justifyContent: 'center' },
  cardRaised: { borderColor: '#6FC9E0', transform: [{ translateY: -10 }], backgroundColor: 'rgba(111,201,224,0.08)' },
  cardRank: { fontFamily: FONTS.display, lineHeight: 19 },
  cardSuit: { lineHeight: 15 },

  handRow: { paddingHorizontal: 12, gap: 6, paddingBottom: 6, paddingTop: 12 },
  actRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  playBtn: { flex: 2, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.1)', alignItems: 'center' },
  playTxt: { fontFamily: FONTS.semibold, color: '#6FC9E0', fontSize: 14 },
  passBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center' },
  passBtnTxt: { fontFamily: FONTS.semibold, color: C.muted, fontSize: 14 },
});
