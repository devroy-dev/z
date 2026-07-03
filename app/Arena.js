// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE ARENA. The antidote to doomscrolling: put the feed down and
//  actually PLAY, with someone present. Always ≥1 AI at the table, so you're
//  never alone (even at 3am). You pick the GAME, then pick your OPPONENT —
//  and each opponent plays like THEIR character. Humans invitable.
//  This file: the lobby (games + opponent picker). Game surfaces prove the
//  PACING LAW — nothing machine-instant; the AI takes time, in character.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, RadialGradient, Stop, Circle, Path, Rect } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';
import { TABLE_CAST } from './games/personas';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=2`;

// ── the games (from PWA + Dev adds), grouped by flavor ──
const SECTIONS = [
  { label: 'cards', games: [
    { id: 'teenpatti', name: 'Teen Patti', tone: '#F0A765', blurb: 'read the table. bluff or fold.' },
    { id: 'poker', name: "Hold'em", tone: '#E0C088', blurb: 'five-handed. all in, or fold.' },
    { id: 'callbreak', name: 'Callbreak', tone: '#8FD98F', blurb: 'call your tricks. spades rule.' },
    { id: 'pusoy', name: 'Pusoy Dos', tone: '#6FC9E0', blurb: 'thirteen cards. diamonds are boss.' },
    { id: 'rummy', name: 'Rummy', tone: '#F0708C', blurb: 'sets, sequences, sharp memory.' },
    { id: 'blackjack', name: 'Blackjack', tone: '#8FD98F', blurb: 'beat the house, baby.' },
    { id: 'bluff', name: 'Bluff', tone: '#F0708C', blurb: 'lie, call, get read.' },
    { id: 'uno', name: 'UNO', tone: '#6FC9E0', blurb: 'first to empty wins.' },
  ]},
  { label: 'the board', games: [
    { id: 'ludo', name: 'Ludo', tone: '#F0A765', blurb: 'the desi classic. race home.' },
    { id: 'carrom', name: 'Carrom', tone: '#E0C088', blurb: 'flick, pocket, win.' },
    { id: 'chess', name: 'Chess', tone: '#C99BE8', blurb: 'the long game.' },
    { id: 'snakes', name: 'Snakes & Ladders', tone: '#8FD98F', blurb: 'saanp seedhi, baby.' },
  ]},
  { label: 'fast hands', games: [
    { id: 'liarsdice', name: "Liar's Dice", tone: '#F0A765', blurb: 'five dice, one straight face.' },
    { id: 'airhockey', name: 'Air Hockey', tone: '#6FC9E0', blurb: 'fast hands win.' },
    { id: 'hangman', name: 'Hangman', tone: '#E0C088', blurb: "guess before it's too late." },
  ]},
  { label: 'mind duels', games: [
    { id: 'trivia', name: 'Trivia Duel', tone: '#6FC9E0', blurb: 'pick a topic. how many?' },
    { id: 'debate', name: 'Debate Zone', tone: '#F0708C', blurb: 'argue your side.' },
    { id: 'twenty', name: '20 Questions', tone: '#C99BE8', blurb: "they've got 20 guesses." },
    { id: 'wyr', name: 'Would You Rather', tone: '#F0A765', blurb: 'pick one. defend it.' },
    { id: 'riddle', name: 'Riddle Me', tone: '#E0C088', blurb: 'the gauntlet. call it when you dare.' },
    { id: 'dilemma', name: 'Dilemma Zone', tone: '#6FC9E0', blurb: 'no clean answers. hold your reasoning.' },
  ]},
];
const GAMES = SECTIONS.flatMap(s => s.games);

// ── the table cast: the WHOLE gathering can sit down, grouped like the roster ──
const OPPONENTS = TABLE_CAST;
const CAST_GROUPS = [...new Set(TABLE_CAST.map((p) => p.group))];

function hexA(hex, a) {
  const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}
function GameCard({ game, onPick }) {
  const b = useSharedValue(0.5);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 3000 + game.name.length * 90, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const glow = useAnimatedStyle(() => ({ opacity: 0.45 + b.value * 0.45, transform: [{ scale: 0.95 + b.value * 0.1 }] }));
  return (
    <Pressable style={styles.gameCard} onPress={() => onPick(game)}>
      <View style={[styles.gameInner, { borderColor: hexA(game.tone, 0.28) }]}>
        {/* tinted tactile ground per game */}
        <LinearGradient
          colors={[hexA(game.tone, 0.16), hexA(game.tone, 0.05), 'rgba(10,7,16,0.4)']}
          locations={[0, 0.5, 1]} start={{x:0,y:0}} end={{x:1,y:1}}
          style={StyleSheet.absoluteFill}
        />
        {/* corner bloom */}
        <Animated.View style={[styles.gameBloom, glow]}>
          <Svg width="120" height="120"><Defs><RadialGradient id={`g_${game.id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={game.tone} stopOpacity="0.55" /><Stop offset="55%" stopColor={game.tone} stopOpacity="0.12" /><Stop offset="100%" stopColor={game.tone} stopOpacity="0" />
          </RadialGradient></Defs><Circle cx="60" cy="60" r="60" fill={`url(#g_${game.id})`} /></Svg>
        </Animated.View>
        {/* the glyph, large and expressive */}
        <View style={styles.glyphHolder}><GameGlyph id={game.id} tone={game.tone} /></View>
        <View style={styles.gameFoot}>
          <Text style={[styles.gameName, { color: '#FBF3E9' }]}>{game.name}</Text>
          <Text style={styles.gameBlurb} numberOfLines={1}>{game.blurb}</Text>
        </View>
      </View>
    </Pressable>
  );
}

