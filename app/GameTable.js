// ════════════════════════════════════════════════════════════════════════
//  yourZ — GAME TABLE (signature game surface, proves the LOOK + PACING LAW).
//  A dice turn: the die TUMBLES and settles (never teleports). The opponent's
//  PRESENCE sits at the table, reacting. When it's their turn, they take a
//  BEAT to "think" — the pause reads as character (§17 pacing law). This is a
//  vertical slice proving the feel; full game logic wires in later.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Rect } from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, withDelay, Easing, runOnJS,
} from 'react-native-reanimated';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const PIPS = {
  1: [[50,50]], 2: [[28,28],[72,72]], 3: [[26,26],[50,50],[74,74]],
  4: [[28,28],[72,28],[28,72],[72,72]], 5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,26],[72,26],[28,50],[72,50],[28,74],[72,74]],
};

// ── the die: TRULY TUMBLES — faces cycle rapidly + it rotates, then settles ──
function Die({ rolling, value }) {
  const spin = useSharedValue(0);
  const bounce = useSharedValue(0);
  const [shownFace, setShownFace] = useState(value);
  const cycleRef = useRef(null);

  useEffect(() => {
    if (rolling) {
      // rapidly cycle the visible face while tumbling (looks like it's turning through numbers)
      cycleRef.current = setInterval(() => setShownFace(1 + Math.floor(Math.random() * 6)), 70);
      spin.value = withTiming(1, { duration: 820, easing: Easing.out(Easing.cubic) });
      bounce.value = withSequence(
        withTiming(-34, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 140, easing: Easing.bounce }),
        withTiming(-18, { duration: 120 }),
        withTiming(0, { duration: 150, easing: Easing.bounce }),
        withTiming(-7, { duration: 100 }),
        withTiming(0, { duration: 120, easing: Easing.bounce }),
      );
    } else {
      if (cycleRef.current) clearInterval(cycleRef.current);
      setShownFace(value);            // settle on the real value
      spin.value = 0;
    }
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, [rolling, value]);

  const st = useAnimatedStyle(() => ({
    transform: [
      { perspective: 400 },
      { translateY: bounce.value },
      { rotateX: `${spin.value * 720}deg` },
      { rotateZ: `${spin.value * 540}deg` },
      { scale: rolling ? 1.08 : 1 },
    ],
  }));
  const face = rolling ? shownFace : value;
  return (
    <Animated.View style={[styles.die, st]}>
      <Svg width="64" height="64" viewBox="0 0 100 100">
        <Defs><RadialGradient id="dieG" cx="35%" cy="30%" r="80%">
          <Stop offset="0%" stopColor="#FFF6EC" /><Stop offset="100%" stopColor="#E8D8C4" />
        </RadialGradient></Defs>
        <Rect x="6" y="6" width="88" height="88" rx="18" fill="url(#dieG)" />
        {(PIPS[face] || PIPS[1]).map((p, i) => <Circle key={i} cx={p[0]} cy={p[1]} r="8" fill="#3A1505" />)}
      </Svg>
    </Animated.View>
  );
}

