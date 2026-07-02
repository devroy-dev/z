// yourZ — LUDO LIVE: multiplayer board. Perfect information, so the client
// computes legal highlights with the same rules module; the SERVER rolls
// the dice and owns the truth.
import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz, faceFor, SEAT_TONES } from '../common';
import { useLiveSession, seatLabelFn, seatFace } from '../liveCommon';
import { legalMoves } from './rules.js';
import { cellFor, YARDS } from './boardMap.js';

const CELL = 22;

export default function LudoLive({ sessionId, onExit = () => {} }) {
  const { view, move } = useLiveSession(sessionId);
  const label = seatLabelFn(view);
  const g = view?.state;
  const me = view?.mySeat ?? -1;
  const myTurn = g && g.winner == null && g.turn === me;
  const legal = myTurn && g.phase === 'move' ? legalMoves(g) : [];
  const legalTokens = new Set(legal.map((m) => m.token));

  return (
    <View style={st.root}>
      <LinearGradient colors={['#100E13', '#0B0A0E', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>ludo · live board</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* seats strip */}
        <View style={st.seatsRow}>
          {(view?.seats || []).map((s, i) => {
            const pk = seatFace(view, i);
            const acting = g && g.winner == null && g.turn === i;
            return (
              <View key={i} style={[st.seatChip, acting && { borderColor: SEAT_TONES[i] }]}>
                {pk ? <Image source={{ uri: faceFor(pk) }} style={st.chipFace} /> : <Text style={[st.chipG, { color: SEAT_TONES[i] }]}>☺</Text>}
                <Text style={[st.chipName, { color: SEAT_TONES[i] }]} numberOfLines={1}>{label(i)}</Text>
              </View>
            );
          })}
        </View>

        {/* the board */}
        <View style={st.boardWrap}>
          <View style={{ width: CELL * 15, height: CELL * 15 }}>
            {/* grid wash */}
            <View style={[StyleSheet.absoluteFill, st.boardBg]} />
            {(g?.players || []).map((p, seat) =>
              p.tokens.map((tok, ti) => {
                const pos = tok.steps === 0 ? YARDS[seat][ti] : cellFor(seat, tok.steps);
                if (!pos) return null;
                const [row, col] = pos;
                const mine = seat === me;
                const canMove = mine && legalTokens.has(ti);
                return (
                  <Pressable key={seat + '-' + ti} disabled={!canMove}
                    onPress={() => { move({ type: 'move', token: ti }); buzz('knock'); }}
                    style={[st.token, {
                      left: col * CELL + 2, top: row * CELL + 2,
                      backgroundColor: SEAT_TONES[seat],
                      borderColor: canMove ? '#fff' : 'rgba(0,0,0,0.45)',
                      borderWidth: canMove ? 2 : 1,
                    }]} />
                );
              })
            )}
          </View>
        </View>

        {/* your move */}
        <View style={st.actions}>
          {g?.winner != null ? (
            <View style={st.banner}>
              <Text style={st.bannerTxt}>{g.winner === me ? 'ALL FOUR HOME — YOU WIN' : `${label(g.winner).toUpperCase()} BRINGS IT HOME`}</Text>
              <Pressable style={st.btn} onPress={onExit}><Text style={st.btnTxt}>back to the room</Text></Pressable>
            </View>
          ) : myTurn && g.phase === 'roll' ? (
            <Pressable style={st.rollBtn} onPress={() => { move({ type: 'roll' }); buzz('tap'); }}>
              <Text style={st.rollTxt}>roll</Text>
            </Pressable>
          ) : myTurn && g.phase === 'move' ? (
            <Text style={st.hint}>you rolled a {g.die} — tap a lit token</Text>
          ) : g ? (
            <Text style={st.waiting}>{label(g.turn)}'s turn{g.die ? ` · rolled ${g.die}` : ''}</Text>
          ) : (
            <Text style={st.waiting}>taking your seat…</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0A0E' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#F3A85F', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  seatsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 8, flexWrap: 'wrap' },
  seatChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  chipFace: { width: 20, height: 20, borderRadius: 10 },
  chipG: { fontSize: 14 },
  chipName: { fontFamily: FONTS.medium, fontSize: 11, maxWidth: 70 },
  boardWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  boardBg: { backgroundColor: 'rgba(255,255,255,0.035)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  token: { position: 'absolute', width: CELL - 4, height: CELL - 4, borderRadius: (CELL - 4) / 2 },
  actions: { minHeight: 84, alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
  rollBtn: { paddingHorizontal: 34, paddingVertical: 13, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(243,168,95,0.6)', backgroundColor: 'rgba(243,168,95,0.1)' },
  rollTxt: { fontFamily: FONTS.display, color: '#F3A85F', fontSize: 18, letterSpacing: 1 },
  hint: { fontFamily: FONTS.displayItalic, color: C.cream, fontSize: 14 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  banner: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(243,168,95,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5 },
  btn: { marginTop: 9, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)', backgroundColor: 'rgba(243,168,95,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: '#F3A85F', fontSize: 13.5 },
});
