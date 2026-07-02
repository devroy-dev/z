// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE HOLD'EM TABLE. Heads-up no-limit against any persona.
//  Deterministic engine owns every rule (harness-proven: 600 hands, exact
//  conservation, zero illegal actions); the persona supplies style + mouth.
//  Play-money only; the bank persists like every table in the house.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor } from '../common';
import { resolveStyle } from '../personas';
import { newHand, act, legalActions, BB } from './engine.js';
import { chooseAction } from './ai.js';
import { handName } from './eval.js';

const BANK_KEY = 'z_poker_bank';
const BOOT = 2000;
const SUIT_GLYPH = ['♠', '♥', '♦', '♣'];
const SUIT_TONE = ['#E9E4DA', '#F0708C', '#F0A765', '#8FD98F'];
const rankName = (r) => (r === 14 ? 'A' : r === 13 ? 'K' : r === 12 ? 'Q' : r === 11 ? 'J' : String(r));

function PCard({ c, hidden, small }) {
  const w = small ? 44 : 54, h = small ? 62 : 76;
  if (hidden || !c) return (
    <View style={[st.card, { width: w, height: h }, st.cardBack]}>
      <Text style={st.backGlyph}>✦</Text>
    </View>
  );
  return (
    <View style={[st.card, { width: w, height: h }]}>
      <Text style={[st.cardRank, small && { fontSize: 17 }, { color: SUIT_TONE[c.s] }]}>{rankName(c.r)}</Text>
      <Text style={[st.cardSuit, small && { fontSize: 15 }, { color: SUIT_TONE[c.s] }]}>{SUIT_GLYPH[c.s]}</Text>
    </View>
  );
}

