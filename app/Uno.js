// ════════════════════════════════════════════════════════════════════════
//  yourZ — UNO, done right.
//  • Up to 4 players (you + up to 3 AI personas) — real N-player turn engine
//  • Reverse actually reverses direction; skip / +2 / +4 cascade correctly
//  • Full-screen table: opponents around the top & sides, your big hand at bottom
//  • Card-throw animation + card sounds (deal / play / draw / uno)
//  • A clean slide-up chat panel (no clumsy middle-of-screen move log)
//  • Banter routes to the persona engine.
//  Deterministic code owns the RULES; personas own the VOICE.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';
import { banter } from './api';

let createAudioPlayer = null;
try { ({ createAudioPlayer } = require('expo-audio')); } catch (_) {}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

const COLORS = { R: '#E5484D', G: '#46A758', B: '#3E8FD9', Y: '#E0B23A' };
const COLOR_HI = { R: '#FF6B6E', G: '#63C776', B: '#5BA7F0', Y: '#F5CB5C' };
const COLOR_NAME = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };

// ── sounds (expo-audio; guarded so web/preview never crashes) ──
const SFX = {};
const TONE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=';
function initSfx() {
  if (!createAudioPlayer) return;
  const mk = () => { try { return createAudioPlayer({ uri: TONE }); } catch (_) { return null; } };
  SFX.deal = mk(); SFX.play = mk(); SFX.draw = mk(); SFX.uno = mk();
}
function playSfx(name) { const p = SFX[name]; if (!p) return; try { p.seekTo(0); p.play(); } catch (_) {} }

// ── deck / rules ──
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
const sublabel = (card) => (card.v === 'wild' || card.v === 'wd4') ? 'WILD' : card.v === 'skip' ? 'SKIP' : card.v === 'rev' ? 'REV' : card.v === 'd2' ? 'DRAW' : '';
function canPlay(card, top, activeColor) {
  if (!top) return true;
  if (card.c === 'W') return true;
  if (card.c === activeColor) return true;
  if (card.v === top.v) return true;
  return false;
}

function UnoCard({ card, faceDown, onPress, playable, w = 66, h = 98, dim, style }) {
  if (faceDown) {
    return (
      <View style={[cs.card, { width: w, height: h }, style]}>
        <LinearGradient colors={['#2a1f3a', '#171122']} style={cs.fill}>
          <View style={cs.backOval}><Text style={[cs.backZ, { fontSize: h * 0.3 }]}>Z</Text></View>
        </LinearGradient>
      </View>
    );
  }
  const base = card.c === 'W' ? '#241a30' : COLORS[card.c];
  const hi = card.c === 'W' ? '#3a2b4a' : COLOR_HI[card.c];
  const inner = (
    <LinearGradient colors={[hi, base]} start={{ x: 0.2, y: 0 }} end={{ x: 0.9, y: 1 }} style={cs.fill}>
      <View style={[cs.oval, { width: w * 0.82, height: h * 0.62 }]} />
      <Text style={[cs.corner, cs.cornerTL, { fontSize: h * 0.15 }]}>{label(card)}</Text>
      <Text style={[cs.corner, cs.cornerBR, { fontSize: h * 0.15 }]}>{label(card)}</Text>
      <View style={cs.center}>
        <Text style={[cs.centerLabel, { fontSize: h * 0.32, color: card.c === 'W' ? '#fff' : base }]}>{label(card)}</Text>
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
  );
  if (!onPress) return <View style={[cs.card, { width: w, height: h }, playable && cs.playable, dim && { opacity: 0.5 }, style]}>{inner}</View>;
  return <Pressable onPress={onPress} style={[cs.card, { width: w, height: h }, playable && cs.playable, dim && { opacity: 0.5 }, style]}>{inner}</Pressable>;
}

