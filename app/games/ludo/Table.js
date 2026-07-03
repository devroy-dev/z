// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE LUDO TABLE. Nightfall. rules.js owns the game; ai.js owns
//  the opponents' taste; /banter owns their mouths; this owns the felt.
//  • 15×15 board from boardMap (proven geometry), SVG, per-seat tones
//  • tokens glide on springs; captured tokens fly home
//  • the die tumbles as a 2.5D illusion and SETTLES with a beat — nothing
//    machine-speed (the pacing law); AI thinks before it moves
//  • your legal tokens pulse; tap to move; no-move turns pass with a breath
//  • banter bubbles on capture / home / win, throttled
//  Skia polish pass comes AFTER the APK proves Skia renders (protocol §1).
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Path, Polygon, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withRepeat, Easing, runOnJS,
} from 'react-native-reanimated';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { Die, buzz, faceFor, SEAT_TONES } from '../common';
import { newGame, roll, legalMoves, applyMove, passTurn } from './rules.js';
import { chooseMove, banterEvent } from './ai.js';
import { RING, LANES, CENTER, YARDS, YARD_RECTS, cellFor } from './boardMap.js';


const { width: SCREEN_W } = Dimensions.get('window');
const BOARD = Math.min(SCREEN_W - 20, 400);
const CELL = BOARD / 15;
const STARS = new Set([8, 21, 34, 47].map((i) => RING[i].join(',')));
const STARTS = new Set([0, 13, 26, 39].map((i) => RING[i].join(',')));
const xy = ([r, c]) => ({ x: c * CELL, y: r * CELL });


