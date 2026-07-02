// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TEEN PATTI TABLE. The crown of the Arena. Nightfall felt,
//  the pot burning center, and the game's soul intact: your three cards
//  stay FACE DOWN until you choose to look — riding blind is a real choice
//  with real odds. rules.js owns the money; ai.js owns each player's nerve;
//  /banter owns the taunts. Play-money only.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor, SEAT_TONES } from '../common';
import { cardName, isRed } from '../cards/deck.js';
import { newHand, available, act, sideshowReply } from './rules.js';
import { chooseMove, acceptSideshow, banterMoment } from './ai.js';
import { handName } from './eval.js';

const BANK_KEY = 'z_tp_bank';
const BOOT = 10;

function TPCard({ card, faceDown, big, delay = 0 }) {
  const flip = useSharedValue(faceDown ? 0 : 180);
  useEffect(() => {
    if (!faceDown) { const t = setTimeout(() => { flip.value = withTiming(180, { duration: 380, easing: Easing.out(Easing.cubic) }); }, delay); return () => clearTimeout(t); }
    flip.value = 0;
  }, [faceDown]);
  const back = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateY: `${flip.value}deg` }], backfaceVisibility: 'hidden' }));
  const front = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateY: `${flip.value - 180}deg` }], backfaceVisibility: 'hidden' }));
  const W = big ? 58 : 30, H = big ? 82 : 42;
  return (
    <View style={{ width: W, height: H }}>
      <Animated.View style={[st.card, { width: W, height: H, position: 'absolute' }, back]}>
        <View style={[st.cardBack, { width: W - 6, height: H - 6 }]} />
      </Animated.View>
      <Animated.View style={[st.card, { width: W, height: H, position: 'absolute', backgroundColor: '#F5ECE1' }, front]}>
        {card && <Text style={{ fontFamily: FONTS.semibold, fontSize: big ? 16 : 10.5, color: isRed(card) ? '#B5432E' : '#22150A' }}>{cardName(card)}</Text>}
      </Animated.View>
    </View>
  );
}

function PotGlow({ amount, stake }) {
  const b = useSharedValue(0.6);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const glow = useAnimatedStyle(() => ({ opacity: 0.5 + b.value * 0.5 }));
  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={glow}>
        <Text style={st.pot}>{amount.toLocaleString('en-IN')}</Text>
      </Animated.View>
      <Text style={st.stake}>stake {stake}</Text>
    </View>
  );
}