// distinctive, expressive glyphs per game
function GameGlyph({ id, tone }) {
  const p = { stroke: tone, strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  const f = { fill: tone };
  return (
    <Svg width="42" height="42" viewBox="0 0 24 24">
      {/* cards — fanned cards with a suit */}
      {(id === 'teenpatti' || id === 'poker') && <>
        <Rect x="4" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8.5 12.5)" {...p} />
        <Rect x="11" y="5" width="9" height="13" rx="1.5" transform="rotate(12 15.5 11.5)" {...p} />
        <Path d="M15.5 9c-1-1.4-3-.6-3 .9 0 1.2 1.7 2.4 3 3.3 1.3-.9 3-2.1 3-3.3 0-1.5-2-2.3-3-.9z" {...f} />
      </>}
      {id === 'rummy' && <>
        <Rect x="4" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8.5 12.5)" {...p} />
        <Rect x="11" y="5" width="9" height="13" rx="1.5" transform="rotate(12 15.5 11.5)" {...p} />
        <Path d="M15.5 8l1.4 2.8 3 .3-2.2 2 .6 3-2.8-1.6-2.8 1.6.6-3-2.2-2 3-.3z" {...p} strokeWidth="1" />
      </>}
      {id === 'blackjack' && <>
        <Rect x="4" y="6" width="9" height="13" rx="1.5" transform="rotate(-12 8.5 12.5)" {...p} />
        <Rect x="11" y="5" width="9" height="13" rx="1.5" transform="rotate(12 15.5 11.5)" {...p} />
        <Path d="M15.5 14c-1.6 0-2.6-1.3-2.6-2.6 0-2 2.6-3.4 2.6-3.4s2.6 1.4 2.6 3.4c0 1.3-1 2.6-2.6 2.6zM15.5 14v2" {...p} strokeWidth="1" />
      </>}
      {id === 'bluff' && <>
        <Rect x="5" y="5" width="9" height="13" rx="1.5" {...p} />
        <Rect x="10" y="7" width="9" height="13" rx="1.5" {...p} />
      </>}
      {id === 'uno' && <><Rect x="6" y="4" width="12" height="16" rx="2.5" {...p} /><Path d="M12 8v8" stroke={tone} strokeWidth="2.5" strokeLinecap="round"/></>}
      {id === 'ludo' && <><Rect x="4" y="4" width="16" height="16" rx="2.5" {...p} /><Circle cx="9" cy="9" r="1.6" fill={tone} /><Circle cx="15" cy="9" r="1.6" fill={tone} /><Circle cx="9" cy="15" r="1.6" fill={tone} /><Circle cx="15" cy="15" r="1.6" fill={tone} /></>}
      {id === 'carrom' && <><Rect x="3" y="3" width="18" height="18" rx="2" {...p} /><Circle cx="12" cy="12" r="2.5" {...p} /><Circle cx="6" cy="6" r="1.4" fill={tone}/><Circle cx="18" cy="18" r="1.4" fill={tone}/></>}
      {id === 'chess' && <Path d="M8.5 20h7M9.5 20l-.5-4.5M14.5 20l.5-4.5M8 15.5h8M10 15.5c-2.2-2.2-1-5.5 2-5.5s4.2 3.3 2 5.5M12 10V6.5M10 6.5h4" {...p} />}
      {id === 'snakes' && <Path d="M5 18c4.5 0 3.5-7 8.5-7s3 6 5.5 6M6.5 5.5l3 3M15 5.5l3.5 3.5M18 6.5l1-1" {...p} />}
      {id === 'hangman' && <><Path d="M6 20V4h9M15 4v3.5" {...p}/><Circle cx="15" cy="10" r="2" {...p}/><Path d="M15 12v4M13 14h4M15 16l-1.5 3M15 16l1.5 3" {...p}/></>}
      {id === 'airhockey' && <><Rect x="5" y="3" width="14" height="18" rx="2" {...p}/><Path d="M5 12h14" {...p}/><Circle cx="12" cy="12" r="1.6" fill={tone}/></>}
      {(id === 'trivia' || id === 'twenty') && <><Circle cx="12" cy="12" r="9" {...p}/><Path d="M9.5 9.5a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17.5h.01" {...p}/></>}
      {id === 'debate' && <><Path d="M4 7a2 2 0 012-2h6a2 2 0 012 2v3a2 2 0 01-2 2H8l-3 2v-2a2 2 0 01-1-2z" {...p}/><Path d="M15 10h3a2 2 0 012 2v3l-2-1.5h-4" {...p}/></>}
      {id === 'wyr' && <Path d="M12 4v6M12 10L7 20M12 10l5 10M6 20h3M15 20h3" {...p}/>}
    </Svg>
  );
}

