// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO (rebuilt). Fixes: LIVE engine banter now actually connects
//  (loadSession → openThread, like chat does), the skip-turn bug, adds the UNO
//  call button, bigger luxury cards, real 2D card-throw animation, roomier layout.
//  The living opponent is the point: the persona reacts through the real engine.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';
import { loadSession, isLoggedIn, openThread, streamChat } from './api';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');

const COLORS = { R: '#E5484D', G: '#46A758', B: '#3E8FD9', Y: '#E0B23A' };
const COLOR_HI = { R: '#FF6B6E', G: '#63C776', B: '#5BA7F0', Y: '#F5CB5C' };
const COLOR_NAME = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };

function makeDeck() {
  const d = []; const cols = ['R', 'G', 'B', 'Y'];
  for (const c of cols) {
    d.push({ c, v: '0' });
    for (let n = 1; n <= 9; n++) { d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
    for (const a of ['skip', 'rev', 'd2']) { d.push({ c, v: a }); d.push({ c, v: a }); }
  }
  for (let i = 0; i < 4; i++) { d.push({ c: 'W', v: 'wild' }); d.push({ c: 'W', v: 'wd4' }); }
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
const label = (card) => card.v === 'wild' ? '★' : card.v === 'wd4' ? '+4' : card.v === 'skip' ? 'Ø' : card.v === 'rev' ? '⟳' : card.v === 'd2' ? '+2' : card.v;
const sublabel = (card) => card.v === 'wild' ? 'WILD' : card.v === 'wd4' ? 'WILD' : card.v === 'skip' ? 'SKIP' : card.v === 'rev' ? 'REV' : card.v === 'd2' ? 'DRAW' : '';

function canPlay(card, top, activeColor) {
  if (!top) return true;
  if (card.c === 'W') return true;
  if (card.c === activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

function UnoCard({ card, faceDown, onPress, playable, w = 62, h = 92, dim }) {
  if (faceDown) {
    return (
      <View style={[cs.card, { width: w, height: h }]}>
        <LinearGradient colors={['#2a1f3a', '#171122']} style={cs.fill}>
          <View style={cs.backOval}><Text style={[cs.backZ, { fontSize: h * 0.32 }]}>Z</Text></View>
        </LinearGradient>
      </View>
    );
  }
  const base = card.c === 'W' ? '#241a30' : COLORS[card.c];
  const hi = card.c === 'W' ? '#3a2b4a' : COLOR_HI[card.c];
  return (
    <Pressable disabled={!onPress} onPress={onPress}
      style={[cs.card, { width: w, height: h }, playable && cs.playable, dim && { opacity: 0.55 }]}>
      <LinearGradient colors={[hi, base]} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={cs.fill}>
        <View style={[cs.oval, { width: w * 0.82, height: h * 0.62 }]} />
        <Text style={[cs.corner, cs.cornerTL, { fontSize: h * 0.16 }]}>{label(card)}</Text>
        <Text style={[cs.corner, cs.cornerBR, { fontSize: h * 0.16 }]}>{label(card)}</Text>
        <View style={cs.center}>
          <Text style={[cs.centerLabel, { fontSize: h * 0.34, color: card.c === 'W' ? '#fff' : base }]}>{label(card)}</Text>
          {sublabel(card) ? <Text style={[cs.subLabel, { color: card.c === 'W' ? '#fff' : base }]}>{sublabel(card)}</Text> : null}
        </View>
        {card.c === 'W' && (
          <View style={cs.wildCorners}>
            <View style={[cs.wq, { backgroundColor: COLORS.R, top: 0, left: 0 }]} />
            <View style={[cs.wq, { backgroundColor: COLORS.B, top: 0, right: 0 }]} />
            <View style={[cs.wq, { backgroundColor: COLORS.Y, bottom: 0, left: 0 }]} />
            <View style={[cs.wq, { backgroundColor: COLORS.G, bottom: 0, right: 0 }]} />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function FlyingCard({ card, from }) {
  const tx = useSharedValue(from.x);
  const ty = useSharedValue(from.y);
  const rot = useSharedValue(from.rot || 0);
  const sc = useSharedValue(0.8);
  useEffect(() => {
    tx.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
    rot.value = withTiming((Math.random() - 0.5) * 16, { duration: 320 });
    sc.value = withSpring(1, { damping: 10 });
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }] }));
  return <Animated.View style={[{ position: 'absolute' }, st]}><UnoCard card={card} w={70} h={104} /></Animated.View>;
}

export default function Uno({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765' };

  const [deck, setDeck] = useState([]);
  const [you, setYou] = useState([]);
  const [oppHand, setOppHand] = useState([]);
  const [discard, setDiscard] = useState(null);
  const [flying, setFlying] = useState(null);
  const [activeColor, setActiveColor] = useState('R');
  const [turn, setTurn] = useState('you');
  const [turnNonce, setTurnNonce] = useState(0);
  const goTurn = (who) => { setTurn(who); setTurnNonce((n) => n + 1); };
  const [phase, setPhase] = useState('play');
  const [pendingWild, setPendingWild] = useState(null);
  const [winner, setWinner] = useState(null);
  const [calledUno, setCalledUno] = useState(false);
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([]);
  const [okFace, setOkFace] = useState(true);
  const [banter, setBanter] = useState('');
  const [engineReady, setEngineReady] = useState(false);
  const threadRef = useRef(null);
  const feedRef = useRef(null);

  const pushFeed = (l) => { setFeed(f => [...f, l]); setTimeout(() => feedRef.current?.scrollToEnd({ animated: true }), 60); };

  useEffect(() => {
    (async () => {
      await loadSession();
      // diagnostic: surface WHY the thread fails instead of silent "offline"
      try {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) { pushFeed({ who: 'sys', text: `(not logged in — banter needs you signed in)` }); setEngineReady(false); return; }
        const id = await openThread(opp.key, `uno with ${opp.name}`);
        threadRef.current = id;
        setEngineReady(!!id);
        if (!id) pushFeed({ who: 'sys', text: `(thread didn't open for ${opp.key} — banter offline)` });
        else pushFeed({ who: 'sys', text: `(${opp.name} is here — talk to them)` });
      } catch (e) {
        pushFeed({ who: 'sys', text: `(banter error: ${String(e).slice(0, 40)})` });
        setEngineReady(false);
      }
    })();
    dealNew();
  }, []);

  const personaReact = useCallback((situation) => {
    if (!threadRef.current) return;
    setBanter('');
    const hidden = `[We are playing UNO together, casually. ${situation} Reply with ONE short spoken line, in your voice, like a real opponent at the table. No narration, no asterisks.]`;
    streamChat({
      threadId: threadRef.current, persona: opp.key, message: hidden,
      onToken: (acc) => setBanter(acc),
      onDone: (final) => { const t = (final || '').trim(); if (t) pushFeed({ who: 'opp', text: `${opp.name}: ${t}` }); setBanter(''); },
      onError: () => setBanter(''),
    });
  }, [opp.key, opp.name]);

  const dealNew = () => {
    const d = makeDeck();
    const y = d.splice(0, 7), o = d.splice(0, 7);
    let first = d.shift();
    while (first.c === 'W' || ['skip', 'rev', 'd2'].includes(first.v)) { d.push(first); first = d.shift(); }
    setYou(y); setOppHand(o); setDiscard(first); setActiveColor(first.c);
    setDeck(d); goTurn('you'); setPhase('play'); setWinner(null); setBanter(''); setCalledUno(false); setFlying(null);
    setFeed([{ who: 'sys', text: `dealt 7 each. match ${COLOR_NAME[first.c]} or ${label(first)}.` }]);
  };

  const drawCards = (who, n, cb) => {
    setDeck((cur) => {
      let d = [...cur]; if (d.length < n) d = d.concat(makeDeck());
      const drawn = d.splice(0, n);
      if (who === 'you') setYou((h) => [...h, ...drawn]); else setOppHand((h) => [...h, ...drawn]);
      cb && cb();
      return d;
    });
  };

  const effectSkips = (card) => card.v === 'skip' || card.v === 'rev' || card.v === 'd2' || card.v === 'wd4';

  const playCard = (idx) => {
    if (turn !== 'you' || phase !== 'play') return;
    const card = you[idx];
    if (!canPlay(card, discard, activeColor)) { pushFeed({ who: 'sys', text: `can't — match ${COLOR_NAME[activeColor]} or ${label(discard)}.` }); return; }
    if (card.c === 'W') { setPendingWild({ idx, card }); setPhase('wild'); return; }
    commitYourCard(idx, card, card.c);
  };

  const commitYourCard = (idx, card, color) => {
    const newHand = you.filter((_, i) => i !== idx);
    setFlying({ card: { ...card, c: card.c === 'W' ? 'W' : color }, from: { x: -SCREEN_W * 0.3, y: SCREEN_W * 0.55, rot: -20 } });
    setYou(newHand); setActiveColor(color);
    setTimeout(() => { setDiscard(card.c === 'W' ? { ...card } : card); setFlying(null); }, 300);
    pushFeed({ who: 'sys', text: `you played ${card.c === 'W' ? label(card) + ' → ' + COLOR_NAME[color] : COLOR_NAME[card.c] + ' ' + label(card)}.` });

    if (newHand.length === 1 && !calledUno) pushFeed({ who: 'sys', text: `you have one card — call UNO!` });
    if (newHand.length === 0) { setTimeout(() => { setWinner('you'); setPhase('over'); personaReact('The user just played their final card and WON. React to losing, in character.'); }, 350); return; }

    if (card.v === 'd2') drawCards('opp', 2);
    if (card.v === 'wd4') drawCards('opp', 4);
    const skip = effectSkips(card);

    if (card.v === 'd2') personaReact('The user just hit you with a Draw Two — you draw 2 and lose your turn.');
    else if (card.v === 'wd4') personaReact(`The user hit you with a Wild Draw Four and picked ${COLOR_NAME[color]} — you draw 4 and lose your turn.`);
    else if (card.v === 'skip') personaReact('The user just skipped your turn.');
    else if (newHand.length === 1) personaReact('The user is down to their last card — about to win. React.');

    setTimeout(() => goTurn(skip ? 'you' : 'opp'), 380);
  };

  const pickWildColor = (col) => {
    const { idx, card } = pendingWild;
    setPendingWild(null); setPhase('play');
    commitYourCard(idx, card, col);
  };

  const drawForYou = () => {
    if (turn !== 'you' || phase !== 'play') return;
    drawCards('you', 1);
    pushFeed({ who: 'sys', text: `you drew.` });
    setTimeout(() => goTurn('opp'), 350);
  };

  const callUno = () => { setCalledUno(true); pushFeed({ who: 'you', text: 'UNO!' }); personaReact('The user just called "UNO!" — they have one card left. React.'); };

  useEffect(() => {
    if (turn !== 'opp' || phase === 'over') return;
    const beat = opp.key === 'the_brainiac' ? 1200 : opp.key === 'the_wannabe' ? 700 : 950;
    const t = setTimeout(() => {
      setOppHand((hand) => {
        const idxs = hand.map((c, i) => canPlay(c, discard, activeColor) ? i : -1).filter(i => i >= 0);
        if (idxs.length === 0) {
          drawCards('opp', 1, () => pushFeed({ who: 'sys', text: `${opp.name} drew.` }));
          setTimeout(() => goTurn('you'), 500);
          return hand;
        }
        const pick = idxs[Math.floor(Math.random() * idxs.length)];
        const card = hand[pick];
        const newHand = hand.filter((_, i) => i !== pick);
        let color = card.c;
        if (card.c === 'W') { const cs2 = ['R', 'G', 'B', 'Y']; color = cs2[Math.floor(Math.random() * 4)]; }
        setFlying({ card: { ...card, c: card.c === 'W' ? 'W' : color }, from: { x: SCREEN_W * 0.3, y: -SCREEN_W * 0.4, rot: 18 } });
        setActiveColor(color);
        setTimeout(() => { setDiscard(card.c === 'W' ? { ...card } : card); setFlying(null); }, 300);
        pushFeed({ who: 'sys', text: `${opp.name} played ${card.c === 'W' ? label(card) + ' → ' + COLOR_NAME[color] : COLOR_NAME[card.c] + ' ' + label(card)}.` });

        if (card.v === 'd2') drawCards('you', 2);
        if (card.v === 'wd4') drawCards('you', 4);
        const skip = effectSkips(card);

        if (card.v === 'd2' || card.v === 'wd4') personaReact(`You just played a ${card.v === 'wd4' ? 'Wild Draw Four' : 'Draw Two'} on the user — they draw cards and lose a turn. Gloat lightly.`);
        else if (newHand.length === 1) personaReact('You are down to your last card — about to win. Say something.');

        setTimeout(() => {
          if (newHand.length === 0) { setWinner('opp'); setPhase('over'); }
          else goTurn(skip ? 'opp' : 'you');
        }, 400);
        return newHand;
      });
    }, beat);
    return () => clearTimeout(t);
  }, [turnNonce, phase]);

  const sendChat = () => {
    const t = draft.trim(); if (!t) return;
    setDraft(''); pushFeed({ who: 'you', text: t });
    if (!threadRef.current) { pushFeed({ who: 'sys', text: `(${opp.name} is offline — no reply)` }); return; }
    setBanter('');
    streamChat({
      threadId: threadRef.current, persona: opp.key,
      message: `[During our UNO game, I say to you:] ${t}`,
      onToken: (acc) => setBanter(acc),
      onDone: (final) => { const r = (final || '').trim(); if (r) pushFeed({ who: 'opp', text: `${opp.name}: ${r}` }); setBanter(''); },
      onError: () => setBanter(''),
    });
  };

  const showColor = discard ? (discard.c === 'W' ? activeColor : discard.c) : 'R';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#181026', '#0E0912', '#080509']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'UNO'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.oppRow}>
          {okFace ? (
            <Image source={{ uri: faceFor(opp.key) }} onError={() => setOkFace(false)} style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: opp.tone }} />
          ) : <View style={[styles.fallback, { borderColor: opp.tone }]}><Text style={{ color: opp.tone, fontFamily: FONTS.display, fontSize: 20 }}>{opp.name[0]}</Text></View>}
          <View>
            <Text style={styles.oppName}>{opp.name}</Text>
            <Text style={styles.count}>{oppHand.length} cards{!engineReady ? ' · connecting…' : ''}</Text>
          </View>
        </View>
        <View style={styles.oppHand}>
          {oppHand.slice(0, 12).map((_, i) => (
            <View key={i} style={{ marginLeft: i === 0 ? 0 : -18, transform: [{ rotate: `${(i - Math.min(oppHand.length, 12) / 2) * 3}deg` }] }}>
              <UnoCard faceDown w={34} h={50} />
            </View>
          ))}
        </View>

        <View style={styles.banterWrap}>
          {banter ? <Text style={styles.banter}>{banter}</Text> :
           turn === 'opp' && engineReady ? <Text style={styles.banterDots}>· · ·</Text> : null}
        </View>

        <View style={styles.table}>
          <Pressable onPress={drawForYou} disabled={turn !== 'you' || phase !== 'play'} style={[styles.drawPile, (turn !== 'you' || phase !== 'play') && { opacity: 0.5 }]}>
            <UnoCard faceDown w={64} h={96} />
            <Text style={styles.pileLabel}>draw</Text>
          </Pressable>
          <View style={styles.discardWrap}>
            {discard && <UnoCard card={{ ...discard, c: discard.c === 'W' ? 'W' : showColor }} w={70} h={104} />}
            {flying && <FlyingCard card={flying.card} from={flying.from} />}
            <View style={[styles.colorChip, { backgroundColor: COLORS[showColor] }]} />
          </View>
        </View>

        {winner ? (
          <View style={styles.overWrap}>
            <Text style={styles.overText}>{winner === 'you' ? 'you win!' : `${opp.name} wins`}</Text>
            <Pressable style={styles.againBtn} onPress={dealNew}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.againInner}><Text style={styles.againText}>deal again</Text></LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.turnBar}>
            <Text style={styles.turnLabel}>{turn === 'you' ? 'your turn' : `${opp.name}'s turn`}</Text>
            {turn === 'you' && you.length === 1 && !calledUno && phase === 'play' && (
              <Pressable style={styles.unoBtn} onPress={callUno}>
                <LinearGradient colors={['#FF8A52', '#B5572E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.unoInner}><Text style={styles.unoText}>UNO!</Text></LinearGradient>
              </Pressable>
            )}
          </View>
        )}

        {phase === 'wild' ? (
          <View style={styles.wildPick}>
            <Text style={styles.wildPrompt}>choose a color</Text>
            <View style={styles.wildRow}>
              {['R', 'G', 'B', 'Y'].map((col) => (
                <Pressable key={col} onPress={() => pickWildColor(col)} style={[styles.wildSwatch, { backgroundColor: COLORS[col] }]}>
                  <Text style={styles.wildSwatchLabel}>{COLOR_NAME[col]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yourHand}>
            {you.map((card, i) => {
              const playable = turn === 'you' && phase === 'play' && canPlay(card, discard, activeColor);
              return <View key={i} style={{ marginLeft: i === 0 ? 0 : -8 }}><UnoCard card={card} onPress={() => playCard(i)} playable={playable} dim={turn === 'you' && phase === 'play' && !playable} w={62} h={92} /></View>;
            })}
          </ScrollView>
        )}

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
  card: { borderRadius: 11, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6, borderWidth: 2.5, borderColor: '#fff' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playable: { borderColor: '#FFE9C7', shadowColor: '#F3A85F', shadowOpacity: 0.8, shadowRadius: 10, elevation: 12, transform: [{ translateY: -8 }] },
  oval: { position: 'absolute', borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.92)', transform: [{ rotate: '32deg' }] },
  corner: { position: 'absolute', fontFamily: FONTS.semibold, color: '#fff', fontWeight: '800' },
  cornerTL: { top: 4, left: 6 },
  cornerBR: { bottom: 4, right: 6, transform: [{ rotate: '180deg' }] },
  center: { alignItems: 'center', justifyContent: 'center' },
  centerLabel: { fontFamily: FONTS.display, fontWeight: '800' },
  subLabel: { fontFamily: FONTS.semibold, fontSize: 9, letterSpacing: 1, marginTop: -2 },
  backOval: { width: '78%', height: '52%', borderRadius: 100, backgroundColor: 'rgba(243,168,95,0.14)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '30deg' }] },
  backZ: { fontFamily: FONTS.display, color: '#F3A85F', transform: [{ rotate: '-30deg' }] },
  wildCorners: { position: 'absolute', width: '46%', height: '46%', borderRadius: 100, overflow: 'hidden', opacity: 0.9 },
  wq: { position: 'absolute', width: '50%', height: '50%' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },
  oppRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 4 },
  fallback: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  oppName: { fontFamily: FONTS.display, color: C.cream, fontSize: 17 },
  count: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  oppHand: { flexDirection: 'row', justifyContent: 'center', marginTop: 6, height: 52 },
  banterWrap: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 24, marginTop: 4 },
  banter: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  banterDots: { color: C.accentSoft, fontSize: 20, textAlign: 'center', letterSpacing: 4 },
  table: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 44, marginTop: 8 },
  drawPile: { alignItems: 'center', gap: 5 },
  pileLabel: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  discardWrap: { alignItems: 'center', justifyContent: 'center' },
  colorChip: { width: 16, height: 16, borderRadius: 8, marginTop: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  overWrap: { alignItems: 'center', marginTop: 12, gap: 10 },
  overText: { fontFamily: FONTS.display, color: C.ember, fontSize: 28 },
  againBtn: { borderRadius: 15, overflow: 'hidden', width: 170 },
  againInner: { paddingVertical: 13, alignItems: 'center' },
  againText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 15 },
  turnBar: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: 12, minHeight: 44 },
  turnLabel: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 16 },
  unoBtn: { borderRadius: 22, overflow: 'hidden' },
  unoInner: { paddingHorizontal: 26, paddingVertical: 10 },
  unoText: { fontFamily: FONTS.display, color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1 },
  yourHand: { paddingHorizontal: 20, paddingVertical: 14, alignItems: 'flex-end' },
  wildPick: { alignItems: 'center', paddingVertical: 16, gap: 10 },
  wildPrompt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 17 },
  wildRow: { flexDirection: 'row', gap: 12 },
  wildSwatch: { width: 62, height: 62, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  wildSwatchLabel: { fontFamily: FONTS.semibold, color: '#fff', fontSize: 11 },
  feed: { maxHeight: 70, marginTop: 4, marginHorizontal: 18 },
  feedLine: { fontFamily: FONTS.body, fontSize: 13, lineHeight: 18, marginVertical: 1 },
  feedYou: { color: C.cream, textAlign: 'right' },
  feedOpp: { fontFamily: FONTS.displayItalic, color: C.accentSoft },
  feedSys: { color: C.faint, textAlign: 'center', fontSize: 11.5, fontStyle: 'italic' },
  chatInput: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)', marginHorizontal: 16, marginVertical: 8 },
});
