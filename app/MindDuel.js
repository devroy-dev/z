// ════════════════════════════════════════════════════════════════════════
//  yourZ — MIND DUELS (debate · trivia · 20 questions · would-you-rather).
//  The truest "you play a PERSONALITY, not a bot" surface. Team-based: sides
//  are fluid seats (you | invited human | persona), 1v1 or 2v2 in any mix.
//  Personas can be TEAMMATES, not only opponents. The_moderator presides and
//  judges. Honors the pacing law: each speaker takes a BEAT that characterizes
//  them (brainiac considers, hustler snaps), the risen-speaker rises as they
//  hold the floor, one voice at a time — never a wall of simultaneous text.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');

// beat length by persona = character (pacing law)
const BEAT = {
  the_brainiac: 1600, the_philosopher: 1800, the_cynic: 1400,
  the_wannabe: 600, the_comic: 700, the_brother: 1100, the_orator: 1300,
  the_moderator: 900, default: 1100,
};

// ── a presence at the table: face + name; `speaking` = rises + glows ──
function Presence({ pkey, name, tone, isYou, speaking, small }) {
  const [ok, setOk] = useState(true);
  const glow = useSharedValue(0);
  useEffect(() => { glow.value = withTiming(speaking ? 1 : 0, { duration: 320 }); }, [speaking]);
  const rise = useAnimatedStyle(() => ({
    transform: [{ translateY: -glow.value * 8 }, { scale: 1 + glow.value * 0.08 }],
  }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.25 + glow.value * 0.75 }));
  const S = small ? 46 : 58;
  return (
    <Animated.View style={[styles.presence, rise]}>
      <Animated.View style={[styles.ring, ring, { width: S + 12, height: S + 12, borderRadius: (S + 12) / 2, borderColor: tone }]} />
      {ok ? (
        <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)}
          style={{ width: S, height: S, borderRadius: S / 2, borderWidth: 2, borderColor: tone }} />
      ) : (
        <View style={[styles.fallback, { width: S, height: S, borderRadius: S / 2, borderColor: tone }]}>
          <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 20 }}>{name[0]}</Text>
        </View>
      )}
      <Text style={styles.presenceName} numberOfLines={1}>{isYou ? 'you' : name}</Text>
    </Animated.View>
  );
}