// ── the opponent picker (appears after a game is chosen) — MULTI-SELECT ──
function OpponentPicker({ game, onBack, onStart }) {
  const [invited, setInvited] = useState(false);
  const [chosen, setChosen] = useState([]);   // array of opponent keys
  // board games + card games can seat up to 3 others; verbal duels up to 3 (2v2 mixes)
  const maxOthers = game?.id === 'poker' ? 4 : 3;   // hold'em seats five
  const toggle = (o) => {
    setChosen((cur) => {
      if (cur.find((c) => c.key === o.key)) return cur.filter((c) => c.key !== o.key);
      if (cur.length >= maxOthers) return cur;   // cap
      return [...cur, o];
    });
  };
  const launch = () => {
    const roster = chosen.map((o) => ({ ...o, ai: true }));
    // pass first as `opp` for back-compat, full list as `roster`
    onStart(game, chosen[0], roster, invited);
  };
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#160F1C', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.pickHeader}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.pickKicker}>{game.name}</Text>
            <Text style={styles.pickTitle}>who's at the table?</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          <Text style={styles.pickNote}>pick one for a duel, or up to three for a full table. each plays like themselves.</Text>
          {CAST_GROUPS.map((grp) => (
            <View key={grp}>
              <Text style={styles.castGroup}>{grp}</Text>
              {OPPONENTS.filter((o) => o.group === grp).map((o) => {
            const on = !!chosen.find((c) => c.key === o.key);
            return (
              <Pressable key={o.key} style={[styles.oppRow, on && styles.oppRowOn]} onPress={() => toggle(o)}>
                <OppFace pkey={o.key} tone={o.tone} />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.oppName}>{o.name}</Text>
                  <Text style={styles.oppStyle} numberOfLines={1}>{o.style}</Text>
                </View>
                <View style={[styles.checkDot, on && { backgroundColor: o.tone, borderColor: o.tone }]}>
                  {on && <Text style={styles.checkTick}>✓</Text>}
                </View>
              </Pressable>
            );
          })}
            </View>
          ))}

          {['liarsdice', 'callbreak', 'poker', 'pusoy', 'ludo', 'debate'].includes(game?.id) && (
          <Pressable style={[styles.inviteRow, invited && { borderColor: 'rgba(240,167,101,0.6)' }]} onPress={() => setInvited((v) => !v)}>
            <View style={styles.invitePlus}><Text style={styles.invitePlusText}>+</Text></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.oppName}>{invited ? 'friend invited' : 'invite a friend'}</Text>
              <Text style={styles.oppStyle}>{invited ? 'a live table will open — the invite link shares when you sit down.' : 'a live table opens and the invite link shares when you sit down.'}</Text>
            </View>
          </Pressable>
          )}
        </ScrollView>

        {/* launch bar */}
        {(chosen.length > 0 || invited) && (
          <View style={styles.launchBar}>
            <Text style={styles.launchCount}>
              {chosen.length === 1 ? `1v1 · you vs ${chosen[0].name}` : `you + ${chosen.length} at the table`}
            </Text>
            <Pressable style={styles.launchBtn} onPress={launch}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.launchInner}>
                <Text style={styles.launchText}>{invited ? 'open the table & share the invite' : 'take your seat ›'}</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

function OppFace({ pkey, tone }) {
  const [ok, setOk] = useState(true);
  const S = 52;
  return (
    <View style={[styles.oppFace, { width: S, height: S, borderRadius: S / 2, borderColor: tone }]}>
      {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: S / 2 }} onError={() => setOk(false)} />
          : <Svg width={S} height={S} viewBox="0 0 52 52"><Defs><RadialGradient id={`of_${pkey}`} cx="38%" cy="33%" r="70%"><Stop offset="0%" stopColor="#FFD09A" /><Stop offset="60%" stopColor={tone} /><Stop offset="100%" stopColor={C.emberDeep} /></RadialGradient></Defs><Circle cx="26" cy="26" r="26" fill={`url(#of_${pkey})`} /></Svg>}
    </View>
  );
}

