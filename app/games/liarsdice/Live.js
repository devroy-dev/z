// ════════════════════════════════════════════════════════════════════════
//  yourZ — LIAR'S DICE, LIVE. The multiplayer table: state lives on the
//  server (per-viewer filtered), this screen just renders your view and
//  proposes moves. Humans and personas share the seats. Polls while live.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from '../../Grain';
import { C, FONTS } from '../../theme';
import { buzz, faceFor, Die } from '../common';
import { personaMeta } from '../personas';
import { getGameSession, sendGameMove, getRoomMembers } from '../../api';

const FACE_GLYPH = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function LiarsDiceLive({ sessionId, onExit = () => {} }) {
  const [view, setView] = useState(null);       // { state, mySeat, seats, version, status }
  const [names, setNames] = useState({});       // user_id → name
  const [bidFace, setBidFace] = useState(0);
  const versionRef = useRef(0);
  const polling = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const v = await getGameSession(sessionId);
      if (v && v.version !== versionRef.current) {
        versionRef.current = v.version;
        setView(v);
        if (v.state?.phase === 'reveal') buzz('knock');
      }
    } catch (e) {}
  }, [sessionId]);

  useEffect(() => {
    polling.current = true;
    refresh();
    const t = setInterval(() => { if (polling.current) refresh(); }, 1600);
    return () => { polling.current = false; clearInterval(t); };
  }, [refresh]);

  const move = async (m) => {
    try {
      await sendGameMove(sessionId, m, versionRef.current);
      buzz('tick');
      refresh();
    } catch (e) { refresh(); }
  };

  const seatLabel = useCallback((i) => {
    const s = view?.seats?.[i];
    if (!s) return '?';
    if (s.kind === 'persona') return (personaMeta(s.id)?.name || s.id).replace(/^the /, '');
    if (i === view.mySeat) return 'you';
    return names[s.id] || 'friend';
  }, [view, names]);

  const g = view?.state;
  const me = view?.mySeat ?? -1;
  const myTurn = g && g.phase === 'bidding' && g.toAct === me;
  const legalFaces = () => {
    if (!g?.bid) return [1, 2, 3, 4, 5, 6];
    return [1, 2, 3, 4, 5, 6];   // any face; qty adjusts
  };
  const qtysFor = (f) => {
    if (!g) return [];
    const total = g.dice.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0);
    const min = !g.bid ? 1 : f > g.bid.face ? g.bid.qty : g.bid.qty + 1;
    const out = [];
    for (let q = min; q <= Math.min(total, min + 5); q++) out.push(q);
    return out;
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#12100E', '#0D0B09', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.bar}>
          <Pressable hitSlop={12} onPress={onExit}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.kicker}>liar's dice · live table</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* everyone but you */}
        <View style={st.oppArc}>
          {(view?.seats || []).map((s, i) => {
            if (i === me) return null;
            const isP = s.kind === 'persona';
            const acting = g && g.phase === 'bidding' && g.toAct === i;
            const isOut = g?.out?.[i];
            const revealed = g?.phase !== 'bidding' && g?.lastResult?.cupsShown;
            return (
              <View key={i} style={[st.seat, isOut && { opacity: 0.3 }]}>
                <View style={[st.seatFaceWrap, acting && { borderColor: C.ember }]}>
                  {isP ? <Image source={{ uri: faceFor(s.id) }} style={st.seatFace} />
                       : <View style={[st.seatFace, st.humanFace]}><Text style={st.humanGlyph}>☺</Text></View>}
                </View>
                <Text style={st.seatName} numberOfLines={1}>{seatLabel(i)}</Text>
                {isOut ? <Text style={st.outTxt}>out</Text> : revealed ? (
                  <View style={st.miniDiceRow}>
                    {(g.lastResult.cupsShown[i] || []).map((d, k) => (
                      <Text key={k} style={[st.miniDie, d === g.lastResult.bid.face && st.miniDieHot]}>{FACE_GLYPH[d]}</Text>
                    ))}
                  </View>
                ) : (
                  <Text style={st.cupTxt}>🥤 ×{g ? g.dice[i] : 5}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* center */}
        <View style={st.felt}>
          {!g ? <Text style={st.leadHint}>taking your seat…</Text>
          : g.phase === 'over' ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>{g.winner === me ? 'LAST CUP STANDING — YOU' : `${seatLabel(g.winner).toUpperCase()} OUTLASTS THE TABLE`}</Text>
              <Pressable style={[st.nextBtn, { marginTop: 10 }]} onPress={onExit}><Text style={st.nextTxt}>back to the room</Text></Pressable>
            </View>
          ) : g.phase === 'reveal' && g.lastResult ? (
            <View style={st.bannerWrap}>
              <Text style={st.bannerTxt}>
                {`"${g.lastResult.bid.qty} × ${FACE_GLYPH[g.lastResult.bid.face]}" — there were ${g.lastResult.actual}. `}
                {g.lastResult.truthful ? `${seatLabel(g.lastResult.caller).toUpperCase()} CALLED WRONG` : `${seatLabel(g.lastResult.bidder).toUpperCase()} WAS LYING`}
              </Text>
              <Text style={st.bannerSub}>{seatLabel(g.lastResult.loser)} loses a die{g.lastResult.eliminated ? ' — and is OUT' : ''}</Text>
              <Pressable style={[st.nextBtn, { marginTop: 10 }]} onPress={() => move({ type: 'next' })}><Text style={st.nextTxt}>next round</Text></Pressable>
            </View>
          ) : g.bid ? (
            <>
              <Text style={st.bidBig}>{g.bid.qty} × {FACE_GLYPH[g.bid.face]}</Text>
              <Text style={st.bidWho}>{seatLabel(g.bid.by)} claims it</Text>
              {!myTurn && <Text style={st.turnHint}>{seatLabel(g.toAct)} to act</Text>}
            </>
          ) : (
            <Text style={st.leadHint}>{myTurn ? 'open the bidding' : `${seatLabel(g.toAct)} opens…`}</Text>
          )}
        </View>

        {/* your cup */}
        <View style={st.youRow}>
          <Text style={st.youLabel}>under your cup</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(g && me >= 0 ? g.cups[me] : []).map((d, k) => (
              <Die key={k} value={d} rolling={false} enabled={false} tone={C.ember} />
            ))}
            {g?.out?.[me] && <Text style={st.outTxt}>you're out — spectating</Text>}
          </View>
        </View>

        {/* your move */}
        <View style={st.actions}>
          {myTurn ? (
            bidFace === 0 ? (
              <View style={st.actRow}>
                {legalFaces().map((f) => (
                  <Pressable key={f} style={st.faceBtn} onPress={() => setBidFace(f)}>
                    <Text style={st.faceTxt}>{FACE_GLYPH[f]}</Text>
                  </Pressable>
                ))}
                {g.bid && <Pressable style={st.liarBtn} onPress={() => move({ type: 'liar' })}><Text style={st.liarTxt}>LIAR</Text></Pressable>}
              </View>
            ) : (
              <View style={st.actRow}>
                <Pressable style={st.faceBtnLit}><Text style={st.faceTxt}>{FACE_GLYPH[bidFace]}</Text></Pressable>
                {qtysFor(bidFace).map((q) => (
                  <Pressable key={q} style={st.qtyBtn} onPress={() => { move({ type: 'bid', qty: q, face: bidFace }); setBidFace(0); }}>
                    <Text style={st.qtyTxt}>{q}</Text>
                  </Pressable>
                ))}
                <Pressable style={st.backBtn} onPress={() => setBidFace(0)}><Text style={st.backTxt}>‹</Text></Pressable>
              </View>
            )
          ) : g && g.phase === 'bidding' ? (
            <Text style={st.waiting}>{seatLabel(g.toAct)} is weighing it…</Text>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0B09' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  kicker: { fontFamily: FONTS.body, color: '#F0A765', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 },
  oppArc: { flexDirection: 'row', justifyContent: 'space-evenly', paddingTop: 8, flexWrap: 'wrap' },
  seat: { alignItems: 'center', width: 100 },
  seatFaceWrap: { width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.18)' },
  seatFace: { width: 43, height: 43, borderRadius: 22, backgroundColor: '#120f0c' },
  humanFace: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,167,101,0.12)' },
  humanGlyph: { fontSize: 20, color: '#F0A765' },
  seatName: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.85)', fontSize: 10.5, marginTop: 3 },
  cupTxt: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 2 },
  outTxt: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 11, marginTop: 3 },
  miniDiceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 1, marginTop: 2, maxWidth: 96 },
  miniDie: { fontSize: 17, color: 'rgba(245,236,225,0.55)' },
  miniDieHot: { color: '#F0A765' },
  felt: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 18 },
  bidBig: { fontFamily: FONTS.display, color: C.cream, fontSize: 44 },
  bidWho: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5 },
  turnHint: { fontFamily: FONTS.body, color: C.faint, fontSize: 11.5, marginTop: 4 },
  leadHint: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14 },
  bannerWrap: { alignItems: 'center', paddingHorizontal: 18, paddingVertical: 13, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(240,167,101,0.4)', backgroundColor: 'rgba(0,0,0,0.35)' },
  bannerTxt: { fontFamily: FONTS.display, color: C.cream, fontSize: 15.5, textAlign: 'center' },
  bannerSub: { fontFamily: FONTS.body, color: C.muted, fontSize: 12, marginTop: 4 },
  nextBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(240,167,101,0.5)', backgroundColor: 'rgba(240,167,101,0.1)' },
  nextTxt: { fontFamily: FONTS.semibold, color: '#F0A765', fontSize: 13.5 },
  youRow: { alignItems: 'center', gap: 6, paddingBottom: 8 },
  youLabel: { fontFamily: FONTS.light, color: C.faint, fontSize: 9.5, letterSpacing: 2, textTransform: 'uppercase' },
  actions: { paddingHorizontal: 14, paddingBottom: 12, minHeight: 64, justifyContent: 'center' },
  actRow: { flexDirection: 'row', gap: 7, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  faceBtn: { width: 44, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  faceBtnLit: { width: 44, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#F0A765', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,167,101,0.1)' },
  faceTxt: { fontSize: 25, color: C.cream },
  qtyBtn: { width: 38, height: 46, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(240,167,101,0.45)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,167,101,0.07)' },
  qtyTxt: { fontFamily: FONTS.display, color: '#F0A765', fontSize: 17 },
  backBtn: { width: 32, height: 46, alignItems: 'center', justifyContent: 'center' },
  backTxt: { color: C.muted, fontSize: 24 },
  liarBtn: { paddingHorizontal: 15, height: 46, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(240,112,140,0.6)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,112,140,0.08)' },
  liarTxt: { fontFamily: FONTS.semibold, color: '#F0708C', fontSize: 14, letterSpacing: 2 },
  waiting: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, textAlign: 'center' },
});
