// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE HOLD'EM TABLE, five-handed. You + four personas. The
//  multiway engine is harness-proven (side pots, layered awards, exact
//  conservation); the personas supply style and mouth. Play-money only.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor } from '../common';
import { resolveStyle, TABLE_CAST } from '../personas';
import { newHand, act, legalActions, potTotal, BB } from './engine.js';
import { chooseAction } from './ai.js';

const BANK_KEY = 'z_poker_bank';
const BOOT = 2000;
const SEATS = 5;
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_TONE = ['#E9E4DA', '#F0708C', '#F0A765', '#8FD98F'];
const rankName = (r) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));
const STYLE_KEYS = { calculator: 'calculator', gambler: 'gambler', guardian: 'guardian', chaos: 'chaos', smooth: 'smooth', steady: 'steady' };

function PCard({ c, hidden, size = 'board' }) {
  const dims = size === 'board' ? [46, 64, 18, 15] : size === 'mine' ? [54, 76, 21, 17] : [26, 37, 12, 10];
  const [w, h, rf, sf] = dims;
  if (hidden || !c) return (
    <View style={[st.card, { width: w, height: h }, st.cardBack]}>
      {size !== 'opp' && <Text style={st.backGlyph}>✦</Text>}
    </View>
  );
  return (
    <View style={[st.card, { width: w, height: h }]}>
      <Text style={[st.cardRank, { fontSize: rf, color: SUIT_TONE[c.s] }]}>{rankName(c.r)}</Text>
      <Text style={[st.cardSuit, { fontSize: sf, color: SUIT_TONE[c.s] }]}>{SUIT_GLYPH[c.s]}</Text>
    </View>
  );
}

function OppSeat({ p, seat, g, showdown, talk }) {
  const folded = g && g.folded[seat];
  const acting = g && g.toAct === seat && g.street !== 'over';
  const reveal = showdown && g?.results?.scores && !folded;
  return (
    <View style={[st.seat, folded && { opacity: 0.35 }]}>
      <View style={[st.seatFaceWrap, acting && { borderColor: p.tone, shadowColor: p.tone, shadowOpacity: 0.8, shadowRadius: 8 }]}>
        <Image source={{ uri: faceFor(p.key) }} style={st.seatFace} />
        {g && g.dealer === seat && <Text style={st.seatBtn}>Ⓓ</Text>}
      </View>
      <Text style={st.seatName} numberOfLines={1}>{p.name.replace(/^the /, '')}</Text>
      <Text style={[st.seatStack, { color: p.tone }]}>{g ? g.stacks[seat] : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 3, marginTop: 2, minHeight: 37 }}>
        {!folded && g && <>
          <PCard c={g.hole[seat][0]} hidden={!reveal} size="opp" />
          <PCard c={g.hole[seat][1]} hidden={!reveal} size="opp" />
        </>}
        {folded && <Text style={st.foldedTxt}>folded</Text>}
      </View>
      {g && g.committed[seat] > 0 && g.street !== 'over' && (
        <Text style={st.committed}>{g.committed[seat]}</Text>
      )}
      {talk && talk.seat === seat && (
        <View style={[st.talk, { borderColor: `${p.tone}66` }]}><Text style={st.talkTxt} numberOfLines={3}>{talk.line}</Text></View>
      )}
    </View>
  );
}

