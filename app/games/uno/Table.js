// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE UNO TABLE, rebuilt on the proven engine. The felt is the
//  original's (throws, seats, chat composer, wild picker — the good parts);
//  the game underneath is now rules.js: closed card economy, draw-then-may-
//  play, real action cascades — 800 sims green. AI has taste (ai.js), the
//  drive loop has beats, haptics speak the shared vocabulary.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { banter } from '../../api';
import { buzz } from '../common';
import {
  UnoCard, FlyingCard, OpponentSeat, COLORS as CARD_COLORS, COLOR_NAME, label, initSfx, playSfx,
} from './visuals';
import { newGame, legalIdxs, playCard, drawCard, playDrawn, keepDrawn, canPlay } from './rules.js';
import { chooseCard, wildColorFor, banterMoment } from './ai.js';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const seatOf = (idx, n) => idx === 0 ? 'bottom' : n === 2 ? 'top' : idx === 1 ? 'left' : idx === 2 ? 'top' : 'right';

export default function UnoTable({ game: gameMeta, opponent, roster, onExit = () => {} }) {
  const ais = (Array.isArray(roster) && roster.length ? roster : (opponent ? [opponent] : []))
    .filter(Boolean).slice(0, 3);
  const cast = ais.length ? ais : [{ key: 'the_brother', name: 'the brother' }];
  const ids = ['you', ...cast.map((a) => a.key)];

  const [st, setSt] = useState(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; });
  const [flying, setFlying] = useState(null);
  const [pendingWild, setPendingWild] = useState(null);   // { handIdx } or { drawn: true }
  const [drawnOffer, setDrawnOffer] = useState(false);
  const [chat, setChat] = useState([{ who: 'sys', text: 'game on.' }]);
  const [chatOpen, setChatOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [bLine, setBLine] = useState(null);
  const stRef = useRef(st); useEffect(() => { stRef.current = st; }, [st]);
  const busyRef = useRef(false);
  const banterAt = useRef(0);
  const nameOf = (seat) => (seat === 0 ? 'the player' : (cast[seat - 1]?.name || '…'));

  useEffect(() => { initSfx(); }, []);
  const pushChat = (m) => setChat((c) => [...c.slice(-40), m]);

  const say = useCallback(async (seat, prompt) => {
    const now = Date.now(); if (now - banterAt.current < 6000) return;
    banterAt.current = now;
    const key = seat > 0 ? ids[seat] : cast[0]?.key;
    if (!key || key === 'you') return;
    const nm = seat > 0 ? cast[seat - 1].name : cast[0].name;
    const { line } = await banter(key, `You are playing UNO at the table, as yourself. ONE short spoken line, no narration. ${prompt}`);
    if (line) { setBLine({ name: nm, text: line }); pushChat({ who: 'opp', name: nm, text: line }); setTimeout(() => setBLine(null), 3800); }
  }, [ids]);

  const seatXY = (idx) => {
    const s = seatOf(idx, ids.length);
    if (s === 'bottom') return { x: -SCREEN_W * 0.25, y: SCREEN_H * 0.32, rot: -18 };
    if (s === 'top') return { x: 0, y: -SCREEN_H * 0.3, rot: 16 };
    if (s === 'left') return { x: -SCREEN_W * 0.4, y: 0, rot: -24 };
    return { x: SCREEN_W * 0.4, y: 0, rot: 24 };
  };

  const applyOut = useCallback((out, byIdx, playedCard) => {
    if (playedCard) {
      setFlying({ card: { ...playedCard, c: playedCard.c === 'W' ? 'W' : out.state.activeColor }, from: seatXY(byIdx) });
      playSfx('play'); buzz('tap');
      setTimeout(() => setFlying(null), 330);
    }
    for (const e of out.events) {
      if (e.type === 'uno') { playSfx('uno'); pushChat({ who: 'sys', text: `${nameOf(e.seat)} — UNO!` }); }
      if (e.type === 'draw' && e.n >= 2) buzz(e.seat === 0 ? 'thud' : 'knock');
      if (e.type === 'win') { buzz(e.seat === 0 ? 'win' : 'lose'); }
    }
    const bm = banterMoment(out.events, nameOf);
    if (bm && !bm.minor) {
      const winE = out.events.find((e) => e.type === 'win');
      say(winE ? (winE.seat === 0 ? 1 : winE.seat) : byIdx, bm.line);
    }
    setSt(out.state);
  }, [say]);

  // ── AI drive loop ──
  useEffect(() => {
    const g = st;
    if (g.winner || busyRef.current) return;
    if (g.turn === 0) {
      if (g.phase === 'drawn') setDrawnOffer(true);
      return;
    }
    busyRef.current = true;
    const t = setTimeout(() => {
      busyRef.current = false;
      const cur = stRef.current;
      if (cur.winner || cur.turn === 0) return;
      const seat = cur.turn;
      const styleKey = ids[seat];
      if (cur.phase === 'drawn') {
        const card = cur.hands[seat][cur.drawnIdx];
        const out = playDrawn(cur, seat, card.c === 'W' ? wildColorFor(cur.hands[seat], styleKey) : undefined);
        applyOut(out, seat, card);
        return;
      }
      const pick = chooseCard(cur, seat, styleKey);
      if (pick == null) {
        const out = drawCard(cur, seat);
        playSfx('draw');
        pushChat({ who: 'sys', text: `${nameOf(seat)} drew.` });
        setSt(out.state);                       // if drawnPlayable, loop re-fires in 'drawn'
        return;
      }
      const card = cur.hands[seat][pick];
      const out = playCard(cur, seat, pick, card.c === 'W' ? wildColorFor(cur.hands[seat], styleKey) : undefined);
      applyOut(out, seat, card);
      if (out.state.turn === 0 && (card.v === 'd2' || card.v === 'wd4')) {
        say(seat, `You just hit the player with a ${label(card)} — they draw and lose the turn. Gloat lightly.`);
      }
    }, ids[g.turn] === 'the_brainiac' ? 1250 : ids[g.turn] === 'the_wannabe' ? 700 : 1000);
    return () => { clearTimeout(t); busyRef.current = false; };
  }, [st, applyOut, ids, say]);

  // ── your actions ──
  const youPlay = (handIdx) => {
    const g = stRef.current;
    if (g.turn !== 0 || g.phase !== 'play' || g.winner) return;
    const card = g.hands[0][handIdx];
    if (!canPlay(card, g.discard[g.discard.length - 1], g.activeColor)) return;
    if (card.c === 'W') { buzz('tick'); setPendingWild({ handIdx }); return; }
    applyOut(playCard(g, 0, handIdx), 0, card);
  };
  const youDraw = () => {
    const g = stRef.current;
    if (g.turn !== 0 || g.phase !== 'play' || g.winner) return;
    if (legalIdxs(g, 0).length) return;               // engine law: draw only when stuck
    playSfx('draw'); buzz('tap');
    const out = drawCard(g, 0);
    setSt(out.state);
    if (out.drawnPlayable) setDrawnOffer(true);
  };
  const youPlayDrawn = () => {
    const g = stRef.current;
    if (g.phase !== 'drawn' || g.turn !== 0) return;
    const card = g.hands[0][g.drawnIdx];
    setDrawnOffer(false);
    if (card.c === 'W') { setPendingWild({ drawn: true }); return; }
    applyOut(playDrawn(g, 0), 0, card);
  };
  const youKeepDrawn = () => {
    const g = stRef.current;
    if (g.phase !== 'drawn' || g.turn !== 0) return;
    setDrawnOffer(false); buzz('tick');
    setSt(keepDrawn(g, 0).state);
  };
  const pickWild = (col) => {
    const g = stRef.current;
    const pw = pendingWild; setPendingWild(null);
    if (!pw) return;
    buzz('tick');
    if (pw.drawn) { const card = g.hands[0][g.drawnIdx]; applyOut(playDrawn(g, 0, col), 0, card); }
    else { const card = g.hands[0][pw.handIdx]; applyOut(playCard(g, 0, pw.handIdx, col), 0, card); }
  };

  const sendChat = async () => {
    const t = draft.trim(); if (!t) return;
    setDraft(''); pushChat({ who: 'you', name: 'you', text: t });
    const target = cast[0];
    const { line } = await banter(target.key, `[During our UNO game, the user says to you:] ${t}\nReply in one short line, in character.`);
    if (line) { pushChat({ who: 'opp', name: target.name, text: line }); setBLine({ name: target.name, text: line }); setTimeout(() => setBLine(null), 3800); }
  };

  const topCard = st.discard[st.discard.length - 1];
  const showColor = topCard.c === 'W' ? st.activeColor : topCard.c;
  const yourLegal = st.turn === 0 && st.phase === 'play' ? new Set(legalIdxs(st, 0)) : new Set();
  const TONES = ['#F3A85F', '#6FC9E0', '#F0708C', '#8FD98F'];
  const players = ids.map((id, i) => ({ id, ai: i > 0, key: id, name: i === 0 ? 'you' : cast[i - 1].name, hand: st.hands[i], tone: TONES[i] }));

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1a1228', '#0E0912', '#070409']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{gameMeta?.name || 'UNO'}</Text>
          <Pressable hitSlop={12} onPress={() => setChatOpen((o) => !o)}><Text style={styles.chatIcon}>{chatOpen ? '×' : '⌯'}</Text></Pressable>
        </View>

        <View style={styles.opponents}>
          {players.map((p, i) => p.ai ? <OpponentSeat key={p.id} player={p} active={st.turn === i && !st.winner} position={seatOf(i, ids.length)} /> : null)}
        </View>

        {bLine && (
          <View style={styles.bubble}>
            <Text style={styles.bubbleName}>{bLine.name}</Text>
            <Text style={styles.bubbleText}>{bLine.text}</Text>
          </View>
        )}

        <View style={styles.table}>
          <Pressable onPress={youDraw}
            disabled={st.turn !== 0 || st.phase !== 'play' || yourLegal.size > 0}
            style={[styles.drawPile, (st.turn !== 0 || st.phase !== 'play' || yourLegal.size > 0) && { opacity: 0.5 }]}>
            <UnoCard faceDown w={72} h={108} />
            <Text style={styles.pileLabel}>draw · {st.deck.length}</Text>
          </Pressable>
          <View style={styles.discardWrap}>
            <UnoCard card={{ ...topCard, c: topCard.c === 'W' ? 'W' : showColor }} w={80} h={120} />
            {flying && <FlyingCard card={flying.card} from={flying.from} />}
            <View style={[styles.colorChip, { backgroundColor: CARD_COLORS[showColor] }]} />
          </View>
        </View>

        {st.winner ? (
          <View style={styles.overWrap}>
            <Text style={styles.overText}>{st.winner === 'you' ? 'you win!' : `${cast.find((c) => c.key === st.winner)?.name || st.winner} wins`}</Text>
            <Pressable style={styles.againBtn} onPress={() => { setSt(() => { const g = newGame(ids); g.turn = Math.floor(Math.random() * ids.length); return g; }); setChat([{ who: 'sys', text: 'new deal.' }]); }}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.againInner}><Text style={styles.againText}>deal again</Text></LinearGradient>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.turnLabel}>
            {st.turn === 0 ? (yourLegal.size ? 'your turn' : st.phase === 'drawn' ? 'you drew…' : 'no play — draw') : `${nameOf(st.turn)}'s turn`}
          </Text>
        )}

        {drawnOffer && st.phase === 'drawn' && st.turn === 0 && (
          <View style={styles.drawnRow}>
            <Text style={styles.drawnLabel}>you drew a playable card</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={styles.drawnBtn} onPress={youPlayDrawn}><Text style={styles.drawnBtnTxt}>play it</Text></Pressable>
              <Pressable style={[styles.drawnBtn, { borderColor: 'rgba(255,255,255,0.2)', backgroundColor: 'transparent' }]} onPress={youKeepDrawn}><Text style={[styles.drawnBtnTxt, { color: C.muted }]}>keep it</Text></Pressable>
            </View>
          </View>
        )}

        {pendingWild && (
          <View style={styles.wildPick}>
            <Text style={styles.wildPrompt}>choose a color</Text>
            <View style={styles.wildRow}>
              {['R', 'G', 'B', 'Y'].map((col) => (
                <Pressable key={col} onPress={() => pickWild(col)} style={[styles.wildSwatch, { backgroundColor: CARD_COLORS[col] }]}>
                  <Text style={styles.wildSwatchLabel}>{COLOR_NAME[col]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {!pendingWild && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yourHand}>
            {st.hands[0].map((card, i) => {
              const playable = yourLegal.has(i);
              const isDrawnCard = st.phase === 'drawn' && st.turn === 0 && i === st.drawnIdx;
              return (
                <View key={i} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                  <UnoCard card={card} onPress={() => playable ? youPlay(i) : null} playable={playable || isDrawnCard}
                    dim={st.turn === 0 && st.phase === 'play' && !playable} w={70} h={104} />
                </View>
              );
            })}
          </ScrollView>
        )}

        {chatOpen && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.chatPanel}>
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
              <Pressable onPress={sendChat} hitSlop={8}><Text style={styles.chatSend}>↑</Text></Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}
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