export default function MindDuel({ game, opponent, teammate, onExit = () => {} }) {
  const gid = game?.id || 'debate';
  const gameName = game?.name || 'Debate Zone';

  // sides — fluid seats. default: you (+ optional teammate) vs opponent (+ optional 2nd)
  const opp = opponent || { key: 'the_cynic', name: 'the cynic', tone: '#A1929B' };
  const mate = teammate || null; // persona/human teammate on your side, or null (1v1)
  const opp2 = mate ? { key: 'the_orator', name: 'the orator', tone: '#E0C088' } : null; // 2v2 fills the other side
  const mod = { key: 'the_moderator', name: 'the moderator', tone: '#78B496' };

  const yourSide = [{ pkey: 'the_stranger', name: 'you', tone: C.ember, isYou: true }]
    .concat(mate ? [{ pkey: mate.key, name: mate.name, tone: mate.tone }] : []);
  const theirSide = [{ pkey: opp.key, name: opp.name, tone: opp.tone }]
    .concat(opp2 ? [{ pkey: opp2.key, name: opp2.name, tone: opp2.tone }] : []);

  const MOTIONS = {
    debate: 'This house believes ambition matters more than contentment.',
    trivia: 'Category: the world in the last hundred years. First to five.',
    twenty: "I'm thinking of something. You have twenty questions.",
    wyr: 'Would you rather be understood by everyone, or free from everyone?',
  };
  const motion = MOTIONS[gid] || MOTIONS.debate;

  const [speaking, setSpeaking] = useState('mod'); // key currently holding the floor
  const [feed, setFeed] = useState([]);
  const [draft, setDraft] = useState('');
  const [round, setRound] = useState(0);
  const feedRef = useRef(null);

  const pushFeed = (line) => {
    setFeed((f) => [...f, line]);
    setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60);
  };

  // moderator opens the duel with the motion (a beat, then speaks)
  useEffect(() => {
    setSpeaking('mod');
    const t = setTimeout(() => {
      pushFeed({ who: 'mod', name: mod.name, text: `"${motion}"` });
      pushFeed({ who: 'sys', text: gid === 'debate' ? 'you open. make your case.' : 'your move.' });
      setSpeaking('you');
    }, 900);
    return () => clearTimeout(t);
  }, []);

  // in-character lines (scripted stand-ins; the engine's soul-agent replaces these)
  const LINES = {
    the_cynic: [`"comfort is just ambition that gave up. but sure — dream on."`, `"you're describing a treadmill and calling it a summit."`, `"noted. still unconvinced."`],
    the_orator: [`"and yet every cathedral was built by someone unsatisfied with a field."`, `"contentment writes no symphonies, friend."`],
    the_brainiac: [`"define your terms. 'matters' by what measure — outcome, or meaning?"`, `"your premise smuggles in a value you haven't defended."`],
    the_brother: [`"i mean… both, right? you can want more and still sleep at night."`],
    the_wannabe: [`"ambition. obviously. next question."`],
    default: [`"interesting. go on."`],
  };
  const lineFor = (k) => { const a = LINES[k] || LINES.default; return a[Math.floor(Math.random() * a.length)]; };

  // after you speak, the other side responds — each with their OWN beat (pacing = character)
  const runOpponentTurn = () => {
    let delay = 0;
    theirSide.forEach((p, idx) => {
      const beat = BEAT[p.pkey] || BEAT.default;
      // rise as they take the floor
      setTimeout(() => setSpeaking(p.pkey), delay);
      // they speak after their beat
      setTimeout(() => pushFeed({ who: 'opp', name: p.name, text: lineFor(p.pkey) }), delay + beat);
      delay += beat + 700; // gap between speakers so you can follow who's who
    });
    // then teammate (if any) adds after them, their own beat
    if (mate) {
      const beat = BEAT[mate.key] || BEAT.default;
      setTimeout(() => setSpeaking(mate.key), delay);
      setTimeout(() => pushFeed({ who: 'mate', name: mate.name, text: lineFor(mate.key) }), delay + beat);
      delay += beat + 700;
    }
    // moderator may nudge, then floor returns to you
    setTimeout(() => {
      setSpeaking('you');
      setRound((r) => r + 1);
    }, delay + 300);
  };

  const sendTurn = () => {
    const t = draft.trim();
    if (!t || speaking !== 'you') return;
    setDraft('');
    pushFeed({ who: 'you', name: 'you', text: t });
    setSpeaking(null);
    setTimeout(runOpponentTurn, 500);
  };

  const callJudgement = () => {
    setSpeaking('mod');
    setTimeout(() => {
      pushFeed({ who: 'mod', name: mod.name, text: `"i've heard enough. that was well-fought — but the edge tonight goes to ${round >= 2 ? 'you' : theirSide[0].name}. ${round >= 2 ? 'you earned it.' : 'run it back?'}"` });
    }, 1000);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#161020', '#0E0912', '#080509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{gameName}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* the moderator, presiding, at the head */}
        <View style={styles.modRow}>
          <Presence pkey={mod.key} name={mod.name} tone={mod.tone} speaking={speaking === 'mod'} small />
          <Text style={styles.modLabel}>presiding</Text>
        </View>

        {/* the two sides, facing */}
        <View style={styles.sides}>
          <View style={styles.side}>
            {yourSide.map((p) => (
              <Presence key={p.pkey} pkey={p.pkey} name={p.name} tone={p.tone} isYou={p.isYou}
                speaking={speaking === (p.isYou ? 'you' : p.pkey)} />
            ))}
          </View>
          <Text style={styles.versus}>vs</Text>
          <View style={styles.side}>
            {theirSide.map((p) => (
              <Presence key={p.pkey} pkey={p.pkey} name={p.name} tone={p.tone}
                speaking={speaking === p.pkey} />
            ))}
          </View>
        </View>

        {/* the motion */}
        <View style={styles.motionCard}>
          <Text style={styles.motionLabel}>the motion</Text>
          <Text style={styles.motionText}>{motion}</Text>
        </View>

        {/* the exchange */}
        <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{ paddingVertical: 10 }} showsVerticalScrollIndicator={false}>
          {feed.map((f, i) => (
            <View key={i} style={styles.turn}>
              {f.who === 'sys' ? (
                <Text style={styles.sysLine}>{f.text}</Text>
              ) : (
                <>
                  <Text style={[styles.turnName,
                    f.who === 'you' ? { color: C.ember } :
                    f.who === 'mod' ? { color: mod.tone } :
                    f.who === 'mate' ? { color: C.accentSoft } : { color: opp.tone }]}>
                    {f.name}
                  </Text>
                  <Text style={[styles.turnText, (f.who === 'mod') && styles.modText]}>{f.text}</Text>
                </>
              )}
            </View>
          ))}
          {speaking && speaking !== 'you' && speaking !== 'mod' && (
            <Text style={styles.thinking}>· · ·</Text>
          )}
        </ScrollView>

        {/* your input / judgement */}
        {speaking === 'you' ? (
          <View style={styles.inputRow}>
            <TextInput
              value={draft} onChangeText={setDraft} onSubmitEditing={sendTurn}
              placeholder={gid === 'debate' ? 'argue your side…' : 'your move…'}
              placeholderTextColor={C.faint} style={styles.input} returnKeyType="send" multiline
            />
            <Pressable style={styles.sendBtn} onPress={sendTurn}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sendInner}>
                <Text style={styles.sendText}>speak</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.waitRow}>
            <Text style={styles.waitText}>
              {speaking === 'mod' ? `${mod.name} is presiding…` : 'the floor is theirs…'}
            </Text>
          </View>
        )}

        {round >= 2 && speaking === 'you' && (
          <Pressable style={styles.judgeBtn} onPress={callJudgement}>
            <Text style={styles.judgeText}>call for judgement</Text>
          </Pressable>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },

  modRow: { alignItems: 'center', paddingTop: 2 },
  modLabel: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 11, marginTop: 2, letterSpacing: 0.5 },

  sides: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 16, paddingVertical: 8 },
  side: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  versus: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 16, marginTop: 18 },
  presence: { alignItems: 'center', width: 66 },
  ring: { position: 'absolute', top: -6, borderWidth: 2 },
  fallback: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  presenceName: { fontFamily: FONTS.body, color: C.muted, fontSize: 11, marginTop: 4 },

  motionCard: { marginHorizontal: 20, marginTop: 4, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.18)', backgroundColor: 'rgba(243,168,95,0.05)' },
  motionLabel: { fontFamily: FONTS.body, color: C.faint, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' },
  motionText: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 17, lineHeight: 24, marginTop: 4 },

  feed: { flex: 1, marginHorizontal: 20, marginTop: 8 },
  turn: { marginBottom: 12 },
  turnName: { fontFamily: FONTS.semibold, fontSize: 12, marginBottom: 3, letterSpacing: 0.3 },
  turnText: { fontFamily: FONTS.body, color: C.cream, fontSize: 15, lineHeight: 22 },
  modText: { fontFamily: FONTS.displayItalic, color: '#B8D4C4' },
  sysLine: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13, textAlign: 'center', marginVertical: 4 },
  thinking: { color: C.accentSoft, fontSize: 22, textAlign: 'center', letterSpacing: 4, marginTop: 4 },

  inputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingVertical: 10, alignItems: 'flex-end' },
  input: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 15, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)', maxHeight: 100 },
  sendBtn: { borderRadius: 16, overflow: 'hidden' },
  sendInner: { paddingHorizontal: 20, paddingVertical: 13 },
  sendText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 14 },

  waitRow: { paddingVertical: 18, alignItems: 'center' },
  waitText: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 15 },

  judgeBtn: { alignSelf: 'center', marginBottom: 10, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(120,180,150,0.4)' },
  judgeText: { fontFamily: FONTS.semibold, color: '#8FD9B4', fontSize: 14, letterSpacing: 0.3 },
});