// ── the lobby ──
export default function Arena({ onBack = () => {}, onStartGame = () => {}, initialGameId = null }) {
  const [picked, setPicked] = useState(() => GAMES.find((g) => g.id === initialGameId) || null); // a programme card lands you AT the table, not the shelf

  if (picked) {
    return <OpponentPicker game={picked} onBack={() => setPicked(null)} onStart={(g, o, roster, invited) => onStartGame(g, o, roster, invited)} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#160F1C', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text style={styles.kicker}>put the feed down</Text>
            <Text style={styles.title}>the arena</Text>
          </View>
        </View>
        <Text style={styles.intro}>real games, someone always at the table. pick one — then pick who you're up against.</Text>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}>
          {SECTIONS.map((sec) => (
            <View key={sec.label} style={{ marginBottom: 8 }}>
              <Text style={styles.secLabel}>{sec.label}</Text>
              <View style={styles.grid}>
                {sec.games.map((g) => <GameCard key={g.id} game={g} onPick={setPicked} />)}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 11.5, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 30, marginTop: 1 },
  intro: { fontFamily: FONTS.light, color: C.muted, fontSize: 14, lineHeight: 21, paddingHorizontal: 24, marginTop: 6, marginBottom: 8, maxWidth: 340 },

  secLabel: { fontFamily: FONTS.semibold, color: C.accentSoft, fontSize: 11.5, letterSpacing: 2, textTransform: 'uppercase', paddingHorizontal: 22, marginBottom: 10, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16 },
  gameCard: { width: '48%', marginBottom: 13 },
  gameInner: { borderRadius: 22, borderWidth: 1, height: 138, overflow: 'hidden', justifyContent: 'flex-end' },
  gameBloom: { position: 'absolute', top: -30, right: -30 },
  glyphHolder: { position: 'absolute', top: 20, left: 18 },
  gameFoot: { padding: 15, paddingTop: 0 },
  gameName: { fontFamily: FONTS.display, fontSize: 19, color: '#FBF3E9' },
  gameBlurb: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 12, marginTop: 2 },

  // opponent picker
  pickHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  pickKicker: { fontFamily: FONTS.body, color: C.accentSoft, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  pickTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 26, marginTop: 1 },
  pickNote: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14, paddingHorizontal: 24, marginTop: 8, marginBottom: 14 },
  oppRowOn: { backgroundColor: 'rgba(243,168,95,0.08)' },
  checkDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkTick: { color: '#3A1505', fontSize: 13, fontWeight: '700' },
  launchBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, backgroundColor: 'rgba(14,9,18,0.95)', borderTopWidth: 1, borderTopColor: 'rgba(243,168,95,0.15)' },
  launchCount: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14, textAlign: 'center', marginBottom: 10 },
  launchBtn: { borderRadius: 16, overflow: 'hidden' },
  launchInner: { paddingVertical: 15, alignItems: 'center' },
  launchText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 16, letterSpacing: 0.4 },
  castGroup: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  oppRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9 },
  oppFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1a121f' },
  oppName: { fontFamily: FONTS.medium, color: C.cream, fontSize: 16 },
  oppStyle: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, marginTop: 2 },
  chipGo: { fontFamily: FONTS.semibold, color: C.accent, fontSize: 18, paddingHorizontal: 6 },

  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9, marginTop: 8, marginHorizontal: 8, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(243,168,95,0.18)', borderStyle: 'dashed' },
  invitePlus: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(243,168,95,0.35)', backgroundColor: 'rgba(243,168,95,0.06)' },
  invitePlusText: { color: C.accent, fontSize: 26, marginTop: -2 },
});
