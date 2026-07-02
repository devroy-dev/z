// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE BLACKJACK TABLE. Nightfall. The wannabe deals ("the house is
//  HOT tonight"); personas play their own chips beside you. Play-money only.
//  rules.js owns the game; ai.js owns co-player taste + the moments; this
//  owns the felt: bet chips → cards flip in → your dock (hit/stand/double/
//  split, only when legal) → the hole card turns with a beat → payouts.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, withSequence, Easing } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor } from '../common';
import { cardName, isRed } from '../cards/deck.js';
import { newRound, actions, act, settle, handValue } from './rules.js';
import { chooseAction, banterMoment } from './ai.js';

const BANK_KEY = 'z_bj_bank';
const CHIPS = [50, 100, 250, 500];

// ── a playing card that flips in ──
function Card({ card, hidden, delay = 0, small }) {
  const flip = useSharedValue(hidden ? 0 : 0);
  const [show, setShow] = useState(!hidden);
  useEffect(() => {
    flip.value = 0;
    const t = setTimeout(() => { flip.value = withTiming(180, { duration: 340, easing: Easing.out(Easing.cubic) }); }, delay);
    return () => clearTimeout(t);
  }, [card && cardName(card), hidden]);
  useEffect(() => { if (!hidden) setShow(true); }, [hidden]);
  const frontSt = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateY: `${flip.value - 180}deg` }], backfaceVisibility: 'hidden' }));
  const backSt = useAnimatedStyle(() => ({ transform: [{ perspective: 600 }, { rotateY: `${flip.value}deg` }], backfaceVisibility: 'hidden' }));
  const W = small ? 34 : 44, H = small ? 48 : 62;
  const showFace = card && !hidden;
  return (
    <View style={{ width: W, height: H, marginRight: -W * 0.36 }}>
      <Animated.View style={[styles.card, { width: W, height: H, position: 'absolute' }, backSt]}>
        <View style={[styles.cardBack, { width: W - 6, height: H - 6 }]} />
      </Animated.View>
      <Animated.View style={[styles.card, { width: W, height: H, position: 'absolute', backgroundColor: '#F5ECE1' }, frontSt]}>
        {showFace && (
          <Text style={[styles.cardTxt, small && { fontSize: 12 }, { color: isRed(card) ? '#B5432E' : '#22150A' }]}>
            {cardName(card)}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

function HandRow({ cards, hideHole, label, tone, total, active, small }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', paddingRight: 16, minHeight: small ? 50 : 64 }}>
        {cards.map((c, i) => <Card key={`${i}${cardName(c)}`} card={c} hidden={hideHole && i === 1} delay={i * 140} small={small} />)}
      </View>
      <Text style={[styles.handLabel, { color: active ? tone : C.faint }]} numberOfLines={1}>
        {label}{total != null ? ` · ${total}` : ''}
      </Text>
    </View>
  );
}

export default function BlackjackTable({ opponent, roster, onExit = () => {} }) {
  const pool = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : [])).filter(Boolean);
  const dealer = pool.find((p) => p.key === 'the_wannabe') || pool[0] || { key: 'the_wannabe', name: 'the wannabe hustler' };
  const coPlayers = pool.filter((p) => p.key !== dealer.key).slice(0, 2);
  const seatIds = ['you', ...coPlayers.map((p) => p.key)];

  const [bank, setBank] = useState(5000);
  const [bet, setBet] = useState(100);
  const [round, setRound] = useState(null);           // engine state
  const [stage, setStage] = useState('bet');          // bet | act | settle | over
  const [talk, setTalk] = useState(null);
  const [lastDelta, setLastDelta] = useState(null);
  const roundRef = useRef(null); useEffect(() => { roundRef.current = round; }, [round]);
  const busyRef = useRef(false);
  const banterAt = useRef(0);

  useEffect(() => { AsyncStorage.getItem(BANK_KEY).then((v) => { if (v != null) setBank(Number(v)); }).catch(() => {}); }, []);
  const saveBank = (b) => { setBank(b); AsyncStorage.setItem(BANK_KEY, String(b)).catch(() => {}); };

  const say = useCallback(async (prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6000) return;
    banterAt.current = now;
    const { line } = await banter(dealer.key, `You are DEALING blackjack at your table, play-money chips. ONE short in-character line (no quotes). ${prompt}`);
    if (line) { setTalk(line); setTimeout(() => setTalk(null), 4200); }
  }, [dealer.key]);

  const nameOf = (seat) => (seat === 0 ? 'you' : (coPlayers[seat - 1]?.name || '…'));

  const deal = () => {
    if (bet > bank || busyRef.current) return;
    busyRef.current = true;
    buzz('light');
    const st = newRound(seatIds.map((id) => ({ id, bet })), Math.random);
    setRound(st); setStage(st.phase === 'settle' ? 'settle' : 'act'); setLastDelta(null);
    say('You just dealt a fresh hand. Set the mood.');
    setTimeout(() => { busyRef.current = false; }, 900);
  };

  // drive AI seats + settlement
  useEffect(() => {
    const st = round;
    if (!st) return;
    if (st.phase === 'act') {
      const h = st.hands[st.active];
      if (h && h.id !== 'you' && !busyRef.current) {
        busyRef.current = true;
        const t = setTimeout(() => {
          const cur = roundRef.current;
          if (!cur || cur.phase !== 'act') { busyRef.current = false; return; }
          const a = chooseAction(cur, cur.hands[cur.active].id);
          const { state: s2, events } = act(cur, a);
          busyRef.current = false;
          setRound(s2);
          const bm = banterMoment(events, nameOf);
          if (bm) say(bm.line);
        }, 900 + Math.random() * 700);
        return () => { clearTimeout(t); busyRef.current = false; };
      }
    }
    if (st.phase === 'settle' && stage !== 'over') {
      const t = setTimeout(() => {
        const { state: s2, events, results } = settle(roundRef.current);
        setRound(s2); setStage('over');
        const you = results.find((r) => r.id === 'you');
        const delta = results.filter((r) => r.id === 'you').reduce((a, r) => a + r.delta, 0);
        setLastDelta(delta);
        saveBank(Math.max(0, bank + delta));
        buzz(delta > 0 ? 'win' : delta < 0 ? 'lose' : 'tap');
        const bm = banterMoment(events, nameOf);
        say(bm ? bm.line : `The hand is settled — the player ${delta > 0 ? 'won ' + delta : delta < 0 ? 'lost ' + (-delta) : 'pushed'}. React as the dealer.`);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [round, stage]);

  const yourAct = (a) => {
    const st = roundRef.current;
    if (!st || st.phase !== 'act' || busyRef.current) return;
    const h = st.hands[st.active];
    if (!h || h.id !== 'you') return;
    if (a === 'double' && bet * 2 > bank) return;      // can't double past the bank
    buzz('light');
    const { state: s2, events } = act(st, a);
    setRound(s2);
    const bm = banterMoment(events, nameOf);
    if (bm) say(bm.line);
  };

  const again = () => {
    if (bank < CHIPS[0]) { saveBank(1000); say('The player is broke — front them a fresh 1000 in house chips, with attitude.'); }
    setRound(null); setStage('bet');
  };

  const yourHands = round ? round.hands.map((h, i) => ({ h, i })).filter(({ h }) => h.id === 'you') : [];
  const activeIsYou = round?.phase === 'act' && round.hands[round.active]?.id === 'you';
  const yourActions = activeIsYou ? actions(round) : [];
  const dealerV = round ? handValue(round.dealer.revealed ? round.dealer.cards : [round.dealer.cards[0]]) : null;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#101816', '#0B100E', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.kicker}>the arena · play money</Text>
            <Text style={styles.title}>blackjack</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.bankLabel}>bank</Text>
            <Text style={styles.bank}>{bank.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        {/* the dealer */}
        <View style={styles.dealerRow}>
          <Image source={{ uri: faceFor(dealer.key) }} style={styles.dealerFace} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.dealerName}>{dealer.name} <Text style={{ color: C.faint }}>deals</Text></Text>
            {talk ? <Text style={styles.talk} numberOfLines={2}>“{talk}”</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          {round ? (
            <HandRow cards={round.dealer.cards} hideHole={!round.dealer.revealed}
              label="the house" tone={C.ember} total={round.dealer.revealed ? dealerV.total : dealerV.total + ' + ?'} />
          ) : <View style={{ height: 84 }} />}
        </View>

        {/* co-players */}
        <View style={styles.coRow}>
          {coPlayers.map((p, i) => {
            const hands = round ? round.hands.map((h, hi) => ({ h, hi })).filter(({ h }) => h.id === p.key) : [];
            const active = round?.phase === 'act' && round.hands[round.active]?.id === p.key;
            return (
              <View key={p.key} style={{ alignItems: 'center', flex: 1 }}>
                {hands.map(({ h, hi }) => (
                  <HandRow key={hi} small cards={h.cards} label={p.name} tone="#6FC9E0"
                    total={handValue(h.cards).total} active={active} />
                ))}
                {!round && <Text style={styles.handLabel}>{p.name}</Text>}
              </View>
            );
          })}
        </View>

        <View style={{ flex: 1 }} />

        {/* you */}
        <View style={{ alignItems: 'center' }}>
          {yourHands.map(({ h, i }) => (
            <HandRow key={i} cards={h.cards}
              label={`you${h.fromSplit || yourHands.length > 1 ? ` · hand ${yourHands.findIndex((x) => x.i === i) + 1}` : ''} · bet ${h.bet}`}
              tone={C.ember} total={handValue(h.cards).total}
              active={round?.phase === 'act' && round.active === i} />
          ))}
          {lastDelta != null && (
            <Text style={[styles.delta, { color: lastDelta > 0 ? '#8FD98F' : lastDelta < 0 ? '#F0708C' : C.muted }]}>
              {lastDelta > 0 ? `+${lastDelta}` : lastDelta === 0 ? 'push' : lastDelta}
            </Text>
          )}
        </View>

        {/* the dock */}
        {stage === 'bet' || stage === 'over' ? (
          <View style={styles.dock}>
            {stage === 'bet' ? (
              <>
                <View style={styles.chipRow}>
                  {CHIPS.map((c) => (
                    <Pressable key={c} onPress={() => { buzz('tick'); setBet(c); }} style={[styles.chip, bet === c && styles.chipOn, c > bank && { opacity: 0.3 }]} disabled={c > bank}>
                      <Text style={[styles.chipTxt, bet === c && { color: '#22150A' }]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable style={[styles.dealBtn, bet > bank && { opacity: 0.4 }]} onPress={deal} disabled={bet > bank}>
                  <Text style={styles.dealTxt}>deal · {bet}</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.dealBtn} onPress={again}>
                <Text style={styles.dealTxt}>{bank < CHIPS[0] ? 'take house chips' : 'next hand'}</Text>
              </Pressable>
            )}
          </View>
        ) : (
          <View style={[styles.dock, { opacity: activeIsYou ? 1 : 0.35 }]}>
            {['hit', 'stand', 'double', 'split'].map((a) => (
              <Pressable key={a} onPress={() => yourAct(a)} disabled={!yourActions.includes(a)}
                style={[styles.actBtn, !yourActions.includes(a) && { opacity: 0.25 }]}>
                <Text style={styles.actTxt}>{a}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 26 },
  bankLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  bank: { fontFamily: FONTS.display, color: C.ember, fontSize: 20 },

  dealerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 },
  dealerFace: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: C.ember, backgroundColor: '#1a121f' },
  dealerName: { fontFamily: FONTS.medium, color: C.cream, fontSize: 14.5 },
  talk: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 13, marginTop: 2 },

  coRow: { flexDirection: 'row', paddingHorizontal: 14, marginTop: 12, minHeight: 70 },

  card: { borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  cardBack: { borderRadius: 5, backgroundColor: '#5A2E1E', borderWidth: 1.5, borderColor: '#B5572E' },
  cardTxt: { fontFamily: FONTS.semibold, fontSize: 15 },
  handLabel: { fontFamily: FONTS.light, color: C.muted, fontSize: 11.5, marginTop: 3 },
  delta: { fontFamily: FONTS.display, fontSize: 22, marginTop: 4 },

  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(243,168,95,0.5)', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  chipOn: { backgroundColor: C.ember, borderStyle: 'solid' },
  chipTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 13.5 },
  dealBtn: { paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(243,168,95,0.12)', borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)' },
  dealTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 15 },
  actBtn: { paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.4)', backgroundColor: 'rgba(243,168,95,0.08)' },
  actTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 14 },
});
