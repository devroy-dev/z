// ════════════════════════════════════════════════════════════════════════
//  yourZ — SKIA LUDO (real 2.5D, renders on device via @shopify/react-native-skia).
//  A board with genuine DEPTH — layered shadows, glossy tokens, a die that
//  tumbles. No expo-gl, no WebGL, no r163 — Skia is a native 2D GPU canvas that
//  is rock-solid on low/mid Android. Honors the pacing law: die tumbles, the
//  opponent takes a beat before rolling, in character.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Canvas, RoundedRect, Circle, Group, Shadow, LinearGradient as SkiaGradient,
  vec, Paint, Rect,
} from '@shopify/react-native-skia';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');
const BOARD = Math.min(SCREEN_W - 40, 360);      // board square size
const CELL = BOARD / 15;                          // 15x15 ludo grid

// the four quadrant colors (Lamplight-tuned)
const QUAD = ['#F0A765', '#6FC9E0', '#F0708C', '#8FD98F'];

// ── the board, drawn in Skia with real depth ──
function LudoBoard({ tokenPositions }) {
  const pad = 6;
  const inner = BOARD - pad * 2;
  const q = inner / 2; // quadrant size
  return (
    <Canvas style={{ width: BOARD, height: BOARD }}>
      {/* board base with a soft drop shadow for depth */}
      <RoundedRect x={pad} y={pad} width={inner} height={inner} r={16} color="#14101c">
        <Shadow dx={0} dy={8} blur={18} color="rgba(0,0,0,0.55)" />
      </RoundedRect>

      {/* four colored home quadrants, each raised with its own shadow */}
      {[
        { x: pad, y: pad, c: QUAD[0] },
        { x: pad + q, y: pad, c: QUAD[1] },
        { x: pad, y: pad + q, c: QUAD[3] },
        { x: pad + q, y: pad + q, c: QUAD[2] },
      ].map((quad, i) => (
        <Group key={i}>
          <RoundedRect x={quad.x + 6} y={quad.y + 6} width={q - 12} height={q - 12} r={10} color={quad.c} opacity={0.9}>
            <Shadow dx={0} dy={3} blur={8} color="rgba(0,0,0,0.4)" inner />
          </RoundedRect>
          {/* inner home pocket */}
          <RoundedRect x={quad.x + q * 0.28} y={quad.y + q * 0.28} width={q * 0.44} height={q * 0.44} r={8} color="#0e0a14" opacity={0.55} />
        </Group>
      ))}

      {/* center home diamond */}
      <Group transform={[{ translateX: BOARD / 2 }, { translateY: BOARD / 2 }, { rotate: Math.PI / 4 }]}>
        <RoundedRect x={-q * 0.22} y={-q * 0.22} width={q * 0.44} height={q * 0.44} r={6} color="#2a2036">
          <Shadow dx={0} dy={2} blur={6} color="rgba(0,0,0,0.5)" />
        </RoundedRect>
      </Group>

      {/* the cross path (white lanes) */}
      <RoundedRect x={pad + q - CELL * 1.5} y={pad} width={CELL * 3} height={inner} r={4} color="rgba(255,255,255,0.04)" />
      <RoundedRect x={pad} y={pad + q - CELL * 1.5} width={inner} height={CELL * 3} r={4} color="rgba(255,255,255,0.04)" />

      {/* tokens — glossy discs with highlight + shadow (the 2.5D pop) */}
      {tokenPositions.map((t, i) => (
        <Group key={`tok${i}`}>
          <Circle cx={t.x} cy={t.y + 2} r={CELL * 0.42} color="rgba(0,0,0,0.45)" />
          <Circle cx={t.x} cy={t.y} r={CELL * 0.42} color={t.color}>
            <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.5)" />
          </Circle>
          {/* glossy highlight */}
          <Circle cx={t.x - CELL * 0.13} cy={t.y - CELL * 0.14} r={CELL * 0.15} color="rgba(255,255,255,0.55)" />
        </Group>
      ))}
    </Canvas>
  );
}

