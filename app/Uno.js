// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO. The first fully-real game: real rules, clean 2D rendering, and
//  a LIVING opponent — the persona reacts through the real engine (streamChat),
//  not canned lines. When you play a card the game tells the persona what just
//  happened and they reply IN THEIR VOICE. When you talk, your words go to them
//  and they actually answer. That living opponent is the whole point.
//
//  Rules: match color OR number/symbol on the discard. Action cards: Skip,
//  Reverse (2p = skip), Draw Two, Wild, Wild Draw Four. First to empty wins.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { C, FONTS } from './theme';
import { openThread, streamChat } from './api';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');

const COLORS = { R: '#E5573F', G: '#5FB85F', B: '#4A90D9', Y: '#E5B84A' };
const COLOR_NAME = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };

// build a real UNO deck
function makeDeck() {
  const d = [];
  const cols = ['R', 'G', 'B', 'Y'];
  for (const c of cols) {
    d.push({ c, v: '0' });
    for (let n = 1; n <= 9; n++) { d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
    for (const a of ['skip', 'rev', 'd2']) { d.push({ c, v: a }); d.push({ c, v: a }); }
  }
  for (let i = 0; i < 4; i++) { d.push({ c: 'W', v: 'wild' }); d.push({ c: 'W', v: 'wd4' }); }
  // shuffle
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

const label = (card) => {
  if (card.v === 'wild') return 'WILD';
  if (card.v === 'wd4') return '+4';
  if (card.v === 'skip') return 'Ø';
  if (card.v === 'rev') return '⟲';
  if (card.v === 'd2') return '+2';
  return card.v;
};

// can `card` be played on `top` (with active color)?
function canPlay(card, top, activeColor) {
  if (card.c === 'W') return true;
  if (card.c === activeColor) return true;
  if (card.v === top.v && ['skip', 'rev', 'd2'].includes(card.v)) return true;
  if (card.v === top.v) return true;
  return false;
}

// ── a real UNO card ──
function UnoCard({ card, faceDown, onPress, playable, w = 46, h = 68 }) {
  if (faceDown) {
    return <View style={[cs.card, { width: w, height: h, backgroundColor: '#1a1526', borderColor: '#3a2f4a' }]}>
      <Text style={cs.backMark}>Z</Text>
    </View>;
  }
  const bg = card.c === 'W' ? '#241a30' : COLORS[card.c];
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={[cs.card, { width: w, height: h, backgroundColor: bg }, playable && cs.playable]}>
      <View style={cs.oval} />
      <Text style={[cs.cardLabel, card.c === 'W' && { color: '#fff' }]}>{label(card)}</Text>
      {card.c === 'W' && <View style={cs.wildDots}>
        <View style={[cs.wd, { backgroundColor: COLORS.R }]} /><View style={[cs.wd, { backgroundColor: COLORS.G }]} />
        <View style={[cs.wd, { backgroundColor: COLORS.B }]} /><View style={[cs.wd, { backgroundColor: COLORS.Y }]} />
      </View>}
    </Pressable>
  );
}

export default function Uno({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765' };

  const [deck, setDeck] = useState([]);
  const [you, setYou] = useState([]);
  const [oppHand, setOppHand] = useState([]);
  const [discard, setDiscard] = useState(null);
  const [activeColor, setActiveColor] = useState('R');
  const [turn, setTurn] = useState('you');       // you | opp
  const [phase, setPhase] = useState('play');    // play | wild | over
  const [pendingWild, setPendingWild] = useState(null); // card awaiting color pick
  const [winner, setWinner] = useState(null);
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([]);
  const [okFace, setOkFace] = useState(true);
  const [banter, setBanter] = useState('');       // live streaming banter line
  const threadRef = useRef(null);
  const feedRef = useRef(null);

  const pushFeed = (l) => { setFeed(f => [...f, l]); setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60); };

  // open a real thread with the persona so banter is LIVE
  useEffect(() => {
    (async () => { threadRef.current = await openThread(opp.key, `uno with ${opp.name}`); })();
    dealNew();
  }, []);

  // ask the real persona to react to a game event, in their voice, streamed live
  const personaReact = useCallback((situation) => {
    if (!threadRef.current) return; // no engine → stay silent rather than fake it
    setBanter('');
    const hidden = `[You are playing a casual game of UNO with the user. ${situation} React in character with ONE short, natural line — like a real opponent talking across the table. No stage directions.]`;
    streamChat({
      threadId: threadRef.current, persona: opp.key, message: hidden,
      onToken: (acc) => setBanter(acc),
      onDone: (final) => { if (final && final.trim()) pushFeed({ who: 'opp', text: `${opp.name}: ${final.trim()}` }); setBanter(''); },
      onError: () => setBanter(''),
    });
  }, [opp.key, opp.name]);

  const dealNew = () => {
    const d = makeDeck();
    const y = d.splice(0, 7);
    const o = d.splice(0, 7);
    // first discard: draw until a number card
    let first = d.shift();
    while (first.c === 'W' || ['skip', 'rev', 'd2'].includes(first.v)) { d.push(first); first = d.shift(); }
    setYou(y); setOppHand(o); setDiscard(first); setActiveColor(first.c);
    setDeck(d); setTurn('you'); setPhase('play'); setWinner(null); setBanter('');
    setFeed([{ who: 'sys', text: `you're dealt 7. match ${COLOR_NAME[first.c]} or ${label(first)}.` }]);
  };

  const drawCard = (who, n = 1) => {
    setDeck((cur) => {
      let d = [...cur];
      if (d.length < n) d = d.concat(makeDeck());
      const drawn = d.splice(0, n);
      if (who === 'you') setYou((h) => [...h, ...drawn]);
      else setOppHand((h) => [...h, ...drawn]);
      return d;
    });
  };

  // apply the effect of a just-played card; returns whether the *next* player is skipped
  const applyEffect = (card, byWho) => {
    const other = byWho === 'you' ? 'opp' : 'you';
    if (card.v === 'd2') { drawCard(other, 2); return true; }      // 2p: draw + skip
    if (card.v === 'wd4') { drawCard(other, 4); return true; }
    if (card.v === 'skip' || card.v === 'rev') return true;         // 2p reverse = skip
    return false;
  };

  const finishTurn = (byWho, skipped, playedCard) => {
    // win check
    if (byWho === 'you' && you.length === 0) { setWinner('you'); setPhase('over'); personaReact('The user just played their last card and WON the game.'); return; }
    if (byWho === 'opp' && oppHand.length === 0) { setWinner('opp'); setPhase('over'); return; }
    const next = skipped ? byWho : (byWho === 'you' ? 'opp' : 'you');
    setTurn(next);
  };

  const playCard = (idx) => {
    if (turn !== 'you' || phase !== 'play') return;
    const card = you[idx];
    if (!canPlay(card, discard, activeColor)) { pushFeed({ who: 'sys', text: `can't play that — match ${COLOR_NAME[activeColor]} or ${label(discard)}.` }); return; }
    if (card.c === 'W') { setPendingWild({ idx, card }); setPhase('wild'); return; }
    const newHand = you.filter((_, i) => i !== idx);
    setYou(newHand); setDiscard(card); setActiveColor(card.c);
    pushFeed({ who: 'sys', text: `you played ${COLOR_NAME[card.c]} ${label(card)}.` });
    const skipped = applyEffect(card, 'you');
    // living banter for notable plays
    if (card.v === 'd2') personaReact('The user just played a Draw Two on you — you must draw 2 cards and lose your turn.');
    else if (card.v === 'skip') personaReact('The user just skipped your turn with a Skip card.');
    else if (newHand.length === 1) personaReact('The user is down to their LAST card — one away from winning.');
    setTimeout(() => finishTurn('you', skipped, card), 250);
  };

  const pickWildColor = (col) => {
    const { idx, card } = pendingWild;
    const newHand = you.filter((_, i) => i !== idx);
    setYou(newHand); setDiscard(card); setActiveColor(col); setPendingWild(null); setPhase('play');
    pushFeed({ who: 'sys', text: `you played ${label(card)} → ${COLOR_NAME[col]}.` });
    const skipped = applyEffect(card, 'you');
    if (card.v === 'wd4') personaReact(`The user just played a Wild Draw Four and chose ${COLOR_NAME[col]} — you must draw 4 and lose your turn.`);
    setTimeout(() => finishTurn('you', skipped, card), 250);
  };

  const drawForYou = () => {
    if (turn !== 'you' || phase !== 'play') return;
    drawCard('you', 1);
    pushFeed({ who: 'sys', text: `you drew a card.` });
    setTimeout(() => setTurn('opp'), 300);
  };

  // ── opponent's turn: real UNO strategy + a beat ──
  useEffect(() => {
    if (turn !== 'opp' || phase === 'over') return;
    const beat = opp.key === 'the_brainiac' ? 1300 : opp.key === 'the_wannabe' ? 650 : 950;
    const t = setTimeout(() => {
      setOppHand((hand) => {
        const playableIdx = hand.map((c, i) => canPlay(c, discard, activeColor) ? i : -1).filter(i => i >= 0);
        if (playableIdx.length === 0) {
          // draw one, then pass
          drawCard('opp', 1);
          pushFeed({ who: 'sys', text: `${opp.name} draws a card.` });
          setTimeout(() => setTurn('you'), 500);
          return hand;
        }
        // choose: prefer action cards when user is low, else highest number
        const pick = playableIdx[Math.floor(Math.random() * playableIdx.length)];
        const card = hand[pick];
        const newHand = hand.filter((_, i) => i !== pick);
        let chosenColor = card.c;
        if (card.c === 'W') { const cols = ['R', 'G', 'B', 'Y']; chosenColor = cols[Math.floor(Math.random() * 4)]; }
        setDiscard(card); setActiveColor(chosenColor);
        pushFeed({ who: 'sys', text: `${opp.name} played ${card.c === 'W' ? label(card) + ' → ' + COLOR_NAME[chosenColor] : COLOR_NAME[card.c] + ' ' + label(card)}.` });
        const skipped = applyEffect(card, 'opp');
        // living banter when they hit you
        if (card.v === 'd2' || card.v === 'wd4') personaReact(`You just played a ${card.v === 'wd4' ? 'Wild Draw Four' : 'Draw Two'} on the user, making them draw cards. Gloat lightly in character.`);
        else if (newHand.length === 1) personaReact('You are now down to your last card — about to win. Say something in character.');
        setTimeout(() => {
          if (newHand.length === 0) { setWinner('opp'); setPhase('over'); }
          else setTurn(skipped ? 'opp' : 'you');
        }, 300);
        return newHand;
      });
    }, beat);
    return () => clearTimeout(t);
  }, [turn, phase]);

  const sendChat = () => {
    const t = draft.trim(); if (!t) return;
    setDraft(''); pushFeed({ who: 'you', text: t });
    // your real words go to the persona; they actually reply
    if (threadRef.current) {
      setBanter('');
      streamChat({
        threadId: threadRef.current, persona: opp.key,
        message: `[During your UNO game, the user says to you:] ${t}`,
        onToken: (acc) => setBanter(acc),
        onDone: (final) => { if (final && final.trim()) pushFeed({ who: 'opp', text: `${opp.name}: ${final.trim()}` }); setBanter(''); },
        onError: () => setBanter(''),
      });
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#141020', '#0E0912', '#080509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'UNO'}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* opponent */}
        <View style={styles.oppRow}>
          {okFace ? (
            <Image source={{ uri: faceFor(opp.key) }} onError={() => setOkFace(false)} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 2, borderColor: opp.tone }} />
          ) : <View style={[styles.fallback, { borderColor: opp.tone }]}><Text style={{ color: opp.tone, fontFamily: FONTS.display, fontSize: 18 }}>{opp.name[0]}</Text></View>}
          <Text style={styles.oppName}>{opp.name}</Text>
          <Text style={styles.count}>{oppHand.length} cards</Text>
        </View>
        {/* opponent hand (face down) */}
        <View style={styles.oppHand}>
          {oppHand.slice(0, 10).map((_, i) => <UnoCard key={i} faceDown w={30} h={44} />)}
        </View>

        {/* live banter bubble */}
        {(banter || turn === 'opp') ? (
          <Text style={styles.banter}>{banter || '· · ·'}</Text>
        ) : <View style={{ height: 22 }} />}

        {/* discard pile + draw */}
        <View style={styles.middle}>
          <Pressable onPress={drawForYou} disabled={turn !== 'you' || phase !== 'play'} style={[styles.drawPile, (turn !== 'you' || phase !== 'play') && { opacity: 0.5 }]}>
            <UnoCard faceDown w={52} h={76} />
            <Text style={styles.drawLabel}>draw</Text>
          </Pressable>
          <View style={styles.discardWrap}>
            {discard && <UnoCard card={{ ...discard, c: discard.c === 'W' ? 'W' : activeColor }} w={62} h={92} />}
            <View style={[styles.colorDot, { backgroundColor: COLORS[activeColor] || '#888' }]} />
          </View>
        </View>

        {winner ? (
          <View style={styles.overWrap}>
            <Text style={styles.overText}>{winner === 'you' ? 'you win!' : `${opp.name} wins`}</Text>
            <Pressable style={styles.againBtn} onPress={dealNew}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.againInner}>
                <Text style={styles.againText}>deal again</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.turnLabel}>{turn === 'you' ? 'your turn' : `${opp.name}'s turn`}</Text>
        )}

        {/* your hand */}
        {phase === 'wild' ? (
          <View style={styles.wildPick}>
            <Text style={styles.wildPrompt}>pick a color</Text>
            <View style={styles.wildRow}>
              {['R', 'G', 'B', 'Y'].map((col) => (
                <Pressable key={col} onPress={() => pickWildColor(col)} style={[styles.wildSwatch, { backgroundColor: COLORS[col] }]} />
              ))}
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yourHand}>
            {you.map((card, i) => (
              <UnoCard key={i} card={card} onPress={() => playCard(i)}
                playable={turn === 'you' && phase === 'play' && canPlay(card, discard, activeColor)}
                w={48} h={72} />
            ))}
          </ScrollView>
        )}

        {/* feed + chat */}
        <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{ paddingVertical: 4 }} showsVerticalScrollIndicator={false}>
          {feed.map((f, i) => <Text key={i} style={[styles.feedLine, f.who === 'you' ? styles.feedYou : f.who === 'opp' ? styles.feedOpp : styles.feedSys]}>{f.who === 'you' ? `you: ${f.text}` : f.text}</Text>)}
        </ScrollView>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={sendChat}
          placeholder={`say something to ${opp.name}…`} placeholderTextColor={C.faint} style={styles.chatInput} returnKeyType="send" />
      </SafeAreaView>
    </View>
  );
}

