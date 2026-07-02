// ════════════════════════════════════════════════════════════════════════
//  yourZ — SNAKES & LADDERS table. Nightfall. rules.js owns the game; the
//  personas own their mouths; this owns the board, the serpents, the drama.
//  • 10×10 boustrophedon board, SVG; snakes as living bezier curves, ladders
//    as railed climbs — drawn from the same data the rules use
//  • tokens step to the landed cell, then — a HELD BEAT — slide down the
//    snake or climb the ladder (the pause IS the drama; pacing law)
//  • pure-luck game: your only act is the die; AI seats roll on their own
//    beat; banter fires on the big moments (the 99 snake, the 97+ agony)
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Circle, Path, Text as SvgText, Defs, RadialGradient, LinearGradient as SvgLinear, Stop } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withDelay, withTiming } from 'react-native-reanimated';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { Die, buzz, faceFor, SEAT_TONES } from '../common';
import { newGame, applyRoll, SNAKES, LADDERS, cellRC } from './rules.js';
import { banterMoment } from './ai.js';

const { width: SCREEN_W } = Dimensions.get('window');
const BOARD = Math.min(SCREEN_W - 20, 400);
const CELL = BOARD / 10;
const center = (cell) => { const [r, c] = cellRC(cell); return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 }; };

// ── a snake: a living cubic curve, head at the high cell ──
function Snake({ head, tail, i }) {
  const H = center(head), T = center(tail);
  const mx = (H.x + T.x) / 2, my = (H.y + T.y) / 2;
  const dx = T.x - H.x, dy = T.y - H.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;                    // normal → the S-wiggle
  const w = Math.min(34, len * 0.28) * (i % 2 ? 1 : -1);
  const d = `M ${H.x} ${H.y} C ${H.x + nx * w} ${H.y + ny * w}, ${mx - nx * w} ${my - ny * w}, ${mx} ${my} S ${T.x - nx * w * 0.7} ${T.y - ny * w * 0.7}, ${T.x} ${T.y}`;
  return (
    <>
      <Path d={d} stroke={`url(#snk${i})`} strokeWidth={CELL * 0.22} strokeLinecap="round" fill="none" opacity="0.85" />
      <Path d={d} stroke="rgba(0,0,0,0.35)" strokeWidth={CELL * 0.07} strokeDasharray={`${CELL * 0.16} ${CELL * 0.2}`} strokeLinecap="round" fill="none" />
      <Circle cx={H.x} cy={H.y} r={CELL * 0.19} fill="#8FBF6A" stroke="#213816" strokeWidth="1.4" />
      <Circle cx={H.x - 2.6} cy={H.y - 1.8} r={1.7} fill="#1a2a10" />
      <Circle cx={H.x + 2.6} cy={H.y - 1.8} r={1.7} fill="#1a2a10" />
    </>
  );
}
// ── a ladder: two rails + rungs ──
function Ladder({ foot, top }) {
  const F = center(foot), T = center(top);
  const dx = T.x - F.x, dy = T.y - F.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * CELL * 0.14, ny = (dx / len) * CELL * 0.14;
  const rungs = Math.max(3, Math.floor(len / (CELL * 0.55)));
  const lines = [];
  for (let i = 1; i < rungs; i++) {
    const t = i / rungs;
    const x = F.x + dx * t, y = F.y + dy * t;
    lines.push(<Path key={i} d={`M ${x - nx} ${y - ny} L ${x + nx} ${y + ny}`} stroke="#E0C088" strokeWidth="2.2" opacity="0.75" />);
  }
  return (
    <>
      <Path d={`M ${F.x - nx} ${F.y - ny} L ${T.x - nx} ${T.y - ny}`} stroke="#E0C088" strokeWidth="3" opacity="0.85" strokeLinecap="round" />
      <Path d={`M ${F.x + nx} ${F.y + ny} L ${T.x + nx} ${T.y + ny}`} stroke="#E0C088" strokeWidth="3" opacity="0.85" strokeLinecap="round" />
      {lines}
    </>
  );
}