export default function TeenPattiTable({ opponent, roster, onExit = () => {} }) {
  const ais = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3);
  const cast = ais.length >= 2 ? ais : [...ais, { key: 'the_wannabe', name: 'the wannabe hustler' }, { key: 'the_cynic', name: 'the cynic' }].slice(0, Math.max(2, ais.length));
  const ids = ['you', ...cast.map((a) => a.key)];

  const [bank, setBank] = useState(5000);
  const [aiStacks, setAiStacks] = useState(() => cast.map(() => 5000));
  const [hand, setHand] = useState(null);            // engine state
  const [seen, setSeen] = useState(false);           // have YOU looked
  const [showdown, setShowdown] = useState(null);    // { hands, winnerSeat, tie }
  const [talk, setTalk] = useState(null);
  const [ssAsk, setSsAsk] = useState(false);         // AI asked YOU for a sideshow
  const handRef = useRef(null); useEffect(() => { handRef.current = hand; }, [hand]);
  const busyRef = useRef(false);
  const banterAt = useRef(0);
  const tones = ids.map((_, i) => SEAT_TONES[i]);
  const nameOf = (seat) => (seat === 0 ? 'the player' : (cast[seat - 1]?.name || '…'));

  useEffect(() => { AsyncStorage.getItem(BANK_KEY).then((v) => { if (v != null) setBank(Number(v)); }).catch(() => {}); }, []);
  const saveBank = (b) => { setBank(b); AsyncStorage.setItem(BANK_KEY, String(b)).catch(() => {}); };

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6500) return;
    banterAt.current = now;
    const key = seat > 0 ? ids[seat] : (cast[0]?.key);
    if (!key || key === 'you') return;
    const { line } = await banter(key, `Teen Patti table, play-money chips, mid-hand. ONE short in-character line, no quotes. ${prompt}`);
    if (line) { setTalk({ seat: seat > 0 ? seat : 1, line }); setTimeout(() => setTalk(null), 4200); }
  }, [ids]);

  const settle = useCallback((finalState, events) => {
    const winSeat = finalState.players.findIndex((p) => p.id === finalState.winner);
    const showE = events.find((e) => e.type === 'show');
    if (showE) setShowdown({ hands: showE.hands, by: showE.by, against: showE.against, winnerSeat: winSeat, tie: showE.tie });
    const youDelta = finalState.players[0].stack - (bank - 0);   // stacks already track deltas below
  }, [bank]);

  const applyOut = useCallback((out) => {
    for (const e of out.events) {
      if (e.type === 'bet') buzz(e.raise ? 'knock' : 'tap');
      if (e.type === 'pack' && e.seat === 0) buzz('tick');
      if (e.type === 'show' || e.type === 'sideshowAsk') buzz('knock');
      if (e.type === 'sideshowResult' && e.loser === 0) buzz('thud');
      if (e.type === 'win') buzz(e.seat === 0 ? 'win' : 'lose');
      if (e.type === 'show') setShowdown({ hands: e.hands, by: e.by, against: e.against, tie: e.tie });
      if (e.type === 'sideshowAsk' && e.to === 0) setSsAsk(true);
    }
    const bm = banterMoment(out.events, nameOf);
    if (bm && !bm.minor) {
      const anchor = out.events.find((e) => ['win','show','sideshowResult','sideshowDecline','bet'].includes(e.type));
      const seat = anchor?.seat ?? anchor?.by ?? anchor?.from ?? 1;
      say(seat === 0 ? 1 : seat, bm.line);
    }
    setHand(out.state);
    if (out.state.phase === 'over') {
      const ws = out.state.players.findIndex((p) => p.id === out.state.winner);
      setShowdown((sd) => sd ? { ...sd, winnerSeat: ws } : sd);
      // bank the deltas
      saveBank(Math.max(0, bank + (out.state.players[0].stack - stackAtDeal.current[0])));
      setAiStacks(cast.map((_, i) => Math.max(0, aiStacks[i] + (out.state.players[i + 1].stack - stackAtDeal.current[i + 1]))));
    }
  }, [say, bank, aiStacks, cast]);

  const stackAtDeal = useRef([]);

  const deal = () => {
    if (busyRef.current) return;
    if (bank < BOOT) { saveBank(1000); say(1, 'The player went broke — the house fronts them 1000 in chips. Have a line about it.'); return; }
    const seats = [{ id: 'you', stack: bank }, ...cast.map((p, i) => ({ id: p.key, stack: Math.max(aiStacks[i], 1000) }))];
    const h = newHand(seats, { boot: BOOT });
    h.turn = Math.floor(Math.random() * ids.length);
    stackAtDeal.current = seats.map((s) => s.stack - BOOT);
    setHand(h); setSeen(false); setShowdown(null); setSsAsk(false);
    buzz('tap');
  };

  // ── AI drive loop ──
  useEffect(() => {
    const h = hand;
    if (!h || h.phase === 'over' || busyRef.current) return;
    if (h.phase === 'sideshow') {
      const to = h.pendingSideshow.to;
      if (to === 0) return;                            // waiting on YOUR accept/decline
      busyRef.current = true;
      const t = setTimeout(() => {
        busyRef.current = false;
        const cur = handRef.current;
        if (!cur || cur.phase !== 'sideshow') return;
        applyOut(sideshowReply(cur, acceptSideshow(cur, to, ids[to])));
      }, 1100 + Math.random() * 900);
      return () => { clearTimeout(t); busyRef.current = false; };
    }
    if (h.turn !== 0) {
      busyRef.current = true;
      const t = setTimeout(() => {
        busyRef.current = false;
        const cur = handRef.current;
        if (!cur || cur.phase !== 'act' || cur.turn === 0) return;
        let mv = chooseMove(cur, ids[cur.turn]);
        let out = act(cur, mv);
        if (mv.t === 'see') {                          // seeing keeps the turn — act again after a beat
          setHand(out.state);
          return;
        }
        applyOut(out);
      }, 1000 + Math.random() * 1100);                 // the tension beat
      return () => { clearTimeout(t); busyRef.current = false; };
    }
  }, [hand, applyOut, ids]);

  // ── your actions ──
  const youAct = (mv) => {
    const h = handRef.current;
    if (!h || h.phase !== 'act' || h.turn !== 0 || busyRef.current) return;
    if (mv.t === 'see') { setSeen(true); buzz('tick'); setHand(act(h, mv).state); return; }
    applyOut(act(h, mv));
  };
  const youSideshowReply = (accept) => {
    const h = handRef.current;
    if (!h || h.phase !== 'sideshow' || h.pendingSideshow?.to !== 0) return;
    setSsAsk(false); buzz('tick');
    applyOut(sideshowReply(h, accept));
  };

  const you = hand?.players[0];
  const yourMoves = hand && hand.phase === 'act' && hand.turn === 0 ? available(hand) : [];
  const mv = (t) => yourMoves.find((m) => m.t === t);
  const flat = yourMoves.find((m) => m.t === 'bet' && !m.raise);
  const raise = yourMoves.find((m) => m.t === 'bet' && m.raise);

  return (
    <View style={st.root}>
      <LinearGradient colors={['#1B0F14', '#120A0E', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.header}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.kicker}>the arena · play money</Text>
            <Text style={st.title}>teen patti</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.bankLabel}>bank</Text>
            <Text style={st.bank}>{bank.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* opponents */}
        <View style={st.seats}>
          {cast.map((p, i) => {
            const seat = i + 1;
            const pl = hand?.players[seat];
            return (
              <View key={p.key} style={[st.seat, hand && hand.turn === seat && hand.phase === 'act' && { borderColor: tones[seat], backgroundColor: 'rgba(255,255,255,0.05)' }, pl?.packed && { opacity: 0.35 }]}>
                <Image source={{ uri: faceFor(p.key) }} style={[st.face, { borderColor: tones[seat] }]} />
                <Text style={st.seatName} numberOfLines={1}>{p.name}</Text>
                <Text style={st.seatSub}>{pl ? (pl.packed ? 'packed' : pl.blind ? 'blind' : 'seen') : ' '}</Text>
                {showdown && showdown.hands[seat] && (
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                    {showdown.hands[seat].map((c, ci) => <TPCard key={ci} card={c} faceDown={false} delay={ci * 120} />)}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={st.talkRow}>
          {talk ? <Text style={[st.talk, { color: tones[talk.seat] || C.accentSoft }]} numberOfLines={2}>“{talk.line}”</Text> : <Text style={st.talkGhost}> </Text>}
        </View>

        {/* the pot */}
        <View style={{ alignItems: 'center', minHeight: 90, justifyContent: 'center' }}>
          {hand ? <PotGlow amount={hand.pot} stake={hand.stake} /> : <Text style={st.tableEmpty}>the table waits</Text>}
          {showdown && (
            <Text style={st.verdict}>
              {showdown.tie ? 'dead even — the asker loses' :
                showdown.winnerSeat != null ? `${showdown.winnerSeat === 0 ? 'you' : nameOf(showdown.winnerSeat)} — ${handName(showdown.hands[showdown.winnerSeat] || hand.players[showdown.winnerSeat].cards)}` : ''}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {/* your cards */}
        {hand && (
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {you.cards.map((c, i) => <TPCard key={i} card={c} big faceDown={!seen && !showdown?.hands?.[0]} delay={i * 140} />)}
            </View>
            <Text style={st.youLine}>
              {you.packed ? 'packed' : seen ? handName(you.cards) : 'riding blind'} · in for {you.contributed}
            </Text>
          </View>
        )}

        {/* sideshow incoming */}
        {ssAsk && hand?.phase === 'sideshow' && (
          <View style={st.ssRow}>
            <Text style={st.ssLabel}>{nameOf(hand.pendingSideshow.from)} wants a sideshow — compare hands privately, loser packs</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={st.actBtn} onPress={() => youSideshowReply(true)}><Text style={st.actTxt}>accept</Text></Pressable>
              <Pressable style={[st.actBtn, st.actGhost]} onPress={() => youSideshowReply(false)}><Text style={[st.actTxt, { color: C.muted }]}>refuse</Text></Pressable>
            </View>
          </View>
        )}

        {/* dock */}
        {!hand || hand.phase === 'over' ? (
          <View style={st.dock}>
            {hand?.phase === 'over' && (
              <Text style={st.resultLine}>
                {hand.winner === 'you' ? `you take the pot 🏆` : `${cast.find((c) => c.key === hand.winner)?.name || ''} takes it`}
              </Text>
            )}
            <Pressable style={st.dealBtn} onPress={deal}>
              <Text style={st.dealTxt}>{bank < BOOT ? 'take house chips' : hand ? 'next hand' : `deal · boot ${BOOT}`}</Text>
            </Pressable>
          </View>
        ) : hand.turn === 0 && hand.phase === 'act' ? (
          <View style={st.dockWrap}>
            <View style={st.dock}>
              {mv('see') && <Pressable style={st.actBtn} onPress={() => youAct({ t: 'see' })}><Text style={st.actTxt}>see cards</Text></Pressable>}
              {flat && <Pressable style={st.actBtn} onPress={() => youAct(flat)}><Text style={st.actTxt}>{you.blind ? 'blind' : 'chaal'} · {flat.amt}</Text></Pressable>}
              {raise && <Pressable style={st.actBtn} onPress={() => youAct(raise)}><Text style={st.actTxt}>raise · {raise.amt}</Text></Pressable>}
            </View>
            <View style={st.dock}>
              {mv('sideshow') && <Pressable style={[st.actBtn, st.actAlt]} onPress={() => youAct(mv('sideshow'))}><Text style={[st.actTxt, { color: '#6FC9E0' }]}>sideshow · {mv('sideshow').amt}</Text></Pressable>}
              {mv('show') && <Pressable style={[st.actBtn, st.actAlt2]} onPress={() => youAct(mv('show'))}><Text style={[st.actTxt, { color: '#F0708C' }]}>show · {mv('show').amt}</Text></Pressable>}
              <Pressable style={[st.actBtn, st.actGhost]} onPress={() => youAct({ t: 'pack' })}><Text style={[st.actTxt, { color: C.muted }]}>pack</Text></Pressable>
            </View>
          </View>
        ) : (
          <View style={st.dock}>
            <Text style={st.waitLine}>{hand.phase === 'sideshow' ? 'a quiet comparison…' : `${nameOf(hand.turn)} is thinking…`}</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 26 },
  bankLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  bank: { fontFamily: FONTS.display, color: C.ember, fontSize: 20 },

  seats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 6 },
  seat: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', minHeight: 96 },
  face: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, backgroundColor: '#1a121f' },
  seatName: { fontFamily: FONTS.medium, color: C.muted, fontSize: 11.5, marginTop: 4 },
  seatSub: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5, marginTop: 1 },

  talkRow: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 3 },
  talk: { fontFamily: FONTS.displayItalic, fontSize: 13.5, textAlign: 'center' },
  talkGhost: { fontSize: 13.5 },

  pot: { fontFamily: FONTS.display, color: C.ember, fontSize: 40, textShadowColor: 'rgba(243,168,95,0.5)', textShadowRadius: 18 },
  stake: { fontFamily: FONTS.light, color: C.faint, fontSize: 12, marginTop: 2, letterSpacing: 1 },
  tableEmpty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 14 },
  verdict: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14.5, marginTop: 8 },

  youLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5, marginTop: 8 },

  ssRow: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 12 },
  ssLabel: { fontFamily: FONTS.body, color: C.cream, fontSize: 13, textAlign: 'center' },

  dockWrap: { gap: 8, paddingTop: 12 },
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, flexWrap: 'wrap', paddingVertical: 4 },
  actBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)', backgroundColor: 'rgba(243,168,95,0.1)' },
  actAlt: { borderColor: 'rgba(111,201,224,0.5)', backgroundColor: 'rgba(111,201,224,0.08)' },
  actAlt2: { borderColor: 'rgba(240,112,140,0.5)', backgroundColor: 'rgba(240,112,140,0.08)' },
  actGhost: { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' },
  actTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 13.5 },
  dealBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(243,168,95,0.12)', borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)' },
  dealTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 15 },
  resultLine: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, width: '100%', textAlign: 'center', marginBottom: 6 },
  waitLine: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 13.5, paddingVertical: 12 },

  card: { borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  cardBack: { borderRadius: 5, backgroundColor: '#5A2E1E', borderWidth: 1.5, borderColor: '#B5572E' },
});