// ── the die, tumbling in Skia (faces cycle + it rotates, then settles) ──
function SkiaDie({ rolling, value }) {
  const [face, setFace] = useState(value);
  const cycleRef = useRef(null);
  useEffect(() => {
    if (rolling) {
      cycleRef.current = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 80);
    } else {
      if (cycleRef.current) clearInterval(cycleRef.current);
      setFace(value);
    }
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, [rolling, value]);

  const D = 64;
  const shown = rolling ? face : value;
  // pip layouts for 1..6
  const pips = {
    1: [[0.5, 0.5]],
    2: [[0.3, 0.3], [0.7, 0.7]],
    3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
    4: [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]],
    5: [[0.3, 0.3], [0.7, 0.3], [0.5, 0.5], [0.3, 0.7], [0.7, 0.7]],
    6: [[0.3, 0.28], [0.7, 0.28], [0.3, 0.5], [0.7, 0.5], [0.3, 0.72], [0.7, 0.72]],
  }[shown] || [[0.5, 0.5]];
  return (
    <Canvas style={{ width: D + 12, height: D + 12 }}>
      <Group transform={rolling ? [{ translateX: (D + 12) / 2 }, { translateY: (D + 12) / 2 }, { rotate: (Date.now() % 360) / 57 }, { translateX: -(D + 12) / 2 }, { translateY: -(D + 12) / 2 }] : undefined}>
        <RoundedRect x={6} y={6} width={D} height={D} r={14} color="#fff4ea">
          <Shadow dx={0} dy={3} blur={8} color="rgba(0,0,0,0.5)" />
        </RoundedRect>
        {pips.map((p, i) => (
          <Circle key={i} cx={6 + p[0] * D} cy={6 + p[1] * D} r={D * 0.08} color="#3a1505" />
        ))}
      </Group>
    </Canvas>
  );
}

// ── a seat: presence + name + score; active = rises ──
function Seat({ pkey, name, tone, isYou, active, score }) {
  const [ok, setOk] = useState(true);
  const S = active ? 62 : 52;
  return (
    <View style={[styles.seat, active && styles.seatActive]}>
      <View style={{ width: S, height: S }}>
        {ok ? (
          <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)}
            style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 2, borderColor: tone }} />
        ) : (
          <View style={[styles.seatFallback, { width: S, height: S, borderRadius: S / 2, borderColor: tone }]}>
            <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 22 }}>{name[0]}</Text>
          </View>
        )}
      </View>
      <Text style={styles.seatName}>{isYou ? 'you' : name}</Text>
      <Text style={[styles.seatScore, { color: tone }]}>{score}</Text>
    </View>
  );
}