function BoardFace() {
  const cells = [];
  for (let cell = 1; cell <= 100; cell++) {
    const [r, c] = cellRC(cell);
    const dark = (r + c) % 2 === 0;
    cells.push(
      <Rect key={cell} x={c * CELL} y={r * CELL} width={CELL} height={CELL}
        fill={dark ? 'rgba(245,236,225,0.05)' : 'rgba(245,236,225,0.018)'}
        stroke="rgba(245,236,225,0.08)" strokeWidth="0.6" />,
      <SvgText key={`t${cell}`} x={c * CELL + 3.5} y={r * CELL + 11} fontSize={CELL * 0.22}
        fill={cell === 100 ? C.ember : 'rgba(245,236,225,0.30)'} fontWeight={cell === 100 ? '700' : '400'}>{cell}</SvgText>
    );
  }
  return (
    <Svg width={BOARD} height={BOARD} style={StyleSheet.absoluteFill}>
      <Defs>
        {Object.keys(SNAKES).map((h, i) => (
          <SvgLinear key={i} id={`snk${i}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#7FB35C" /><Stop offset="100%" stopColor="#3E6B34" />
          </SvgLinear>
        ))}
      </Defs>
      <Rect x="0" y="0" width={BOARD} height={BOARD} rx="14" fill="rgba(0,0,0,0.25)" stroke="rgba(243,168,95,0.22)" strokeWidth="1.2" />
      {cells}
      {Object.entries(LADDERS).map(([f, t]) => <Ladder key={`l${f}`} foot={+f} top={t} />)}
      {Object.entries(SNAKES).map(([h, t], i) => <Snake key={`s${h}`} head={+h} tail={t} i={i} />)}
    </Svg>
  );
}

// ── a token: steps to the rolled cell, then (beat) rides the snake/ladder ──
function Token({ pos, slideFrom, tone, idx, n }) {
  const p = pos === 0 ? { x: -CELL, y: BOARD - CELL / 2 } : center(pos);
  const fan = n > 1 ? (idx - (n - 1) / 2) * 7 : 0;
  const x = useSharedValue(p.x), y = useSharedValue(p.y);
  useEffect(() => {
    if (slideFrom) {
      const s = center(slideFrom);
      x.value = withSpring(s.x + fan, { damping: 15, stiffness: 140 });
      y.value = withSpring(s.y, { damping: 15, stiffness: 140 });
      x.value = withDelay(620, withTiming(p.x + fan, { duration: 520 }));   // the held beat, then the ride
      y.value = withDelay(620, withTiming(p.y, { duration: 520 }));
    } else {
      x.value = withSpring(p.x + fan, { damping: 14, stiffness: 130 });
      y.value = withSpring(p.y, { damping: 14, stiffness: 130 });
    }
  }, [pos, slideFrom, fan]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }] }));
  const S = CELL * 0.52;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: -S / 2, top: -S / 2, width: S, height: S }, st]}>
      <Svg width={S} height={S} viewBox="0 0 30 30">
        <Defs><RadialGradient id={`sk${tone}${idx}`} cx="38%" cy="30%" r="75%">
          <Stop offset="0%" stopColor="#FFF" stopOpacity="0.9" /><Stop offset="35%" stopColor={tone} /><Stop offset="100%" stopColor="#1a1016" />
        </RadialGradient></Defs>
        <Circle cx="15" cy="16.5" r="11" fill="#000" opacity="0.35" />
        <Circle cx="15" cy="15" r="11" fill={`url(#sk${tone}${idx})`} />
        <Circle cx="15" cy="15" r="11" fill="none" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />
      </Svg>
    </Animated.View>
  );
}

function Seat({ name, pkey, tone, active, isYou, pos }) {
  const [ok, setOk] = useState(true);
  return (
    <View style={[styles.seat, active && { borderColor: tone, backgroundColor: 'rgba(255,255,255,0.05)' }]}>
      {isYou || !ok ? (
        <View style={[styles.seatFace, { borderColor: tone, alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 15 }}>{(isYou ? 'Y' : (name || '?')[0]).toUpperCase()}</Text>
        </View>
      ) : (
        <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)} style={[styles.seatFace, { borderColor: tone }]} />
      )}
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[styles.seatName, active && { color: C.cream }]} numberOfLines={1}>{name}</Text>
        <Text style={styles.seatPos}>{pos === 0 ? 'not on board' : pos === 100 ? 'HOME 🏁' : `on ${pos}`}</Text>
      </View>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════
export default function SnakesTable({ opponent, roster, onExit = () => {} }) {
  const ais = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3);
  const ids = ['you', ...ais.map((a) => a.key)];
  const [game, setGame] = useState(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; });
  const [rolling, setRolling] = useState(false);
  const [lastDie, setLastDie] = useState(6);
  const [slides, setSlides] = useState({});             // seat → intermediate cell (snake head / ladder foot)
  const [talk, setTalk] = useState(null);
  const gameRef = useRef(game); useEffect(() => { gameRef.current = game; }, [game]);
  const busyRef = useRef(false);
  const banterAt = useRef(0);
  const tones = ids.map((_, i) => SEAT_TONES[i]);
  const youSeat = 0;
  const seatName = (s) => (s === youSeat ? 'the player' : (ais[s - 1]?.name || ids[s]));

  const say = useCallback(async (aroundSeat, momentLine) => {
    const now = Date.now(); if (now - banterAt.current < 7000) return;
    banterAt.current = now;
    // the speaker: a persona at the table (prefer not the one it happened to — the table reacts)
    const speakers = ids.map((k, s) => ({ k, s })).filter((x) => x.k !== 'you' && x.s !== aroundSeat);
    const pick = speakers.length ? speakers[Math.floor(Math.random() * speakers.length)] : { k: ids[aroundSeat], s: aroundSeat };
    if (pick.k === 'you') return;
    const { line } = await banter(pick.k, `Snakes & Ladders table, ONE short in-character reaction (no quotes). What just happened: ${momentLine}.`);
    if (line) { setTalk({ seat: pick.s, line }); setTimeout(() => setTalk(null), 4200); }
  }, [ids]);

  const resolveTurn = useCallback((who) => {
    if (busyRef.current || gameRef.current.winner) return;
    busyRef.current = true; setRolling(true); buzz('light');
    setTimeout(() => {
      const g = gameRef.current;
      const { state: s2, events } = applyRoll(g);
      setRolling(false);
      setLastDie(events[0].die);
      const ride = events.find((e) => e.type === 'snake' || e.type === 'ladder');
      if (ride) {
        setSlides({ [ride.seat]: ride.from });          // token pauses on the head/foot…
        setTimeout(() => setSlides({}), 1250);          // …then rides (Token handles the beat)
        buzz(ride.type === 'snake' ? 'thud' : 'win');
      } else if (events.some((e) => e.type === 'win')) buzz('success');
      else if (events.some((e) => e.type === 'stay')) buzz('heavy');
      setGame(s2);
      const bm = banterMoment(events, seatName, youSeat);
      if (bm && !bm.minor) say(events[0].seat, bm.line);
      busyRef.current = false;
    }, 760);
  }, [say]);

  // AI seats roll themselves, on a beat
  useEffect(() => {
    const g = game;
    if (g.winner || g.turn === youSeat) return;
    const t = setTimeout(() => resolveTurn(g.turn), 1000 + Math.random() * 800);
    return () => clearTimeout(t);
  }, [game, resolveTurn]);

  const yourTurn = game.turn === youSeat && !game.winner;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0F1614', '#0C0F12', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.kicker}>the arena</Text>
            <Text style={styles.title}>snakes & ladders</Text>
          </View>
        </View>

        <View style={styles.seats}>
          {ids.map((id, seat) => (
            <Seat key={id} isYou={seat === youSeat} pkey={id} tone={tones[seat]}
              name={seat === youSeat ? 'you' : (ais[seat - 1]?.name || id)}
              active={game.turn === seat && !game.winner}
              pos={game.players[seat].pos} />
          ))}
        </View>

        <View style={styles.talkRow}>
          {talk ? <Text style={[styles.talk, { color: tones[talk.seat] }]} numberOfLines={2}>“{talk.line}”</Text> : <Text style={styles.talkGhost}> </Text>}
        </View>

        <View style={{ alignItems: 'center' }}>
          <View style={{ width: BOARD, height: BOARD }}>
            <BoardFace />
            {game.players.map((p, seat) => (
              <Token key={seat} pos={p.pos} slideFrom={slides[seat] || null} tone={tones[seat]}
                idx={seat} n={game.players.filter((q) => q.pos === p.pos && p.pos > 0).length > 1 ? game.players.filter((q) => q.pos === p.pos).length : 1} />
            ))}
          </View>
        </View>

        <View style={styles.dock}>
          <Text style={styles.prompt}>
            {game.winner ? (game.winner === 'you' ? 'you reached 100. 🏁' : `${ais.find((a) => a.key === game.winner)?.name || game.winner} reached 100.`)
              : yourTurn ? 'your roll — tap the die' : `${ais[game.turn - 1]?.name || '…'} is rolling…`}
          </Text>
          <Die value={lastDie} rolling={rolling} enabled={yourTurn} onPress={() => resolveTurn(youSeat)} tone={tones[youSeat]} />
        </View>

        {game.winner && (
          <View style={styles.resultRow}>
            <Pressable style={styles.resultBtn} onPress={() => setGame(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; })}>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 24, marginTop: 0 },
  seats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, paddingTop: 6 },
  seat: { flexDirection: 'row', alignItems: 'center', width: '47.5%', padding: 7, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  seatFace: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, backgroundColor: '#1a121f' },
  seatName: { fontFamily: FONTS.medium, color: C.muted, fontSize: 13.5 },
  seatPos: { fontFamily: FONTS.light, color: C.faint, fontSize: 11, marginTop: 1 },
  talkRow: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 4 },
  talk: { fontFamily: FONTS.displayItalic, fontSize: 13.5, textAlign: 'center' },
  talkGhost: { fontSize: 13.5 },
  dock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 26, paddingTop: 12 },
  prompt: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14.5, flex: 1, marginRight: 14 },
  resultRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  resultBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.4)', alignItems: 'center', backgroundColor: 'rgba(243,168,95,0.08)' },
  resultTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 14.5 },
});