// ── a seat at the table: presence + name + score. `active` = their turn (rises). ──
function Seat({ pkey, name, tone, isYou, active, score }) {
  const [ok, setOk] = useState(true);
  const lift = useSharedValue(0);
  const breath = useSharedValue(1);
  useEffect(() => { breath.value = withRepeat(withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 400, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 8 }, { scale: (active ? 1.06 : 0.94) * (0.99 + breath.value * 0.01) }], opacity: 0.55 + lift.value * 0.45 }));
  const halo = useAnimatedStyle(() => ({ opacity: lift.value * 0.85 }));
  const S = 56;
  return (
    <Animated.View style={[styles.seat, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
          <Svg width={S + 14} height={S + 14}><Defs><RadialGradient id={`sh_${pkey}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={tone} stopOpacity="0.6" /><Stop offset="60%" stopColor={tone} stopOpacity="0.14" /><Stop offset="100%" stopColor={tone} stopOpacity="0" />
          </RadialGradient></Defs><Circle cx={(S+14)/2} cy={(S+14)/2} r={(S+14)/2} fill={`url(#sh_${pkey})`} /></Svg>
        </Animated.View>
        <View style={[styles.seatFace, { width: S, height: S, borderRadius: S/2, borderColor: tone }]}>
          {isYou ? (
            <View style={styles.youSeat}><Text style={styles.youSeatText}>you</Text></View>
          ) : ok ? (
            <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: S/2 }} onError={() => setOk(false)} />
          ) : (
            <Svg width={S} height={S} viewBox="0 0 56 56"><Defs><RadialGradient id={`sf_${pkey}`} cx="38%" cy="33%" r="70%"><Stop offset="0%" stopColor="#FFD09A" /><Stop offset="60%" stopColor={tone} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs><Circle cx="28" cy="28" r="28" fill={`url(#sf_${pkey})`} /></Svg>
          )}
        </View>
      </View>
      <Text style={[styles.seatName, active && { color: C.cream }]} numberOfLines={1}>{name}</Text>
      <Text style={styles.seatScore}>{score}</Text>
    </Animated.View>
  );
}

export default function GameTable({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765', style: 'rash, cocky, all bravado.' };
  const gameName = game?.name || 'Ludo';

  const [turn, setTurn] = useState('you');        // 'you' | 'opp'
  const [rolling, setRolling] = useState(false);
  const [die, setDie] = useState(6);
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  // two-way banter feed: {who:'opp'|'you'|'sys', text}
  const [feed, setFeed] = useState([
    { who: 'sys', text: `${opp.name} settles in across the table.` },
  ]);
  const [draft, setDraft] = useState('');
  const feedRef = useRef(null);
  const pushFeed = (line) => {
    setFeed((f) => [...f, line]);
    setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60);
  };

  // in-character "thinking" lines for the pause before the opp rolls
  const THINKING = [
    `${opp.name} eyes the board…`,
    `${opp.name} is taking their time…`,
    `${opp.name} smirks, considering…`,
  ];

  // the persona reacts to what YOU say (scripted stand-in; engine /banter later)
  const reactTo = (text) => {
    const t = text.toLowerCase();
    let reply;
    if (/luck|lucky|fluke/.test(t)) reply = `"luck? cute. skill looks like luck to amateurs."`;
    else if (/lose|losing|winning|win|beat/.test(t)) reply = `"big talk for someone ${youScore < oppScore ? 'behind on the board' : 'about to choke'}."`;
    else if (/\?|how|what|why/.test(t)) reply = `"you'll figure it out. or you won't. roll."`;
    else reply = `"mhm. less talk, more rolling."`;
    setTimeout(() => pushFeed({ who: 'opp', text: `${opp.name}: ${reply}` }), 700); // a beat (pacing)
  };

  const sendChat = () => {
    const t = draft.trim();
    if (!t) return;
    setDraft('');
    pushFeed({ who: 'you', text: t });
    reactTo(t);
  };

  const rollFor = (who) => {
    setRolling(true);
    if (who === 'opp') pushFeed({ who: 'sys', text: THINKING[Math.floor(Math.random() * THINKING.length)] });
    // the die tumbles for ~850ms, THEN settles — never instant (pacing law)
    setTimeout(() => {
      const v = 1 + Math.floor(Math.random() * 6);
      setDie(v);
      setRolling(false);
      if (who === 'you') {
        setYouScore((s) => s + v);
        pushFeed({ who: 'sys', text: `you rolled a ${v}.` });
      } else {
        setOppScore((s) => s + v);
        pushFeed({ who: 'opp', text: v >= 5 ? `${opp.name}: "boom. read it and weep."` : `${opp.name} rolled a ${v}. quietly annoyed.` });
      }
      // hand off the turn after a beat
      setTimeout(() => setTurn(who === 'you' ? 'opp' : 'you'), 900);
    }, 850);
  };

  // when it's the opponent's turn, they TAKE A BEAT (think in character) then roll
  useEffect(() => {
    if (turn === 'opp' && !rolling) {
      const think = 900 + Math.floor(Math.random() * 800); // a human-feeling pause
      const t = setTimeout(() => rollFor('opp'), think);
      return () => clearTimeout(t);
    }
  }, [turn]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0E12', '#0E0912', '#070509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* top bar */}
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.gameTitle}>{gameName}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* the two seats — you + the opponent, opponent present & reacting */}
        <View style={styles.seats}>
          <Seat pkey="you" name="you" tone={C.ember} isYou active={turn === 'you'} score={youScore} />
          <Text style={styles.vs}>vs</Text>
          <Seat pkey={opp.key} name={opp.name} tone={opp.tone} active={turn === 'opp'} score={oppScore} />
        </View>

        {/* the board (stylized — the LOOK; real board logic wires later) */}
        <View style={styles.board}>
          <LinearGradient colors={['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.01)']} style={styles.boardInner}>
            <Die rolling={rolling} value={die} />
            {/* two-way banter feed */}
            <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
              {feed.map((line, i) => (
                <Text key={i} style={[
                  styles.feedLine,
                  line.who === 'you' && styles.feedYou,
                  line.who === 'sys' && styles.feedSys,
                ]}>{line.text}</Text>
              ))}
            </ScrollView>
          </LinearGradient>
        </View>

        {/* chat back to the table — two-way banter */}
        <View style={styles.chatRow}>
          <BlurView intensity={20} tint="dark" style={styles.chatField}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={sendChat}
              placeholder={`talk trash to ${opp.name}…`}
              placeholderTextColor={C.faint}
              style={styles.chatInput}
              returnKeyType="send"
            />
          </BlurView>
          <Pressable style={styles.chatSend} onPress={sendChat}>
            <Svg width="38" height="38" viewBox="0 0 38 38"><Defs><RadialGradient id="csend" cx="40%" cy="34%" r="70%"><Stop offset="0%" stopColor="#FFD9AE" /><Stop offset="42%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs><Circle cx="19" cy="19" r="19" fill="url(#csend)" /><Path d="M12 19 L26 13 L21.5 26 L18.5 20.5 Z" fill="#3A1505" /></Svg>
          </Pressable>
        </View>

        {/* your action — only when it's your turn */}
        <View style={styles.actions}>
          {turn === 'you' && !rolling ? (
            <Pressable style={styles.rollBtn} onPress={() => rollFor('you')}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rollInner}>
                <Text style={styles.rollText}>roll</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitPill}>
              <Text style={styles.waitText}>{turn === 'you' ? 'rolling…' : `${opp.name}'s turn`}</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  gameTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },

  seats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24, paddingTop: 16, paddingBottom: 8 },
  seat: { alignItems: 'center', width: 96 },
  seatFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1a121f', alignItems: 'center', justifyContent: 'center' },
  youSeat: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(243,168,95,0.12)' },
  youSeatText: { fontFamily: FONTS.medium, color: C.accent, fontSize: 13 },
  seatName: { fontFamily: FONTS.body, color: C.faint, fontSize: 12.5, marginTop: 6 },
  seatScore: { fontFamily: FONTS.display, color: C.cream, fontSize: 20, marginTop: 2 },
  vs: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 15, marginTop: -20 },

  board: { flex: 1, paddingHorizontal: 24, paddingVertical: 12 },
  boardInner: { flex: 1, borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,240,228,0.08)', alignItems: 'center', paddingTop: 24, paddingBottom: 10 },
  die: { alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  feed: { alignSelf: 'stretch', paddingHorizontal: 22 },
  feedLine: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 15, textAlign: 'center', marginBottom: 7, lineHeight: 21 },
  feedYou: { fontFamily: FONTS.medium, color: C.cream, fontStyle: 'normal' },
  feedSys: { fontFamily: FONTS.light, color: C.faint, fontSize: 13 },

  chatRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 8, gap: 9 },
  chatField: { flex: 1, borderRadius: 22, paddingVertical: 3, paddingHorizontal: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,240,228,0.10)', backgroundColor: 'rgba(255,240,230,0.04)' },
  chatInput: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, paddingVertical: 9 },
  chatSend: { width: 38, height: 38 },

  actions: { paddingHorizontal: 24, paddingBottom: 14, alignItems: 'center' },
  rollBtn: { borderRadius: 26, overflow: 'hidden', width: 200 },
  rollInner: { paddingVertical: 16, alignItems: 'center' },
  rollText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 17, letterSpacing: 1 },
  waitPill: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: 200, alignItems: 'center' },
  waitText: { fontFamily: FONTS.body, color: C.muted, fontSize: 15 },
});