export default function PokerTable({ opponent, roster, onExit = () => {} }) {
  const opp = (Array.isArray(roster) && roster[0]) || opponent || { key: 'the_cynic', name: 'the cynic', tone: '#6FC9E0' };
  // style keys ARE the AI's policy names; resolveStyle maps persona→temperament alias
  const STYLE_KEYS = { calculator: 'calculator', gambler: 'gambler', guardian: 'guardian', chaos: 'chaos', smooth: 'smooth', steady: 'steady' };
  const styleKey = resolveStyle(STYLE_KEYS, opp.key, 'steady');
  const tone = opp.tone || '#6FC9E0';

  const [bank, setBank] = useState(BOOT);
  const [oppStack, setOppStack] = useState(BOOT);
  const [g, setG] = useState(null);
  const [reveal, setReveal] = useState(0);        // board cards currently shown
  const [showOpp, setShowOpp] = useState(false);
  const [banner, setBanner] = useState(null);
  const [talk, setTalk] = useState(null);
  const banterAt = useRef(0);
  const dealerRef = useRef(0);
  const thinking = useRef(false);

  useEffect(() => { AsyncStorage.getItem(BANK_KEY).then((v) => { if (v != null) setBank(Number(v)); }).catch(() => {}); }, []);
  const saveBank = (b) => { setBank(b); AsyncStorage.setItem(BANK_KEY, String(b)).catch(() => {}); };

  const say = useCallback(async (prompt) => {
    const now = Date.now(); if (now - banterAt.current < 7000) return;
    banterAt.current = now;
    try {
      const { line } = await banter(opp.key, `Heads-up hold'em table, play-money chips, mid-hand. ONE short in-character line, no quotes. ${prompt}`);
      if (line) { setTalk(line); setTimeout(() => setTalk(null), 4200); }
    } catch (e) {}
  }, [opp.key]);

  const deal = useCallback(() => {
    let you = bank, them = oppStack;
    if (you < BB) { you = BOOT; saveBank(BOOT); say('The player went broke — the house fronts fresh chips. Have a line about it.'); }
    if (them < BB) { them = BOOT; setOppStack(BOOT); }
    const hand = newHand([you, them], dealerRef.current);
    dealerRef.current = 1 - dealerRef.current;
    setShowOpp(false); setBanner(null); setReveal(0);
    setG({ ...hand });
    buzz('tap');
  }, [bank, oppStack, say]);

  // board reveal pacing
  useEffect(() => {
    if (!g) return;
    if (g.board.length > reveal) {
      const t = setTimeout(() => { setReveal((r) => r + 1); buzz('tick'); }, 320);
      return () => clearTimeout(t);
    }
  }, [g, reveal]);

  // settle when a hand ends
  useEffect(() => {
    if (!g || g.street !== 'over' || banner) return;
    const done = () => {
      saveBank(g.stacks[0]); setOppStack(g.stacks[1]);
      if (g.result?.scores) setShowOpp(true);
      const youWin = g.winner === 0, chop = g.winner === 'chop';
      setBanner(chop ? 'A CHOP' : youWin ? `YOURS — ${g.reason.toUpperCase()}` : g.winner === 1 && g.result?.reason === 'fold' ? `${opp.name.toUpperCase()} TAKES IT` : `${opp.name.toUpperCase()} — ${String(g.reason).toUpperCase()}`);
      buzz(chop ? 'knock' : youWin ? 'win' : 'lose');
      say(youWin ? 'You just lost the pot to the player. React in character.' : chop ? 'The pot got chopped. React.' : `You just won the pot${g.result?.reason === 'fold' ? ' because they folded' : ' at showdown'}. React in character, one line.`);
    };
    const t = setTimeout(done, g.result?.scores ? 700 : 250);
    return () => clearTimeout(t);
  }, [g, banner, opp.name, say]);

  // the opponent thinks and acts
  useEffect(() => {
    if (!g || g.street === 'over' || g.toAct !== 1 || thinking.current) return;
    if (g.board.length > reveal) return;                       // let the board land first
    thinking.current = true;
    const t = setTimeout(() => {
      thinking.current = false;
      setG((cur) => {
        if (!cur || cur.toAct !== 1 || cur.street === 'over') return cur;
        const choice = chooseAction(cur, 1, styleKey);
        const next = { ...act(cur, choice) };
        if (choice.type === 'raise' || choice.type === 'bet') { buzz('knock'); if (Math.random() < 0.4) say(`You just ${choice.type === 'bet' ? 'bet' : 'raised'} into them. One needling line.`); }
        if (choice.type === 'fold') buzz('thud');
        return next;
      });
    }, 700 + Math.random() * 900);
    return () => clearTimeout(t);
  }, [g, reveal, styleKey, say]);

  const you = 0;
  const acts = g && g.street !== 'over' && g.toAct === you && g.board.length <= reveal ? legalActions(g) : [];
  const canCall = acts.find((a) => a.type === 'call');
  const canCheck = acts.find((a) => a.type === 'check');
  const canBet = acts.find((a) => a.type === 'bet' || a.type === 'raise');
  const owe = g ? g.committed[1] - g.committed[0] : 0;

  const doAct = (action) => {
    setG((cur) => {
      if (!cur || cur.toAct !== you || cur.street === 'over') return cur;
      try { return { ...act(cur, action) }; } catch (e) { return cur; }
    });
    buzz('tick');
  };
  const betTo = (mult) => {
    if (!canBet || !g) return;
    const pot = g.pot + owe;
    const target = mult === 'allin' ? canBet.maxTo : Math.round(g.committed[0] + owe + Math.max(pot * mult, BB * 2));
    doAct({ type: canBet.type, to: Math.min(Math.max(target, canBet.minTo), canBet.maxTo) });
    if (mult === 'allin') { buzz('thud'); say('The player just shoved ALL IN on you. React.'); }
  };

  const streetLabel = g ? (g.street === 'preflop' ? 'pre-flop' : g.street === 'over' ? '' : g.street) : '';

  return (
    <View style={st.root}>
      <LinearGradient colors={['#14100C', '#0E0B08', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* opponent */}
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.kicker}>hold'em · heads-up</Text>
            <Text style={st.title}>{opp.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', marginRight: 10 }}>
            <Text style={[st.stackN, { color: tone }]}>{g ? g.stacks[1] : oppStack}</Text>
            <Text style={st.stackLabel}>their chips</Text>
          </View>
          <Image source={{ uri: faceFor(opp.key) }} style={[st.face, { borderColor: tone }]} />
        </View>

        {/* their cards + speech */}
        <View style={st.oppRow}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PCard c={g?.hole[1][0]} hidden={!showOpp} small />
            <PCard c={g?.hole[1][1]} hidden={!showOpp} small />
          </View>
          {g && g.dealer === 1 && <Text style={st.button}>Ⓓ</Text>}
        </View>
        {talk && <View style={[st.talk, { borderColor: `${tone}66` }]}><Text style={st.talkTxt}>{talk}</Text></View>}

        {/* the felt */}
        <View style={st.felt}>
          <Text style={st.potN}>{g ? g.pot + g.committed[0] + g.committed[1] : 0}</Text>
          <Text style={st.potLabel}>the pot{streetLabel ? ` · ${streetLabel}` : ''}</Text>
          <View style={st.board}>
            {[0, 1, 2, 3, 4].map((i) => (
              <PCard key={i} c={g && i < reveal ? g.board[i] : null} hidden={!g || i >= reveal} />
            ))}
          </View>
          {banner && (
            <View style={[st.bannerWrap, { borderColor: `${tone}59` }]}>
              <Text style={st.bannerTxt}>{banner}</Text>
              <Pressable style={[st.nextBtn, { borderColor: `${tone}80`, backgroundColor: `${tone}1A` }]} onPress={deal}>
                <Text style={[st.nextTxt, { color: tone }]}>next hand</Text>
              </Pressable>
            </View>
          )}
          {!g && (
            <Pressable style={[st.nextBtn, { borderColor: `${tone}80`, backgroundColor: `${tone}1A`, marginTop: 18 }]} onPress={deal}>
              <Text style={[st.nextTxt, { color: tone }]}>deal me in</Text>
            </Pressable>
          )}
        </View>

        {/* you */}
        <View style={st.youRow}>
          <View style={{ alignItems: 'flex-start' }}>
            <Text style={[st.stackN, { color: C.ember }]}>{g ? g.stacks[0] : bank}</Text>
            <Text style={st.stackLabel}>your chips{g && g.dealer === 0 ? ' · Ⓓ' : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <PCard c={g?.hole[0][0]} hidden={!g} />
            <PCard c={g?.hole[0][1]} hidden={!g} />
          </View>
        </View>

        {/* action bar */}
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
          ) : g && g.street !== 'over' ? (
            <Text style={st.waiting}>{opp.name} is thinking…</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0B08' },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#E0C088', fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', opacity: 0.85 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 22 },
  face: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, backgroundColor: '#141009' },
  stackN: { fontFamily: FONTS.display, fontSize: 19, lineHeight: 21 },
  stackLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase' },

  oppRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 10 },
  button: { fontFamily: FONTS.semibold, color: '#E0C088', fontSize: 15 },
  talk: { alignSelf: 'center', marginTop: 8, maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  talkTxt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 13.5, textAlign: 'center' },

  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  potN: { fontFamily: FONTS.display, color: '#E0C088', fontSize: 30 },
  potLabel: { fontFamily: FONTS.body, color: C.faint, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase' },
  board: { flexDirection: 'row', gap: 7, marginTop: 12 },

  card: { borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#171310', alignItems: 'center', justifyContent: 'center' },
  cardBack: { backgroundColor: '#1a1409', borderColor: 'rgba(224,192,136,0.3)' },
  backGlyph: { color: 'rgba(224,192,136,0.5)', fontSize: 18 },
  cardRank: { fontFamily: FONTS.display, fontSize: 21, lineHeight: 24 },
  cardSuit: { fontSize: 17, lineHeight: 19 },

  bannerWrap: { marginTop: 16, alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, borderWidth: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, textAlign: 'center' },
  nextBtn: { marginTop: 10, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 14, borderWidth: 1 },
  nextTxt: { fontFamily: FONTS.semibold, fontSize: 14 },

  youRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 6 },
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