export default function SkiaLudo({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765', style: 'rash, cocky, all bravado.' };
  const gameName = game?.name || 'Ludo';

  const [turn, setTurn] = useState('you');
  const [rolling, setRolling] = useState(false);
  const [die, setDie] = useState(6);
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [feed, setFeed] = useState([{ who: 'sys', text: `${opp.name} settles in across the table.` }]);
  const [draft, setDraft] = useState('');
  const feedRef = useRef(null);

  // token positions on the board (simple demo layout that moves with score)
  const p = 6;
  const inner = BOARD - p * 2;
  const q = inner / 2;
  const tokenPositions = [
    { x: p + q * 0.5, y: p + q * 0.5, color: QUAD[0] },
    { x: p + q * 1.5, y: p + q * 0.5, color: QUAD[1] },
    { x: p + q * 0.5, y: p + q * 1.5, color: QUAD[3] },
    { x: p + q * 1.5, y: p + q * 1.5, color: QUAD[2] },
    // a token that walks the center lane as scores rise
    { x: p + q - CELL / 2, y: p + inner - CELL * (1 + youScore % 6), color: QUAD[0] },
    { x: p + q - CELL / 2, y: p + CELL * (1 + oppScore % 6), color: QUAD[2] },
  ];

  const pushFeed = (line) => {
    setFeed((f) => [...f, line]);
    setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60);
  };

  const THINKING = [`${opp.name} eyes the board…`, `${opp.name} is taking their time…`, `${opp.name} smirks, considering…`];

  const reactTo = (text) => {
    const t = text.toLowerCase();
    let reply;
    if (/luck|lucky|fluke/.test(t)) reply = `"luck? cute. skill looks like luck to amateurs."`;
    else if (/lose|losing|winning|win|beat/.test(t)) reply = `"big talk for someone ${youScore < oppScore ? 'behind on the board' : 'about to choke'}."`;
    else if (/\?|how|what|why/.test(t)) reply = `"you'll figure it out. or you won't. roll."`;
    else reply = `"mhm. less talk, more rolling."`;
    setTimeout(() => pushFeed({ who: 'opp', text: `${opp.name}: ${reply}` }), 700);
  };

  const sendChat = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft(''); pushFeed({ who: 'you', text: t }); reactTo(t);
  };

  const rollFor = (who) => {
    setRolling(true);
    if (who === 'opp') pushFeed({ who: 'sys', text: THINKING[Math.floor(Math.random() * THINKING.length)] });
    setTimeout(() => {
      const v = 1 + Math.floor(Math.random() * 6);
      setDie(v); setRolling(false);
      if (who === 'you') {
        setYouScore((s) => s + v);
        pushFeed({ who: 'sys', text: `you rolled a ${v}.` });
        setTimeout(() => setTurn('opp'), 500);
      } else {
        setOppScore((s) => s + v);
        pushFeed({ who: 'sys', text: `${opp.name} rolled a ${v}.` });
        const react = v >= 5 ? `"boom. read it and weep."` : v <= 2 ? `"tch. warming up."` : `"steady."`;
        setTimeout(() => pushFeed({ who: 'opp', text: `${opp.name}: ${react}` }), 400);
        setTimeout(() => setTurn('you'), 900);
      }
    }, 850);
  };

  // opponent takes a beat, then rolls (pacing)
  useEffect(() => {
    if (turn === 'opp' && !rolling) {
      const t = setTimeout(() => rollFor('opp'), 1100);
      return () => clearTimeout(t);
    }
  }, [turn]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0E12', '#0E0912', '#080509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{gameName}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.seatsRow}>
          <Seat pkey="the_stranger" name="You" tone={C.ember} isYou active={turn === 'you'} score={youScore} />
          <Text style={styles.vs}>vs</Text>
          <Seat pkey={opp.key} name={opp.name} tone={opp.tone} active={turn === 'opp'} score={oppScore} />
        </View>

        <View style={styles.boardWrap}>
          <LudoBoard tokenPositions={tokenPositions} />
        </View>

        <View style={styles.dieRow}>
          <SkiaDie rolling={rolling} value={die} />
        </View>

        <Pressable
          style={[styles.rollBtn, (turn !== 'you' || rolling) && styles.rollBtnOff]}
          onPress={() => turn === 'you' && !rolling && rollFor('you')}
          disabled={turn !== 'you' || rolling}
        >
          <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rollInner}>
            <Text style={styles.rollText}>{turn === 'you' ? (rolling ? 'rolling…' : 'roll') : `${opp.name}'s turn`}</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.feedWrap}>
          <ScrollView ref={feedRef} style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
            {feed.map((f, i) => (
              <Text key={i} style={[styles.feedLine,
                f.who === 'you' ? styles.feedYou : f.who === 'opp' ? styles.feedOpp : styles.feedSys]}>
                {f.who === 'you' ? `you: ${f.text}` : f.text}
              </Text>
            ))}
          </ScrollView>
          <View style={styles.chatRow}>
            <TextInput
              value={draft} onChangeText={setDraft} onSubmitEditing={sendChat}
              placeholder={`talk trash to ${opp.name}…`} placeholderTextColor={C.faint}
              style={styles.chatInput} returnKeyType="send"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },

  seatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingVertical: 6 },
  seat: { alignItems: 'center', opacity: 0.7 },
  seatActive: { opacity: 1, transform: [{ translateY: -4 }] },
  seatFallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  seatName: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 4 },
  seatScore: { fontFamily: FONTS.display, fontSize: 18, marginTop: 1 },
  vs: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 15 },

  boardWrap: { alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  dieRow: { alignItems: 'center', marginTop: 4 },

  rollBtn: { alignSelf: 'center', borderRadius: 16, overflow: 'hidden', marginTop: 6, width: 200 },
  rollBtnOff: { opacity: 0.5 },
  rollInner: { paddingVertical: 13, alignItems: 'center' },
  rollText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 15, letterSpacing: 0.4 },

  feedWrap: { flex: 1, marginTop: 8, marginHorizontal: 18, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  feedLine: { fontFamily: FONTS.body, fontSize: 13.5, lineHeight: 20, marginVertical: 2 },
  feedYou: { color: C.cream, textAlign: 'right' },
  feedOpp: { fontFamily: FONTS.displayItalic, color: C.accentSoft },
  feedSys: { color: C.faint, fontStyle: 'italic', textAlign: 'center', fontSize: 12 },
  chatRow: { paddingVertical: 8 },
  chatInput: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.03)' },
});