function FlyingCard({ card, from }) {
  const tx = useSharedValue(from.x); const ty = useSharedValue(from.y);
  const rot = useSharedValue(from.rot || 0); const sc = useSharedValue(0.7);
  useEffect(() => {
    tx.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    ty.value = withTiming(0, { duration: 340, easing: Easing.out(Easing.cubic) });
    rot.value = withTiming((Math.random() - 0.5) * 20, { duration: 340 });
    sc.value = withSpring(1, { damping: 11 });
  }, []);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${rot.value}deg` }, { scale: sc.value }] }));
  return <Animated.View style={[{ position: 'absolute' }, st]}><UnoCard card={card} w={74} h={110} /></Animated.View>;
}

function OpponentSeat({ player, active, position }) {
  const [okFace, setOkFace] = useState(true);
  const n = Math.min(player.hand.length, 8);
  return (
    <View style={styles.seat}>
      <View style={[styles.seatAvatarWrap, active && styles.seatActive]}>
        {okFace ? (
          <Image source={{ uri: faceFor(player.key) }} onError={() => setOkFace(false)}
            style={[styles.seatAvatar, active && { borderColor: player.tone }]} />
        ) : (
          <View style={[styles.seatAvatar, styles.seatFallback, active && { borderColor: player.tone }]}>
            <Text style={{ color: player.tone, fontFamily: FONTS.display, fontSize: 18 }}>{player.name[0]}</Text>
          </View>
        )}
        <View style={styles.seatCount}><Text style={styles.seatCountText}>{player.hand.length}</Text></View>
      </View>
      <Text style={styles.seatName} numberOfLines={1}>{player.name}</Text>
      <View style={styles.seatFan}>
        {Array.from({ length: n }, (_, i) => (
          <View key={i} style={{ marginLeft: i === 0 ? 0 : -14, transform: [{ rotate: `${(i - n / 2) * 4}deg` }] }}>
            <UnoCard faceDown w={22} h={32} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Uno({ game, opponent, roster, onExit = () => {} }) {
  const aiList = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3)
    .map((o) => ({ id: o.key, key: o.key, name: o.name || o.key, tone: o.tone || C.ember, ai: true, hand: [] }));
  const initialPlayers = [{ id: 'you', key: 'you', name: 'you', tone: C.cream, ai: false, hand: [] }, ...aiList];

  const [players, setPlayers] = useState(initialPlayers);
  const [deck, setDeck] = useState([]);
  const [discard, setDiscard] = useState(null);
  const [activeColor, setActiveColor] = useState('R');
  const [turnIdx, setTurnIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [turnNonce, setTurnNonce] = useState(0);
  const [phase, setPhase] = useState('play');
  const [pendingWild, setPendingWild] = useState(null);
  const [winner, setWinner] = useState(null);
  const [flying, setFlying] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [banterLine, setBanterLine] = useState(null);

  const seatOf = (idx) => ['bottom', 'top', 'left', 'right'][idx] || 'top';
  const pushChat = (m) => setChat((c) => [...c.slice(-40), m]);
  const goTurn = (idx) => { setTurnIdx(idx); setTurnNonce((n) => n + 1); };
  const nextIdx = (from, step, d) => { const N = players.length; return ((from + (d ?? dir) * (step ?? 1)) % N + N) % N; };

  useEffect(() => { initSfx(); dealNew(); }, []);

  const react = useCallback(async (persona, name, situation) => {
    const SPIRIT = `You are playing UNO against the others, as YOURSELF. Be sporting but competitive; provoke to break their focus; gloat when ahead; own it with wit when behind. One short spoken line, in your voice, no narration.`;
    const { line } = await banter(persona, `${SPIRIT}\n\nWhat just happened: ${situation}\nYour line:`);
    if (line) { setBanterLine({ name, text: line }); pushChat({ who: 'opp', name, text: line }); setTimeout(() => setBanterLine(null), 3800); }
  }, []);

  const dealNew = () => {
    const d = makeDeck();
    const ps = initialPlayers.map((p) => ({ ...p, hand: d.splice(0, 7) }));
    let first = d.shift();
    while (first.c === 'W' || ['skip', 'rev', 'd2'].includes(first.v)) { d.push(first); first = d.shift(); }
    setPlayers(ps); setDeck(d); setDiscard(first); setActiveColor(first.c);
    setTurnIdx(0); setDir(1); setPhase('play'); setWinner(null); setFlying(null); setPendingWild(null);
    setChat([{ who: 'sys', text: `game on — ${ps.length} players. match ${COLOR_NAME[first.c]} or ${label(first)}.` }]);
    playSfx('deal');
  };

  const drawInto = (pid, n) => {
    setDeck((cur) => {
      let d = [...cur]; if (d.length < n) d = d.concat(makeDeck());
      const drawn = d.splice(0, n);
      setPlayers((ps) => ps.map((p) => p.id === pid ? { ...p, hand: [...p.hand, ...drawn] } : p));
      return d;
    });
    playSfx('draw');
  };

  const applyAndAdvance = (card, byIdx, color) => {
    let d = dir;
    if (card.v === 'rev') { d = -d; setDir(d); }
    const N = players.length;
    const victim = ((byIdx + d) % N + N) % N;
    if (card.v === 'd2') drawInto(players[victim].id, 2);
    if (card.v === 'wd4') drawInto(players[victim].id, 4);
    const twoP = players.length === 2;
    let step = 1;
    if (card.v === 'skip') step = 2;
    else if (card.v === 'd2' || card.v === 'wd4') step = 2;
    else if (card.v === 'rev' && twoP) step = 2;
    return ((byIdx + d * step) % N + N) % N;
  };

  const seatXY = (idx) => {
    const s = seatOf(idx);
    if (s === 'bottom') return { x: -SCREEN_W * 0.25, y: SCREEN_H * 0.32, rot: -18 };
    if (s === 'top') return { x: 0, y: -SCREEN_H * 0.3, rot: 16 };
    if (s === 'left') return { x: -SCREEN_W * 0.4, y: 0, rot: -24 };
    return { x: SCREEN_W * 0.4, y: 0, rot: 24 };
  };

  const commitCard = (byIdx, card, color) => {
    const shown = { ...card, c: card.c === 'W' ? 'W' : color };
    setFlying({ card: shown, from: seatXY(byIdx) });
    setActiveColor(color);
    playSfx('play');
    setTimeout(() => { setDiscard(card); setFlying(null); }, 320);
    setPlayers((ps) => ps.map((p, i) => i === byIdx ? { ...p, hand: p.hand.filter((c) => c !== card) } : p));
  };

  const playCard = (handIdx) => {
    if (turnIdx !== 0 || phase !== 'play') return;
    const card = players[0].hand[handIdx];
    if (!canPlay(card, discard, activeColor)) return;
    if (card.c === 'W') { setPendingWild({ card }); setPhase('wild'); return; }
    finishPlay(0, card, card.c);
  };
  const pickWild = (col) => { const { card } = pendingWild; setPendingWild(null); setPhase('play'); finishPlay(0, card, col); };

  const finishPlay = (byIdx, card, color) => {
    const player = players[byIdx];
    const remaining = player.hand.length - 1;
    commitCard(byIdx, card, color);
    if (remaining === 1) { playSfx('uno'); pushChat({ who: 'sys', text: `${player.name} — UNO!` }); }
    if (remaining === 0) {
      setTimeout(() => { setWinner(player); setPhase('over'); }, 340);
      const anAi = players.find((p) => p.ai);
      if (anAi && byIdx === 0) react(anAi.key, anAi.name, `${player.name} just played their last card and won the game.`);
      return;
    }
    const nxt = applyAndAdvance(card, byIdx, color);
    if (byIdx === 0 && (card.v === 'd2' || card.v === 'wd4' || card.v === 'skip')) {
      const victim = players[nextIdx(byIdx, 1)];
      if (victim?.ai) react(victim.key, victim.name, `The user just played a ${label(card)} on you — ${card.v === 'skip' ? 'skipping your turn' : 'you draw cards and lose your turn'}.`);
    }
    setTimeout(() => goTurn(nxt), 360);
  };

  const drawForYou = () => {
    if (turnIdx !== 0 || phase !== 'play') return;
    drawInto('you', 1);
    setTimeout(() => goTurn(nextIdx(0, 1)), 320);
  };

  useEffect(() => {
    if (phase === 'over') return;
    const p = players[turnIdx];
    if (!p || !p.ai) return;
    const beat = p.key === 'the_brainiac' ? 1200 : p.key === 'the_wannabe' ? 650 : 950;
    const t = setTimeout(() => {
      const legal = p.hand.map((c, i) => canPlay(c, discard, activeColor) ? i : -1).filter((i) => i >= 0);
      if (!legal.length) {
        drawInto(p.id, 1);
        pushChat({ who: 'sys', text: `${p.name} drew.` });
        setTimeout(() => goTurn(nextIdx(turnIdx, 1)), 420);
        return;
      }
      const pick = legal[Math.floor(Math.random() * legal.length)];
      const card = p.hand[pick];
      let color = card.c;
      if (card.c === 'W') { const cs2 = ['R', 'G', 'B', 'Y']; color = cs2[Math.floor(Math.random() * 4)]; }
      const remaining = p.hand.length - 1;
      commitCard(turnIdx, card, color);
      if (remaining === 1) { playSfx('uno'); pushChat({ who: 'sys', text: `${p.name} — UNO!` }); react(p.key, p.name, `You're down to your last card, about to win.`); }
      if (remaining === 0) { setTimeout(() => { setWinner(p); setPhase('over'); }, 340); return; }
      const nxt = applyAndAdvance(card, turnIdx, color);
      if (nextIdx(turnIdx, 1) === 0 && (card.v === 'd2' || card.v === 'wd4')) {
        react(p.key, p.name, `You just played a ${label(card)} on the user — they draw and lose a turn. Gloat lightly.`);
      }
      setTimeout(() => goTurn(nxt), 380);
    }, beat);
    return () => clearTimeout(t);
  }, [turnNonce, phase]);

  const sendChat = async () => {
    const t = draft.trim(); if (!t) return;
    setDraft(''); pushChat({ who: 'you', name: 'you', text: t });
    const target = players.find((p) => p.ai);
    if (!target) return;
    const { line } = await banter(target.key, `[During our UNO game, the user says to you:] ${t}\nReply in one short line, in character.`);
    if (line) { pushChat({ who: 'opp', name: target.name, text: line }); setBanterLine({ name: target.name, text: line }); setTimeout(() => setBanterLine(null), 3800); }
  };

  const me = players[0];
  const showColor = discard ? (discard.c === 'W' ? activeColor : discard.c) : 'R';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1228', '#0E0912', '#070409']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <View style={styles.felt} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'UNO'}</Text>
          <Pressable hitSlop={12} onPress={() => setChatOpen((o) => !o)}><Text style={styles.chatIcon}>{chatOpen ? '×' : '⌯'}</Text></Pressable>
        </View>

        <View style={styles.opponents}>
          {players.map((p, i) => p.ai ? <OpponentSeat key={p.id} player={p} active={turnIdx === i} position={seatOf(i)} /> : null)}
        </View>

        {banterLine && (
          <View style={styles.bubble}>
            <Text style={styles.bubbleName}>{banterLine.name}</Text>
            <Text style={styles.bubbleText}>{banterLine.text}</Text>
          </View>
        )}

        <View style={styles.table}>
          <Pressable onPress={drawForYou} disabled={turnIdx !== 0 || phase !== 'play'}
            style={[styles.drawPile, (turnIdx !== 0 || phase !== 'play') && { opacity: 0.5 }]}>
            <UnoCard faceDown w={72} h={108} />
            <Text style={styles.pileLabel}>draw</Text>
          </Pressable>
          <View style={styles.discardWrap}>
            {discard && <UnoCard card={{ ...discard, c: discard.c === 'W' ? 'W' : showColor }} w={80} h={120} />}
            {flying && <FlyingCard card={flying.card} from={flying.from} />}
            <View style={[styles.colorChip, { backgroundColor: COLORS[showColor] }]} />
          </View>
        </View>

        {winner ? (
          <View style={styles.overWrap}>
            <Text style={styles.overText}>{winner.id === 'you' ? 'you win!' : `${winner.name} wins`}</Text>
            <Pressable style={styles.againBtn} onPress={dealNew}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.againInner}><Text style={styles.againText}>deal again</Text></LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.turnLabel}>{turnIdx === 0 ? 'your turn' : `${players[turnIdx]?.name}'s turn`}</Text>
        )}

        {phase === 'wild' && (
          <View style={styles.wildPick}>
            <Text style={styles.wildPrompt}>choose a color</Text>
            <View style={styles.wildRow}>
              {['R', 'G', 'B', 'Y'].map((col) => (
                <Pressable key={col} onPress={() => pickWild(col)} style={[styles.wildSwatch, { backgroundColor: COLORS[col] }]}>
                  <Text style={styles.wildSwatchLabel}>{COLOR_NAME[col]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {phase !== 'wild' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yourHand}>
            {me.hand.map((card, i) => {
              const playable = turnIdx === 0 && phase === 'play' && canPlay(card, discard, activeColor);
              return (
                <View key={i} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                  <UnoCard card={card} onPress={() => playCard(i)} playable={playable}
                    dim={turnIdx === 0 && phase === 'play' && !playable} w={70} h={104} />
                </View>
              );
            })}
          </ScrollView>
        )}

        {chatOpen && (
          <View style={styles.chatPanel}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }} showsVerticalScrollIndicator={false}>
              {chat.map((m, i) => (
                <View key={i} style={[styles.chatRow, m.who === 'you' && { alignItems: 'flex-end' }]}>
                  {m.who === 'sys'
                    ? <Text style={styles.chatSys}>{m.text}</Text>
                    : <View style={[styles.chatBubble, m.who === 'you' ? styles.chatMine : styles.chatTheirs]}>
                        {m.who === 'opp' && <Text style={styles.chatWho}>{m.name}</Text>}
                        <Text style={styles.chatText}>{m.text}</Text>
                      </View>}
                </View>
              ))}
            </ScrollView>
            <View style={styles.chatInputRow}>
              <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={sendChat}
                placeholder="say something…" placeholderTextColor={C.faint} style={styles.chatInput} returnKeyType="send" />
              <Pressable onPress={sendChat} style={styles.sendBtn}><Text style={styles.sendText}>↑</Text></Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const cs = StyleSheet.create({
  card: { borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 7, borderWidth: 2.5, borderColor: '#fff' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playable: { borderColor: '#FFE9C7', shadowColor: '#F3A85F', shadowOpacity: 0.85, shadowRadius: 12, elevation: 14, transform: [{ translateY: -10 }] },
  oval: { position: 'absolute', borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.92)', transform: [{ rotate: '32deg' }] },
  corner: { position: 'absolute', fontFamily: FONTS.semibold, color: '#fff', fontWeight: '800' },
  cornerTL: { top: 5, left: 7 }, cornerBR: { bottom: 5, right: 7, transform: [{ rotate: '180deg' }] },
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
  felt: { position: 'absolute', top: '30%', left: '10%', right: '10%', height: '40%', borderRadius: 400, backgroundColor: 'rgba(70,167,88,0.06)' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 8 },
  chev: { color: C.muted, fontSize: 32, width: 28, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 22 },
  chatIcon: { fontSize: 24, width: 28, textAlign: 'right', color: C.cream },
  opponents: { minHeight: 96, paddingHorizontal: 8, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-start', marginTop: 4 },
  seat: { alignItems: 'center', maxWidth: 110 },
  seatAvatarWrap: { alignItems: 'center', justifyContent: 'center' },
  seatActive: { shadowColor: '#F3A85F', shadowOpacity: 0.9, shadowRadius: 14, elevation: 10 },
  seatAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  seatFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  seatCount: { position: 'absolute', bottom: -2, right: -2, backgroundColor: C.emberDeep, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: C.void },
  seatCountText: { color: '#fff', fontFamily: FONTS.semibold, fontSize: 11 },
  seatName: { fontFamily: FONTS.body, color: C.cream, fontSize: 12, marginTop: 4 },
  seatFan: { flexDirection: 'row', marginTop: 4, height: 34 },
  bubble: { position: 'absolute', top: 150, alignSelf: 'center', maxWidth: SCREEN_W * 0.8, backgroundColor: 'rgba(30,22,42,0.96)', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(243,168,95,0.3)', paddingHorizontal: 16, paddingVertical: 10, zIndex: 20 },
  bubbleName: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 12, marginBottom: 2 },
  bubbleText: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 15, lineHeight: 20 },
  table: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
  drawPile: { alignItems: 'center', gap: 6 },
  pileLabel: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  discardWrap: { alignItems: 'center', justifyContent: 'center' },
  colorChip: { width: 18, height: 18, borderRadius: 9, marginTop: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },
  turnLabel: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 17, textAlign: 'center', marginVertical: 8 },
  overWrap: { alignItems: 'center', marginVertical: 10, gap: 10 },
  overText: { fontFamily: FONTS.display, color: C.ember, fontSize: 30 },
  againBtn: { borderRadius: 16, overflow: 'hidden', width: 180 },
  againInner: { paddingVertical: 14, alignItems: 'center' },
  againText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 16 },
  wildPick: { alignItems: 'center', paddingVertical: 14, gap: 10 },
  wildPrompt: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 17 },
  wildRow: { flexDirection: 'row', gap: 12 },
  wildSwatch: { width: 64, height: 64, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  wildSwatchLabel: { fontFamily: FONTS.semibold, color: '#fff', fontSize: 11 },
  yourHand: { paddingHorizontal: 20, paddingVertical: 16, alignItems: 'flex-end', minHeight: 130 },
  chatPanel: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.5, backgroundColor: 'rgba(14,9,18,0.98)', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(243,168,95,0.2)', zIndex: 30 },
  chatRow: { marginVertical: 3 },
  chatSys: { fontFamily: FONTS.body, color: C.faint, fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginVertical: 2 },
  chatBubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 8 },
  chatMine: { backgroundColor: C.emberDeep, borderBottomRightRadius: 4 },
  chatTheirs: { backgroundColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4 },
  chatWho: { fontFamily: FONTS.semibold, color: C.accentSoft, fontSize: 11, marginBottom: 2 },
  chatText: { fontFamily: FONTS.body, color: C.cream, fontSize: 14, lineHeight: 19 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  chatInput: { flex: 1, fontFamily: FONTS.body, color: C.cream, fontSize: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ember, alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#3A1505', fontSize: 20, fontWeight: '800' },
});
