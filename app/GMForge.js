// [zip24] identity: forge-rose on ink — the battlefield's kin, lighter
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE FORGE (the Grand Master's front door; Phase 6, GM surface v1)
//  The training half of debate. A board of TAKES — contested positions from
//  the light bank — plus your own. Pick one, declare your side, and he takes
//  the other: short exchanges, one thrust at a time. The arena (Battlefield)
//  stays the competition half; this is where the blade is made.
//  Pure client: rides GET /battlefield/motions (light tier) + the persona
//  deep-link opener (the coach "ask" pattern). Gold on the dark — his color.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getBattlefieldMotions } from './api';
import { FONTS } from './theme';

const GOLD = '#E8788E';   // forge-rose: the battlefield's crimson, before the arena sharpens it
const G = {
  ground: '#0C080B',
  raise: 'rgba(232,120,142,0.06)',
  hair: 'rgba(232,120,142,0.14)',
  ink: '#F2E9EC',
  mist: 'rgba(242,233,236,0.55)',
  faint: 'rgba(242,233,236,0.30)',
};

export default function GMForge({ onBack = () => {}, onSpar = () => {}, onChat = () => {}, onArena = () => {} }) {
  const [board, setBoard] = useState(null);       // null=loading | 'failed' | [{motion, domain}]
  const [picked, setPicked] = useState(null);     // the take awaiting a side
  const [own, setOwn] = useState('');
  const [seed, setSeed] = useState(0);            // reshuffle lever

  const load = async () => {
    setBoard(null);
    try {
      const r = await getBattlefieldMotions('light');
      const all = [];
      for (const d of (r?.domains || [])) for (const m of (d.motions || [])) all.push({ motion: m, domain: d.label || d.key });
      if (!all.length) { setBoard('failed'); return; }
      setBoard(all);
    } catch (e) { setBoard('failed'); }
  };
  useEffect(() => { load(); }, []);

  // a hand of ~8 takes, reshuffled by the seed — the board should feel dealt, not listed
  const hand = useMemo(() => {
    if (!Array.isArray(board)) return [];
    const a = [...board];
    let s = 13 + seed * 31;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a.slice(0, 8);
  }, [board, seed]);

  const spar = (take, side) => {
    setPicked(null);
    const opener = `Spar with me, Grand Master. The take: "${take}". I ${side === 'hold' ? 'hold this position' : 'reject this position'}. Take the other side — short exchanges, one thrust at a time, and don't let me off easy.`;
    onSpar(opener);
  };

  return (
    <View style={st.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['rgba(232,120,142,0.10)', 'rgba(232,120,142,0.03)', G.ground]} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6 }}>
          <Pressable onPress={onBack} hitSlop={14}><Text style={st.backTxt}>‹  back</Text></Pressable>
          <Pressable onPress={onChat} hitSlop={12}><Text style={st.chatLink}>just sit with him ›</Text></Pressable>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={st.kicker}>the forge</Text>
          <Text style={st.lead}>Pick a take. Declare your side.{'\n'}He takes the other.</Text>

          {/* bring your own */}
          <View style={st.ownWrap}>
            <TextInput
              value={own} onChangeText={setOwn}
              placeholder="or bring your own take…" placeholderTextColor={G.faint}
              style={st.ownInput} multiline
            />
            {own.trim() ? (
              <Pressable onPress={() => { const t = own.trim(); setOwn(''); setPicked({ motion: t, domain: 'yours' }); }} hitSlop={8} style={st.ownGo}>
                <Text style={{ color: GOLD, fontSize: 15 }}>›</Text>
              </Pressable>
            ) : null}
          </View>

          {/* the board */}
          {board === null ? (
            <Text style={st.boardNote}>setting the board…</Text>
          ) : board === 'failed' ? (
            <Pressable onPress={load}><Text style={st.boardNote}>the board didn't come. tap to try again.</Text></Pressable>
          ) : (
            <>
              {hand.map((t, i) => (
                <Pressable key={i} style={st.take} onPress={() => setPicked(t)}>
                  <Text style={st.takeDomain}>{String(t.domain).toLowerCase()}</Text>
                  <Text style={st.takeTxt}>{t.motion}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => setSeed((s) => s + 1)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 14 }}>
                <Text style={st.reshuffle}>different takes</Text>
              </Pressable>
            </>
          )}

          {/* the door to the arena */}
          <Pressable onPress={onArena} style={st.arena}>
            <Text style={st.arenaTxt}>when you're ready, the battlefield awaits ›</Text>
            <Text style={st.arenaSub}>real duels, a judge on the bench — through the Play door.</Text>
          </Pressable>
        </ScrollView>

        {/* the side picker */}
        {picked ? (
          <Pressable style={st.veil} onPress={() => setPicked(null)}>
            <View style={st.sheet}>
              <View style={st.handle} />
              <Text style={st.sheetTake}>{picked.motion}</Text>
              <Pressable style={st.side} onPress={() => spar(picked.motion, 'hold')}>
                <Text style={st.sideTxt}>I hold this position</Text>
              </Pressable>
              <Pressable style={st.side} onPress={() => spar(picked.motion, 'reject')}>
                <Text style={st.sideTxt}>I reject this position</Text>
              </Pressable>
            </View>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.ground },
  backTxt: { fontFamily: FONTS.body, color: G.faint, fontSize: 14, letterSpacing: 0.3 },
  chatLink: { fontFamily: FONTS.displayItalic, color: G.mist, fontSize: 13.5 },

  kicker: { fontFamily: FONTS.body, color: GOLD, fontSize: 12, letterSpacing: 3.5, textTransform: 'uppercase', textAlign: 'center', marginTop: 26, opacity: 0.85 },
  lead: { fontFamily: FONTS.display, color: G.ink, fontSize: 25, lineHeight: 34, textAlign: 'center', marginTop: 10, marginBottom: 22, paddingHorizontal: 30 },

  ownWrap: { flexDirection: 'row', alignItems: 'flex-end', marginHorizontal: 20, marginBottom: 20, borderBottomWidth: 1, borderColor: G.hair },
  ownInput: { flex: 1, fontFamily: FONTS.body, color: G.ink, fontSize: 14.5, paddingVertical: 10, maxHeight: 90 },
  ownGo: { paddingHorizontal: 10, paddingBottom: 12 },

  boardNote: { fontFamily: FONTS.displayItalic, color: G.faint, fontSize: 15, textAlign: 'center', marginTop: 30 },
  take: { marginHorizontal: 20, marginBottom: 10, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 14, backgroundColor: G.raise, borderWidth: 1, borderColor: G.hair },
  takeDomain: { fontFamily: FONTS.body, color: GOLD, fontSize: 10.5, letterSpacing: 1.6, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 },
  takeTxt: { fontFamily: FONTS.display, color: G.ink, fontSize: 15.5, lineHeight: 22 },
  reshuffle: { fontFamily: FONTS.displayItalic, color: G.mist, fontSize: 13.5 },

  arena: { marginTop: 34, marginHorizontal: 20, paddingTop: 18, borderTopWidth: 1, borderColor: G.hair },
  arenaTxt: { fontFamily: FONTS.displayItalic, color: GOLD, fontSize: 15.5, opacity: 0.9 },
  arenaSub: { fontFamily: FONTS.body, color: G.faint, fontSize: 12.5, marginTop: 4 },

  veil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,3,2,0.72)', justifyContent: 'flex-end' },
  sheet: { paddingHorizontal: 28, paddingTop: 14, paddingBottom: 44, backgroundColor: '#150F13', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderColor: G.hair },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: 'rgba(242,233,236,0.22)', marginBottom: 18 },
  sheetTake: { fontFamily: FONTS.display, color: G.ink, fontSize: 17, lineHeight: 25, marginBottom: 20 },
  side: { paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(232,120,142,0.35)', alignItems: 'center', marginBottom: 10, backgroundColor: 'rgba(232,120,142,0.07)' },
  sideTxt: { fontFamily: FONTS.medium, color: G.ink, fontSize: 15 },
});
