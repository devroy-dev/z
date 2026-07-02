// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE BLUFF TABLE. Nightfall's most theatrical felt: the game IS
//  the personas. rules.js owns truth; ai.js owns each liar's appetite and
//  each accuser's nerves; this owns the drama — the face-down pile, the
//  draining CALL-BLUFF window, and the reveal that holds its beat before
//  the verdict lands. Haptic vocabulary throughout (tick/tap/knock/thud).
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz, faceFor, SEAT_TONES } from '../common';
import { cardName, isRed, RANK_NAME } from '../cards/deck.js';
import { newGame, legalPlays, play, pass, challenge, noChallenge } from './rules.js';
import { chooseTurn, wantsChallenge, banterMoment } from './ai.js';

const WINDOW_MS = 3200;         // your chance to call bluff
const RANKS = [2,3,4,5,6,7,8,9,10,11,12,13,14];

function MiniCard({ card, faceDown, big }) {
  const W = big ? 46 : 30, H = big ? 64 : 42;
  return (
    <View style={[st.mini, { width: W, height: H }, faceDown ? st.miniBack : { backgroundColor: '#F5ECE1' }]}>
      {!faceDown && card && (
        <Text style={{ fontFamily: FONTS.semibold, fontSize: big ? 15 : 10.5, color: isRed(card) ? '#B5432E' : '#22150A' }}>
          {cardName(card)}
        </Text>
      )}
    </View>
  );
}

function WindowBar({ running }) {
  const w = useSharedValue(1);
  useEffect(() => { w.value = 1; if (running) w.value = withTiming(0, { duration: WINDOW_MS, easing: Easing.linear }); }, [running]);
  const s = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return <View style={st.winTrack}><Animated.View style={[st.winFill, s]} /></View>;
}