export default function PokerTable({ opponent, roster, onExit = () => {} }) {
  // seat 0 = you; seats 1..4 = personas (picked roster padded from the cast)
  const [opps] = useState(() => {
    const picked = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : [])).slice(0, 4);
    const have = new Set(picked.map((p) => p.key));
    for (const p of TABLE_CAST) {
      if (picked.length >= 4) break;
      if (!have.has(p.key)) { picked.push(p); have.add(p.key); }
    }
    return picked;
  });
  const styleKeys = opps.map((p) => resolveStyle(STYLE_KEYS, p.key, 'steady'));

  const [bank, setBank] = useState(BOOT);
  const [g, setG] = useState(null);
  const [reveal, setReveal] = useState(0);
  const [banner, setBanner] = useState(null);
  const [talk, setTalk] = useState(null);
  const banterAt = useRef(0);
  const dealerRef = useRef(0);
  const oppStacks = useRef([BOOT, BOOT, BOOT, BOOT]);
  const thinking = useRef(false);

  useEffect(() => { AsyncStorage.getItem(BANK_KEY).then((v) => { if (v != null) setBank(Number(v)); }).catch(() => {}); }, []);
  const saveBank = (b) => { setBank(b); AsyncStorage.setItem(BANK_KEY, String(b)).catch(() => {}); };

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 7000) return;
    banterAt.current = now;
    const p = opps[seat - 1];
    if (!p) return;
    try {
      const { line } = await banter(p.key, `Five-handed hold'em table, play-money chips, mid-hand. ONE short in-character line, no quotes. ${prompt}`);
      if (line) { setTalk({ seat, line }); setTimeout(() => setTalk(null), 4200); }
    } catch (e) {}
  }, [opps]);

  const deal = useCallback(() => {
    let you = bank;
    if (you < BB * 2) { you = BOOT; saveBank(BOOT); say(1 + Math.floor(Math.random() * 4), 'The player went broke and the house fronted fresh chips. One line about it.'); }
    const os = oppStacks.current.map((s) => (s < BB * 2 ? BOOT : s));
    oppStacks.current = os;
    const hand = newHand([you, ...os], dealerRef.current);
    dealerRef.current = (dealerRef.current + 1) % SEATS;
    setBanner(null); setReveal(0);
    setG({ ...hand });
    buzz('tap');
  }, [bank, say]);

  // board reveal pacing
  useEffect(() => {
    if (!g) return;
    if (g.board.length > reveal) {
      const t = setTimeout(() => { setReveal((r) => r + 1); buzz('tick'); }, 300);
      return () => clearTimeout(t);
    }
  }, [g, reveal]);

  // settle
  useEffect(() => {
    if (!g || g.street !== 'over' || banner) return;
    const t = setTimeout(() => {
      saveBank(g.stacks[0]);
      oppStacks.current = g.stacks.slice(1);
      const youWon = (g.results?.awards?.[0] || 0) > 0;
      const mainW = g.winner;
      const line = g.results?.reason === 'fold'
        ? (mainW === 0 ? 'THE TABLE FOLDS — YOURS' : `${opps[mainW - 1]?.name?.toUpperCase() || 'THEM'} TAKES IT`)
        : mainW === 'chop' ? `A CHOP — ${g.results.reason.toUpperCase()}`
        : mainW === 0 ? `YOURS — ${g.results.reason.toUpperCase()}`
        : `${opps[mainW - 1]?.name?.toUpperCase()} — ${g.results.reason.toUpperCase()}`;
      setBanner(line);
      buzz(youWon ? 'win' : 'lose');
      if (mainW !== 0 && mainW !== 'chop') say(mainW, `You just won the pot${g.results?.reason === 'fold' ? ' when everyone folded' : ` at showdown with ${g.results?.reason}`}. Gloat, in character, one line.`);
      else if (mainW === 0) say(1 + Math.floor(Math.random() * 4), 'The player just took the pot off the table. React, one line.');
    }, g.results?.scores ? 800 : 250);
    return () => clearTimeout(t);
  }, [g, banner, opps, say]);

  // AI seats think and act
  useEffect(() => {
    if (!g || g.street === 'over' || g.toAct === 0 || g.toAct < 0 || thinking.current) return;
    if (g.board.length > reveal) return;
    thinking.current = true;
    const seat = g.toAct;
    const t = setTimeout(() => {
      thinking.current = false;
      setG((cur) => {
        if (!cur || cur.toAct !== seat || cur.street === 'over') return cur;
        const choice = chooseAction(cur, seat, styleKeys[seat - 1]);
        try {
          const next = { ...act(cur, choice) };
          if ((choice.type === 'raise' || choice.type === 'bet') && Math.random() < 0.3) say(seat, `You just ${choice.type} into a live pot. One needling line at the table.`);
          if (choice.type === 'fold') buzz('tick');
          if (choice.type === 'raise' || choice.type === 'bet') buzz('knock');
          return next;
        } catch (e) { return cur; }
      });
    }, 550 + Math.random() * 850);
    return () => clearTimeout(t);
  }, [g, reveal, styleKeys, say]);

  const acts = g && g.street !== 'over' && g.toAct === 0 && g.board.length <= reveal ? legalActions(g) : [];
  const canCall = acts.find((a) => a.type === 'call');
  const canCheck = acts.find((a) => a.type === 'check');
  const canBet = acts.find((a) => a.type === 'bet' || a.type === 'raise');
  const owe = g ? Math.max(0, g.toMatch - g.committed[0]) : 0;

  const doAct = (action) => {
    setG((cur) => {
      if (!cur || cur.toAct !== 0 || cur.street === 'over') return cur;
      try { return { ...act(cur, action) }; } catch (e) { return cur; }
    });
    buzz('tick');
  };
  const betTo = (mult) => {
    if (!canBet || !g) return;
    const pot = potTotal(g);
    const target = mult === 'allin' ? canBet.maxTo : Math.round(g.toMatch + Math.max((pot + owe) * mult, BB * 2));
    doAct({ type: canBet.type, to: Math.min(Math.max(target, canBet.minTo), canBet.maxTo) });
    if (mult === 'allin') { buzz('thud'); say(1 + Math.floor(Math.random() * 4), 'The player just shoved ALL IN. React.'); }
  };

  const streetLabel = g ? (g.street === 'preflop' ? 'pre-flop' : g.street === 'over' ? '' : g.street) : '';
  const showdown = g && g.street === 'over' && g.results?.scores;

  return (
    <View style={st.root}>
      <LinearGradient colors={['#14100C', '#0E0B08', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>hold'em · five-handed</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* the four of them */}
        <View style={st.oppArc}>
          {opps.map((p, i) => (
            <OppSeat key={p.key} p={p} seat={i + 1} g={g} showdown={showdown} talk={talk} />
          ))}
        </View>

        {/* the felt */}
        <View style={st.felt}>
          <Text style={st.potN}>{g ? potTotal(g) : 0}</Text>
          <Text style={st.potLabel}>the pot{streetLabel ? ` · ${streetLabel}` : ''}</Text>
          <View style={st.board}>
            {[0, 1, 2, 3, 4].map((i) => (
              <PCard key={i} c={g && i < reveal ? g.board[i] : null} hidden={!g || i >= reveal} />
            ))}
          </View>
          {banner && (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{banner}</Text>
              <Pressable style={st.nextBtn} onPress={deal}><Text style={st.nextTxt}>next hand</Text></Pressable>
            </View>
          )}
          {!g && (
            <Pressable style={[st.nextBtn, { marginTop: 16 }]} onPress={deal}><Text style={st.nextTxt}>deal me in</Text></Pressable>
          )}
        </View>

        {/* you */}
        <View style={st.youRow}>
          <View>
            <Text style={[st.stackN, { color: C.ember }]}>{g ? g.stacks[0] : bank}</Text>
            <Text style={st.stackLabel}>your chips{g && g.dealer === 0 ? ' · Ⓓ' : ''}{g && g.committed[0] > 0 && g.street !== 'over' ? ` · in ${g.committed[0]}` : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PCard c={g?.hole[0][0]} hidden={!g} size="mine" />
            <PCard c={g?.hole[0][1]} hidden={!g} size="mine" />
          </View>
        </View>

        <View style={st.actions}>
          {acts.length > 0 ? (
            <>
              <View style={st.actRow}>
                {canCheck && <Pressable style={st.actBtn} onPress={() => doAct({ type: 'check' })}><Text style={st.actTxt}>check</Text></Pressable>}
                {canCall && <Pressable style={[st.actBtn, st.actCall]} onPress={() => doAct({ type: 'call' })}><Text style={[st.actTxt, { color: '#8FD98F' }]}>call {canCall.amount}</Text></Pressable>}
                {!canCheck && <Pressable style={[st.actBtn, st.actFold]} onPress={() => { doAct({ type: 'fold' }); buzz('thud'); }}><Text style={[st.actTxt, { color: '#F0708C' }]}>fold</Text></Pressable>}
              </View>
              {canBet && (
                <View style={st.actRow}>
                  <Pressable style={st.betBtn} onPress={() => betTo(0.5)}><Text style={st.betTxt}>½ pot</Text></Pressable>
                  <Pressable style={st.betBtn} onPress={() => betTo(1)}><Text style={st.betTxt}>pot</Text></Pressable>
                  <Pressable style={[st.betBtn, st.allinBtn]} onPress={() => betTo('allin')}><Text style={[st.betTxt, { color: '#F0708C' }]}>all in</Text></Pressable>
                </View>
              )}
            </>
          ) : g && g.street !== 'over' && g.toAct > 0 ? (
            <Text style={st.waiting}>{opps[g.toAct - 1]?.name} is thinking…</Text>
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

  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8, paddingHorizontal: 4 },
  seat: { alignItems: 'center', width: 84 },
  seatFaceWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)', overflow: 'visible' },
  seatFace: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#141009' },
  seatBtn: { position: 'absolute', right: -6, top: -6, fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 13 },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  seatStack: { fontFamily: FONTS.display, fontSize: 13 },
  foldedTxt: { fontFamily: FONTS.light, color: C.faint, fontSize: 10, fontStyle: 'italic', paddingTop: 10 },
  committed: { fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 11, marginTop: 2 },
  talk: { position: 'absolute', top: 96, width: 130, padding: 7, borderRadius: 10, borderWidth: 1, backgroundColor: 'rgba(10,8,6,0.92)', zIndex: 9 },
  talkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 11, textAlign: 'center' },

  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  potN: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 28 },
  potLabel: { fontFamily: FONTS.body, color: C.faint, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' },
  board: { flexDirection: 'row', gap: 6, marginTop: 10 },

  card: { borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#171310', alignItems: 'center', justifyContent: 'center' },
  cardBack: { backgroundColor: '#1a1409', borderColor: 'rgba(224,192,136,0.3)' },
  backGlyph: { color: 'rgba(224,192,136,0.5)', fontSize: 16 },
  cardRank: { fontFamily: FONTS.display, lineHeight: 22 },
  cardSuit: { lineHeight: 17 },

  bannerWrap: { marginTop: 14, alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(224,192,136,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5, textAlign: 'center' },
  nextBtn: { marginTop: 9, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,192,136,0.5)', backgroundColor: 'rgba(224,192,136,0.1)' },
  nextTxt: { fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 13.5 },

  youRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
  stackN: { fontFamily: FONTS.display, fontSize: 19, lineHeight: 21 },
  stackLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },

  actions: { paddingHorizontal: 16, paddingBottom: 10, gap: 8, minHeight: 108 },
  actRow: { flexDirection: 'row', gap: 8 },
  actBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center' },
  actCall: { borderColor: 'rgba(143,217,143,0.5)', backgroundColor: 'rgba(143,217,143,0.08)' },
  actFold: { borderColor: 'rgba(240,112,140,0.45)' },
  actTxt: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 14 },
  betBtn: { flex: 1, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(224,192,136,0.4)', alignItems: 'center' },
  allinBtn: { borderColor: 'rgba(240,112,140,0.5)', backgroundColor: 'rgba(240,112,140,0.06)' },
  betTxt: { fontFamily: FONTS.medium, color: '#E0C088', fontSize: 13 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, textAlign: 'center', paddingTop: 14 },
});