const cs = StyleSheet.create({
  card: { borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', marginHorizontal: 3, overflow: 'hidden' },
  playable: { borderColor: '#fff', shadowColor: '#fff', shadowOpacity: 0.5, shadowRadius: 6, elevation: 6 },
  oval: { position: 'absolute', width: '70%', height: '86%', borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.14)', transform: [{ rotate: '30deg' }] },
  cardLabel: { fontFamily: FONTS.semibold, color: '#fff', fontSize: 20, textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 2 },
  backMark: { fontFamily: FONTS.display, color: '#F3A85F', fontSize: 18 },
  wildDots: { position: 'absolute', bottom: 4, flexDirection: 'row', gap: 2 },
  wd: { width: 5, height: 5, borderRadius: 3 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },
  oppRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  fallback: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  oppName: { fontFamily: FONTS.display, color: C.cream, fontSize: 16 },
  count: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  oppHand: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  banter: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 24, minHeight: 22 },
  middle: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40, marginTop: 8 },
  drawPile: { alignItems: 'center', gap: 4 },
  drawLabel: { fontFamily: FONTS.body, color: C.muted, fontSize: 11 },
  discardWrap: { alignItems: 'center' },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginTop: 6 },
  turnLabel: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 15, textAlign: 'center', marginTop: 10 },
  overWrap: { alignItems: 'center', marginTop: 10, gap: 10 },
  overText: { fontFamily: FONTS.display, color: C.ember, fontSize: 26 },
  againBtn: { borderRadius: 15, overflow: 'hidden', width: 160 },
  againInner: { paddingVertical: 12, alignItems: 'center' },
  againText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 15 },
  yourHand: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  wildPick: { alignItems: 'center', paddingVertical: 12, gap: 8 },
  wildPrompt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 16 },
  wildRow: { flexDirection: 'row', gap: 12 },
  wildSwatch: { width: 48, height: 48, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  feed: { maxHeight: 78, marginTop: 4, marginHorizontal: 18 },
  feedLine: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, marginVertical: 1 },
  feedYou: { color: C.cream, textAlign: 'right' },
  feedOpp: { fontFamily: FONTS.displayItalic, color: C.accentSoft },
  feedSys: { color: C.faint, textAlign: 'center', fontSize: 11.5, fontStyle: 'italic' },
  chatInput: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.2)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16, marginVertical: 8 },
});