export default function BluffTable({ opponent, roster, onExit = () => {} }) {
  const ais = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3);
  const cast = ais.length >= 2 ? ais : [...ais, { key: 'the_cynic', name: 'the cynic' }, { key: 'the_wannabe', name: 'the wannabe hustler' }].slice(0, Math.max(2, ais.length));
  const ids = ['you', ...cast.map((a) => a.key)];

  const [game, setGame] = useState(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; });
  const [sel, setSel] = useState([]);                 // your selected hand indexes
  const [leadRank, setLeadRank] = useState(null);
  const [windowOpen, setWindowOpen] = useState(false);
  const [reveal, setReveal] = useState(null);         // { cards, lied, by, against }
  const [talk, setTalk] = useState(null);
  const gameRef = useRef(game); useEffect(() => { gameRef.current = game; }, [game]);
  const busyRef = useRef(false);
  const windowT = useRef(null);
  const banterAt = useRef(0);
  const tones = ids.map((_, i) => SEAT_TONES[i]);
  const nameOf = (seat) => (seat === 0 ? 'the player' : (cast[seat - 1]?.name || '…'));

  const say = useCallback(async (speakerSeat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6000) return;
    banterAt.current = now;
    const key = speakerSeat === 0 ? cast[0]?.key : ids[speakerSeat];
    if (!key || key === 'you') return;
    const { line } = await banter(key, `Bluff (the lying card game) at the table. ONE short in-character line, no quotes. ${prompt}`);
    if (line) { setTalk({ seat: speakerSeat, line }); setTimeout(() => setTalk(null), 4200); }
  }, [ids]);

  const applyEvents = useCallback((events) => {
    for (const e of events) {
      if (e.type === 'challenge') {
        buzz('knock');
        setReveal({ cards: e.revealed, lied: e.lied, by: e.by, against: e.against });
        setTimeout(() => setReveal(null), 2400);       // the verdict holds its beat
      }
      if (e.type === 'pickup') buzz(e.seat === 0 ? 'lose' : 'thud');
      if (e.type === 'win') buzz(e.seat === 0 ? 'win' : 'lose');
    }
    const bm = banterMoment(events, nameOf);
    if (bm && !bm.minor) {
      const ch = events.find((e) => e.type === 'challenge');
      say(ch ? ch.by : 1, bm.line);
    }
  }, [say]);

  // ── the drive loop ──
  useEffect(() => {
    const g = game;
    if (g.winner || busyRef.current) return;

    if (g.phase === 'window') {
      const lp = g.lastPlay;
      // AI deliberation (staggered); you get the visible window on AI plays
      const others = ids.map((_, i) => i).filter((i) => i !== lp.seat && i !== 0 && g.hands[i].length > 0);
      const challengerAI = others.find((i) => wantsChallenge(g, i, ids[i]));
      const youMayCall = lp.seat !== 0 && g.hands[0].length > 0;
      setWindowOpen(youMayCall);
      busyRef.current = true;
      windowT.current = setTimeout(() => {
        busyRef.current = false; setWindowOpen(false);
        const cur = gameRef.current;
        if (cur.phase !== 'window') return;
        const out = challengerAI != null ? challenge(cur, challengerAI) : noChallenge(cur);
        applyEvents(out.events);
        setGame(out.state);
      }, lp.seat === 0 ? 1400 + Math.random() * 1200 : WINDOW_MS);
      return () => { clearTimeout(windowT.current); busyRef.current = false; };
    }

    if (g.phase === 'play' && g.turn !== 0) {
      busyRef.current = true;
      const t = setTimeout(() => {
        busyRef.current = false;
        const cur = gameRef.current;
        if (cur.phase !== 'play' || cur.turn === 0 || cur.winner) return;
        const mv = chooseTurn(cur, cur.turn, ids[cur.turn]);
        const out = mv.action === 'pass' ? pass(cur, cur.turn) : play(cur, cur.turn, mv.cardIdxs, mv.claimRank);
        buzz('tap');
        applyEvents(out.events);
        setGame(out.state);
      }, 950 + Math.random() * 850);
      return () => { clearTimeout(t); busyRef.current = false; };
    }
  }, [game, applyEvents, ids]);

  // ── your actions ──
  const toggleSel = (i) => {
    if (game.turn !== 0 || game.phase !== 'play') return;
    buzz('tick');
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : s.length < 4 ? [...s, i] : s));
  };
  const youPlay = () => {
    const g = gameRef.current;
    if (g.turn !== 0 || g.phase !== 'play' || !sel.length || busyRef.current) return;
    const { mustClaim } = legalPlays(g);
    const rank = mustClaim ?? leadRank;
    if (rank == null) return;
    buzz('tap');
    const out = play(g, 0, sel, rank);
    setSel([]); setLeadRank(null);
    applyEvents(out.events);
    setGame(out.state);
  };
  const youPass = () => {
    const g = gameRef.current;
    if (g.turn !== 0 || g.phase !== 'play' || busyRef.current) return;
    if (!legalPlays(g).canPass) return;
    buzz('tick');
    const out = pass(g, 0);
    setSel([]);
    setGame(out.state);
  };
  const youCall = () => {
    const g = gameRef.current;
    if (g.phase !== 'window' || !windowOpen) return;
    clearTimeout(windowT.current); busyRef.current = false; setWindowOpen(false);
    const out = challenge(g, 0);
    applyEvents(out.events);
    setGame(out.state);
  };

  const { mustClaim, canPass } = game.phase === 'play' ? legalPlays(game) : { mustClaim: null, canPass: false };
  const yourTurn = game.turn === 0 && game.phase === 'play' && !game.winner;
  const pileCount = game.pile.reduce((a, p) => a + p.cards.length, 0);
  const lastClaim = game.pile[game.pile.length - 1];

  return (
    <View style={st.root}>
      <LinearGradient colors={['#171019', '#100B12', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.header}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={st.kicker}>the arena</Text>
            <Text style={st.title}>bluff</Text>
          </View>
        </View>

        {/* opponents */}
        <View style={st.seats}>
          {cast.map((p, i) => {
            const seat = i + 1;
            return (
              <View key={p.key} style={[st.seat, game.turn === seat && !game.winner && { borderColor: tones[seat], backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                <Image source={{ uri: faceFor(p.key) }} style={[st.face, { borderColor: tones[seat] }]} />
                <Text style={st.seatName} numberOfLines={1}>{p.name}</Text>
                <Text style={st.seatCards}>{game.hands[seat].length} cards</Text>
              </View>
            );
          })}
        </View>

        <View style={st.talkRow}>
          {talk ? <Text style={[st.talk, { color: tones[talk.seat] || C.accentSoft }]} numberOfLines={2}>“{talk.line}”</Text> : <Text style={st.talkGhost}> </Text>}
        </View>

        {/* the pile + claim */}
        <View style={st.center}>
          {reveal ? (
            <View style={st.revealBox}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {reveal.cards.map((c, i) => <MiniCard key={i} card={c} big />)}
              </View>
              <Text style={[st.verdict, { color: reveal.lied ? '#F0708C' : '#8FD98F' }]}>
                {reveal.lied ? 'LIE.' : 'TRUTH.'}
              </Text>
              <Text style={st.verdictSub}>
                {reveal.lied ? `${nameOf(reveal.against)} picks up the pile` : `${nameOf(reveal.by)} eats the pile`}
              </Text>
            </View>
          ) : (
            <>
              <View style={{ flexDirection: 'row' }}>
                {Array.from({ length: Math.min(pileCount, 7) }).map((_, i) => (
                  <View key={i} style={{ marginLeft: i ? -22 : 0, transform: [{ rotate: `${(i - 3) * 4}deg` }] }}>
                    <MiniCard faceDown />
                  </View>
                ))}
                {pileCount === 0 && <Text style={st.pileEmpty}>fresh table</Text>}
              </View>
              {lastClaim && (
                <Text style={st.claimLine}>
                  {nameOf(lastClaim.seat)} claims <Text style={{ color: C.ember }}>{lastClaim.claimCount} × {RANK_NAME[lastClaim.claimRank]}</Text> · pile {pileCount}
                </Text>
              )}
            </>
          )}
          {windowOpen && !reveal && (
            <View style={{ alignItems: 'center', marginTop: 10, width: '70%' }}>
              <Pressable style={st.callBtn} onPress={youCall}>
                <Text style={st.callTxt}>CALL BLUFF</Text>
              </Pressable>
              <WindowBar running={windowOpen} />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }} />

        {/* your dock */}
        {game.winner ? (
          <View style={st.resultRow}>
            <Text style={st.resultLine}>{game.winner === 'you' ? 'clean hands. you win. 🃏' : `${cast.find((c) => c.key === game.winner)?.name || game.winner} got away with it.`}</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable style={st.playBtn} onPress={() => { setGame(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; }); setSel([]); setLeadRank(null); }}>
                <Text style={st.playTxt}>play again</Text>
              </Pressable>
              <Pressable style={[st.playBtn, { borderColor: 'rgba(255,255,255,0.15)', backgroundColor: 'transparent' }]} onPress={onExit}>
                <Text style={[st.playTxt, { color: C.muted }]}>leave</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {yourTurn && mustClaim === null && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.rankRow}>
                {RANKS.map((r) => (
                  <Pressable key={r} onPress={() => { buzz('tick'); setLeadRank(r); }} style={[st.rank, leadRank === r && st.rankOn]}>
                    <Text style={[st.rankTxt, leadRank === r && { color: '#22150A' }]}>{RANK_NAME[r]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={st.actRow}>
              <Text style={st.prompt} numberOfLines={1}>
                {yourTurn
                  ? (mustClaim ? `play as ${RANK_NAME[mustClaim]} — or pass` : leadRank ? `leading with ${RANK_NAME[leadRank]}` : 'pick a rank to lead')
                  : game.phase === 'window' ? ' ' : `${nameOf(game.turn)} is thinking…`}
              </Text>
              {yourTurn && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {canPass && <Pressable style={[st.playBtn, { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.2)' }]} onPress={youPass}><Text style={[st.playTxt, { color: C.muted }]}>pass</Text></Pressable>}
                  <Pressable style={[st.playBtn, (!sel.length || (mustClaim === null && !leadRank)) && { opacity: 0.35 }]} onPress={youPlay} disabled={!sel.length || (mustClaim === null && !leadRank)}>
                    <Text style={st.playTxt}>play {sel.length || ''}</Text>
                  </Pressable>
                </View>
              )}
            </View>
            {/* your hand */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hand}>
              {game.hands[0].map((c, i) => (
                <Pressable key={`${i}${cardName(c)}`} onPress={() => toggleSel(i)}
                  style={[st.handCard, sel.includes(i) && st.handCardUp]}>
                  <Text style={{ fontFamily: FONTS.semibold, fontSize: 14, color: isRed(c) ? '#B5432E' : '#22150A' }}>{cardName(c)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
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

  seats: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingTop: 6 },
  seat: { flex: 1, alignItems: 'center', padding: 8, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  face: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, backgroundColor: '#1a121f' },
  seatName: { fontFamily: FONTS.medium, color: C.muted, fontSize: 11.5, marginTop: 4 },
  seatCards: { fontFamily: FONTS.light, color: C.faint, fontSize: 10.5, marginTop: 1 },

  talkRow: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 3 },
  talk: { fontFamily: FONTS.displayItalic, fontSize: 13.5, textAlign: 'center' },
  talkGhost: { fontSize: 13.5 },

  center: { alignItems: 'center', paddingTop: 8, minHeight: 150, justifyContent: 'center' },
  mini: { borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  miniBack: { backgroundColor: '#5A2E1E', borderColor: '#B5572E', borderWidth: 1.5 },
  pileEmpty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13 },
  claimLine: { fontFamily: FONTS.body, color: C.muted, fontSize: 13, marginTop: 10 },
  revealBox: { alignItems: 'center' },
  verdict: { fontFamily: FONTS.display, fontSize: 30, marginTop: 10, letterSpacing: 1 },
  verdictSub: { fontFamily: FONTS.light, color: C.muted, fontSize: 12.5, marginTop: 2 },
  callBtn: { paddingHorizontal: 30, paddingVertical: 13, borderRadius: 16, backgroundColor: 'rgba(240,112,140,0.16)', borderWidth: 1.5, borderColor: '#F0708C' },
  callTxt: { fontFamily: FONTS.semibold, color: '#F0708C', fontSize: 15, letterSpacing: 1.5 },
  winTrack: { height: 3, width: '100%', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  winFill: { height: 3, backgroundColor: '#F0708C', borderRadius: 2 },

  rankRow: { paddingHorizontal: 14, gap: 6, paddingBottom: 8 },
  rank: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(243,168,95,0.4)', alignItems: 'center', justifyContent: 'center' },
  rankOn: { backgroundColor: C.ember, borderColor: C.ember },
  rankTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 13 },

  actRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  prompt: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 13.5, flex: 1, marginRight: 10 },
  playBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)', backgroundColor: 'rgba(243,168,95,0.1)' },
  playTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 14 },

  hand: { paddingHorizontal: 14, gap: 6, paddingBottom: 10, paddingTop: 14 },
  handCard: { width: 46, height: 64, borderRadius: 7, backgroundColor: '#F5ECE1', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  handCardUp: { transform: [{ translateY: -12 }], borderColor: C.ember, borderWidth: 2 },

  resultRow: { alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16 },
  resultLine: { fontFamily: FONTS.display, color: C.cream, fontSize: 17, textAlign: 'center' },
});