// ── one token: springs to wherever (seat, steps) says it lives ──
function Token({ seat, idx, steps, tone, pulsing, onPress, stack }) {
  const target = steps === 0 ? xy(YARDS[seat][idx]) : xy(cellFor(seat, steps));
  const ox = (stack.n > 1 ? (stack.i - (stack.n - 1) / 2) * 6 : 0);
  const x = useSharedValue(target.x), y = useSharedValue(target.y);
  const pulse = useSharedValue(1);
  useEffect(() => {
    x.value = withSpring(target.x + ox, { damping: 14, stiffness: 120 });
    y.value = withSpring(target.y, { damping: 14, stiffness: 120 });
  }, [target.x, target.y, ox]);
  useEffect(() => {
    pulse.value = pulsing ? withRepeat(withTiming(1.22, { duration: 480, easing: Easing.inOut(Easing.ease) }), -1, true) : withTiming(1, { duration: 160 });
  }, [pulsing]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: pulse.value }] }));
  const S = CELL * 0.78, off = (CELL - S) / 2;
  return (
    <Animated.View pointerEvents={pulsing ? 'auto' : 'none'} style={[{ position: 'absolute', left: off, top: off, width: S, height: S }, st]}>
      <Pressable onPress={onPress} disabled={!pulsing} style={{ flex: 1 }}>
        <Svg width={S} height={S} viewBox="0 0 30 30">
          <Defs>
            <RadialGradient id={`tk${seat}${idx}`} cx="38%" cy="30%" r="75%">
              <Stop offset="0%" stopColor="#FFF" stopOpacity="0.9" />
              <Stop offset="35%" stopColor={tone} />
              <Stop offset="100%" stopColor="#1a1016" />
            </RadialGradient>
          </Defs>
          <Circle cx="15" cy="16.5" r="11" fill="#000" opacity="0.35" />
          <Circle cx="15" cy="15" r="11" fill={`url(#tk${seat}${idx})`} />
          <Circle cx="15" cy="15" r="11" fill="none" stroke={pulsing ? '#FFE6C4' : 'rgba(0,0,0,0.4)'} strokeWidth={pulsing ? 1.8 : 1} />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

// ── the board face: yards, ring, stars, lanes, center — all SVG ──
function BoardFace({ tones }) {
  const cells = [];
  RING.forEach(([r, c], i) => {
    const k = `${r},${c}`;
    const isStart = STARTS.has(k), isStar = STARS.has(k);
    const startSeat = [0, 13, 26, 39].indexOf(i);
    cells.push(
      <Rect key={`rg${i}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} rx={2}
        fill={isStart ? tones[startSeat] : 'rgba(245,236,225,0.055)'}
        fillOpacity={isStart ? 0.35 : 1}
        stroke="rgba(245,236,225,0.13)" strokeWidth="0.7" />
    );
    if (isStar) cells.push(
      <Path key={`st${i}`} transform={`translate(${c * CELL + CELL / 2}, ${r * CELL + CELL / 2}) scale(${CELL / 30})`}
        d="M0,-8 L2.2,-2.6 L8,-2.2 L3.6,1.6 L5,7.4 L0,4.2 L-5,7.4 L-3.6,1.6 L-8,-2.2 L-2.2,-2.6 Z"
        fill="rgba(245,236,225,0.35)" />
    );
  });
  LANES.forEach((lane, s) => lane.forEach(([r, c], i) => cells.push(
    <Rect key={`ln${s}${i}`} x={c * CELL} y={r * CELL} width={CELL} height={CELL} rx={2}
      fill={tones[s]} fillOpacity={0.22 + i * 0.05} stroke="rgba(245,236,225,0.12)" strokeWidth="0.7" />
  )));
  return (
    <Svg width={BOARD} height={BOARD} style={StyleSheet.absoluteFill}>
      {YARD_RECTS.map(([r, c, h, w], s) => (
        <React.Fragment key={`yd${s}`}>
          <Rect x={c * CELL} y={r * CELL} width={w * CELL} height={h * CELL} rx={14}
            fill={tones[s]} fillOpacity="0.09" stroke={tones[s]} strokeOpacity="0.35" strokeWidth="1.2" />
          {YARDS[s].map(([yr, yc], i) => (
            <Circle key={i} cx={yc * CELL + CELL / 2} cy={yr * CELL + CELL / 2} r={CELL * 0.44}
              fill="rgba(0,0,0,0.3)" stroke={tones[s]} strokeOpacity="0.4" strokeWidth="1" />
          ))}
        </React.Fragment>
      ))}
      {cells}
      {/* center: four triangles meeting */}
      {[[0,1],[1,2],[2,3],[3,0]].map(([a], s) => null)}
      <Polygon points={`${6*CELL},${6*CELL} ${9*CELL},${6*CELL} ${7.5*CELL},${7.5*CELL}`} fill={tones[1]} fillOpacity="0.5" />
      <Polygon points={`${9*CELL},${6*CELL} ${9*CELL},${9*CELL} ${7.5*CELL},${7.5*CELL}`} fill={tones[2]} fillOpacity="0.5" />
      <Polygon points={`${6*CELL},${9*CELL} ${9*CELL},${9*CELL} ${7.5*CELL},${7.5*CELL}`} fill={tones[3]} fillOpacity="0.5" />
      <Polygon points={`${6*CELL},${6*CELL} ${6*CELL},${9*CELL} ${7.5*CELL},${7.5*CELL}`} fill={tones[0]} fillOpacity="0.5" />
      <Rect x={6*CELL} y={6*CELL} width={3*CELL} height={3*CELL} fill="none" stroke="rgba(245,236,225,0.2)" strokeWidth="1" />
    </Svg>
  );
}

function Seat({ name, pkey, tone, active, isYou, tokensHome, thought }) {
  const [ok, setOk] = useState(true);
  return (
    <View style={[styles.seat, active && { borderColor: tone, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
      {isYou || !ok ? (
        <View style={[styles.seatFace, { borderColor: tone, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 15 }}>{isYou ? 'you'[0].toUpperCase() : (name || '?')[0].toUpperCase()}</Text>
        </View>
      ) : (
        <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)} style={[styles.seatFace, { borderColor: tone }]} />
      )}
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[styles.seatName, active && { color: C.cream }]} numberOfLines={1}>{name}</Text>
        <Text style={styles.seatHome}>{tokensHome}/4 home{thought ? '  ·  …' : ''}</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function LudoTable({ opponent, roster, onExit = () => {} }) {
  const ais = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3);
  const seatsRef = useRef(null);
  if (!seatsRef.current) {
    // randomize who rolls first (the sim showed real first-mover advantage)
    const ids = ['you', ...ais.map((a) => a.key)];
    seatsRef.current = { ids, firstOffset: Math.floor(Math.random() * ids.length) };
  }
  const { ids } = seatsRef.current;
  const seatName = (seat) => seat === youSeat ? 'you' : (ais.find((a) => a.key === ids[seat])?.name || ids[seat]);
  const youSeat = 0;

  const [game, setGame] = useState(() => {
    let g = newGame(ids);
    g.turn = seatsRef.current.firstOffset;   // randomized opener
    return g;
  });
  const [rolling, setRolling] = useState(false);
  const [pulseTokens, setPulseTokens] = useState([]);   // your legal token idxs
  const [talk, setTalk] = useState(null);               // { seat, line }
  const [thinking, setThinking] = useState(null);       // seat currently "thinking"
  const gameRef = useRef(game);
  const busyRef = useRef(false);
  const banterAt = useRef(0);
  useEffect(() => { gameRef.current = game; }, [game]);

  const tones = ids.map((_, i) => SEAT_TONES[i]);

  const say = useCallback(async (seat, event, detail) => {
    const now = Date.now();
    if (now - banterAt.current < 6500) return;          // throttle: a table, not a podcast
    banterAt.current = now;
    const pkey = ids[seat]; if (pkey === 'you') return;
    const prompt = `Ludo table, quick in-character table-talk (ONE short line, no quotes). Event: ${event}. ${detail || ''}`;
    const { line } = await banter(pkey, prompt);
    if (line) { setTalk({ seat, line }); setTimeout(() => setTalk((t) => (t && t.seat === seat ? null : t)), 4200); }
  }, [ids]);

  // ── advance the game: whoever's turn it is, run their beat ──
  const step = useCallback(() => {
    const g = gameRef.current;
    if (g.winner || busyRef.current) return;
    if (g.turn === youSeat) {
      if (g.phase === 'move') {
        const mv = legalMoves(g);
        if (!mv.length) {                                // no moves: breathe, pass
          busyRef.current = true;
          setTimeout(() => { busyRef.current = false; setGame(passTurn(g)); }, 700);
          return;
        }
        setPulseTokens(mv.map((m) => m.token));
      }
      return;                                            // waits for your tap (roll or token)
    }
    // AI seat — the beat before acting (pacing law)
    busyRef.current = true;
    setThinking(g.turn);
    setTimeout(() => {
      let cur = gameRef.current;
      if (cur.winner) { busyRef.current = false; setThinking(null); return; }
      if (cur.phase === 'roll') {
        setRolling(true);
        const out = roll(cur);
        setTimeout(() => {
          setRolling(false); buzz('light');
          setGame(out.state); busyRef.current = false; setThinking(null);
          if (out.forfeited) say(cur.turn, 'rolled three sixes in a row and forfeited the turn');
        }, 760);
      } else {
        const tok = chooseMove(cur, ids[cur.turn]);
        if (tok == null) { setGame(passTurn(cur)); busyRef.current = false; setThinking(null); return; }
        const { state: s2, events } = applyMove(cur, tok);
        const be = banterEvent(events);
        if (events.some((e) => e.type === 'capture')) buzz('heavy');
        setGame(s2); busyRef.current = false; setThinking(null);
        if (be) {
          const victimYou = be.detail.victimSeat === youSeat;
          say(cur.turn, be.event === 'capture' ? `just captured ${victimYou ? "the player's" : seatName(be.detail.victimSeat) + "'s"} token` : be.event === 'home' ? 'brought a token home' : 'won the game');
        }
      }
    }, 850 + Math.random() * 700);
  }, [ids, say]);

  useEffect(() => { const t = setTimeout(step, 250); return () => clearTimeout(t); }, [game, step]);

  // ── your actions ──
  const youRoll = () => {
    const g = gameRef.current;
    if (g.turn !== youSeat || g.phase !== 'roll' || busyRef.current || g.winner) return;
    busyRef.current = true; setRolling(true); buzz('light');
    const out = roll(g);
    setTimeout(() => {
      setRolling(false); setGame(out.state); busyRef.current = false;
      if (out.forfeited) buzz('heavy');
    }, 760);
  };
  const youMove = (tokenIdx) => {
    const g = gameRef.current;
    if (g.turn !== youSeat || g.phase !== 'move' || g.winner) return;
    if (!pulseTokens.includes(tokenIdx)) return;
    setPulseTokens([]);
    const { state: s2, events } = applyMove(g, tokenIdx);
    if (events.some((e) => e.type === 'capture')) { buzz('success'); say(youSeat + 1 <= ais.length ? events.find(e=>e.type==='capture').victimSeat : 1, "the player just captured YOUR token — react"); }
    else if (events.some((e) => e.type === 'home')) buzz('success');
    else buzz('light');
    setGame(s2);
  };

  const homeCount = (seat) => game.players[seat].tokens.filter((t) => t.steps === 57).length;
  const yourTurn = game.turn === youSeat && !game.winner;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#160F1C', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.kicker}>the arena</Text>
            <Text style={styles.title}>ludo</Text>
          </View>
        </View>

        {/* seats */}
        <View style={styles.seats}>
          {ids.map((id, seat) => (
            <Seat key={id} isYou={seat === youSeat} pkey={id} tone={tones[seat]}
              name={seat === youSeat ? 'you' : (ais[seat - 1]?.name || id)}
              active={game.turn === seat && !game.winner}
              thought={thinking === seat}
              tokensHome={homeCount(seat)} />
          ))}
        </View>

        {/* banter bubble */}
        <View style={styles.talkRow}>
          {talk ? <Text style={[styles.talk, { color: tones[talk.seat] }]} numberOfLines={2}>“{talk.line}”</Text> : <Text style={styles.talkGhost}> </Text>}
        </View>

        {/* the felt */}
        <View style={{ alignItems: 'center' }}>
          <View style={{ width: BOARD, height: BOARD }}>
            <BoardFace tones={tones} />
            {game.players.map((p, seat) => p.tokens.map((t, i) => (
              <Token key={`${seat}-${i}`} seat={seat} idx={i} steps={t.steps} tone={tones[seat]}
                pulsing={seat === youSeat && pulseTokens.includes(i)}
                onPress={() => youMove(i)}
                stack={stackInfo(game, seat, i)} />
            )))}
          </View>
        </View>

        {/* the die + your prompt */}
        <View style={styles.dock}>
          <Text style={styles.prompt}>
            {game.winner ? (game.winner === 'you' ? 'you took the table. 🏆' : `${seatName(game.players.findIndex(p=>p.id===game.winner))} takes it.`)
              : yourTurn ? (game.phase === 'roll' ? 'your roll — tap the die' : (pulseTokens.length ? 'pick a token' : ' '))
              : `${seatName(game.turn)}'s turn`}
          </Text>
          <Die value={game.die} rolling={rolling} enabled={yourTurn && game.phase === 'roll'} onPress={youRoll} tone={tones[youSeat]} />
        </View>

        {game.winner && (
          <View style={styles.resultRow}>
            <Pressable style={styles.resultBtn} onPress={() => { seatsRef.current = null; setGame(() => { const g = newGame(ids); g.turn = Math.floor(Math.random()*ids.length); return g; }); }}>
              <Text style={styles.resultTxt}>play again</Text>
            </Pressable>
            <Pressable style={[styles.resultBtn, { borderColor: 'rgba(255,255,255,0.15)' }]} onPress={onExit}>
              <Text style={[styles.resultTxt, { color: C.muted }]}>leave the table</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// tokens of one seat sharing a cell fan out slightly
function stackInfo(game, seat, idx) {
  const t = game.players[seat].tokens[idx];
  if (t.steps === 0 || t.steps === 57) return { n: 1, i: 0 };
  const mates = game.players[seat].tokens
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => x.steps === t.steps);
  return { n: mates.length, i: mates.findIndex(({ i }) => i === idx) };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 26, marginTop: 0 },

  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 6 },
  seat: { flexDirection: 'row', alignItems: 'center', width: '47.5%', padding: 7, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  seatFace: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, backgroundColor: '#1a121f' },
  seatName: { fontFamily: FONTS.medium, color: C.muted, fontSize: 13.5 },
  seatHome: { fontFamily: FONTS.light, color: C.faint, fontSize: 11, marginTop: 1 },

  talkRow: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 4 },
  talk: { fontFamily: FONTS.displayItalic, fontSize: 13.5, textAlign: 'center' },
  talkGhost: { fontSize: 13.5 },

  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 12 },
  prompt: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14.5, flex: 1, marginRight: 14 },

  resultRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  resultBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.4)', alignItems: 'center', backgroundColor: 'rgba(243,168,95,0.08)' },
  resultTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 14.5 },
});
