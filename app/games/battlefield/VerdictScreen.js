// VerdictScreen.js — THE VERDICT, read in-app (phase 4, item 5).
//
// The record's substance on glass: motion, sides by name, the winner, the
// verdict line, matter, manner, closing, the crowd tally, the date. Reads
// GET /battlefield/verdict/:sessionId (public — the same substance the share
// route serves logged-out). The typeset share-PNG is explicitly NOT this
// sitting — that is phase 2b, the design sitting, owner-gated. This screen is
// the reading surface for RECENT VERDICTS taps. Register: crimson.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { FONTS } from '../../theme';
import { getBattlefieldVerdict } from '../../api';

const CRIMSON = '#E0576F';
const BLUE = '#78C8FF';
const INK = '#08060A';
const CREAM = '#F5ECE1';

export default function VerdictScreen({ sessionId, onBack = () => {} }) {
  const [v, setV] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    (async () => {
      try { const j = await getBattlefieldVerdict(sessionId); if (on) setV(j); }
      catch (e) { if (on) setErr(String(e?.message || 'no verdict here')); }
      if (on) setLoading(false);
    })();
    return () => { on = false; };
  }, [sessionId]);

  const share = async () => {
    const link = 'https://callmez.app/battlefield/verdict/' + sessionId;
    try { await Share.share({ message: `the adjudicator ruled: ${v?.winner} — "${v?.motion}" ${link}`, url: link }); } catch (e) {}
  };

  const sideNames = (side) => {
    const s = (v?.sides || []).find((x) => x.side === side);
    return s ? s.names.join(' · ') : '';
  };

  return (
    <View style={st.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={st.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={st.chev}>‹</Text></Pressable>
          <Text style={st.topLabel}>the verdict</Text>
          {v ? <Pressable hitSlop={10} onPress={share}><Text style={{ fontSize: 16 }}>🔗</Text></Pressable> : <View style={{ width: 20 }} />}
        </View>
        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={CRIMSON} /></View>
        ) : err || !v ? (
          <View style={{ padding: 26 }}>
            <Text style={st.title}>Nothing stands here.</Text>
            <Text style={st.sub}>{err || 'This duel carries no verdict — it may still be live, or it ended without one.'}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 26, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
            <Text style={st.kicker}>THE ADJUDICATOR RULED</Text>
            <Text style={st.motion}>"{v.motion}"</Text>
            <View style={st.sidesRow}>
              <View style={[st.sideCol, v.winner === 'PRO' && st.sideColWin]}>
                <Text style={[st.sideTag, { color: BLUE }]}>PRO</Text>
                <Text style={st.sideNames}>{sideNames('PRO')}</Text>
              </View>
              <Text style={st.vs}>vs</Text>
              <View style={[st.sideCol, v.winner === 'CON' && st.sideColWin]}>
                <Text style={[st.sideTag, { color: CRIMSON }]}>CON</Text>
                <Text style={st.sideNames}>{sideNames('CON')}</Text>
              </View>
            </View>
            <Text style={st.winner}>
              <Text style={{ color: v.winner === 'PRO' ? BLUE : CRIMSON }}>{v.winner}</Text> takes the floor
            </Text>
            {!!v.verdictLine && <Text style={st.verdictLine}>{v.verdictLine}</Text>}
            {!!v.summary && <Text style={st.summary}>{v.summary}</Text>}
            {!!v.matter && (
              <View style={st.metric}>
                <Text style={st.metricLabel}>MATTER — logic · evidence · fact</Text>
                <Text style={st.metricBody}>{v.matter}</Text>
              </View>
            )}
            {!!v.manner && (
              <View style={st.metric}>
                <Text style={st.metricLabel}>MANNER — delivery · structure · control</Text>
                <Text style={st.metricBody}>{v.manner}</Text>
              </View>
            )}
            {!!v.closing && (
              <View style={st.closingCard}><Text style={st.closingTxt}>{v.closing}</Text></View>
            )}
            {v.crowd && v.crowd.total > 0 ? (
              <View style={st.crowdCard}>
                <Text style={st.metricLabel}>THE ROOM VOTED</Text>
                <View style={st.crowdRow}>
                  <Text style={[st.crowdNum, { color: BLUE }]}>{v.crowd.pro}</Text>
                  <Text style={st.crowdMid}>PRO · CON</Text>
                  <Text style={[st.crowdNum, { color: CRIMSON }]}>{v.crowd.con}</Text>
                </View>
              </View>
            ) : null}
            {!!v.date && <Text style={st.date}>{new Date(v.date).toDateString()}</Text>}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 6, justifyContent: 'space-between' },
  chev: { color: CREAM, fontSize: 28, fontFamily: FONTS.light },
  topLabel: { color: 'rgba(245,236,225,0.55)', fontSize: 12, letterSpacing: 2, fontFamily: FONTS.medium },
  kicker: { color: CRIMSON, fontSize: 11, letterSpacing: 3, fontFamily: FONTS.semibold, marginBottom: 12 },
  title: { color: CREAM, fontSize: 26, fontFamily: FONTS.display, marginBottom: 10 },
  motion: { color: CREAM, fontSize: 19, lineHeight: 28, fontFamily: FONTS.displayItalic, marginBottom: 18 },
  sidesRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: 18 },
  sideCol: { flex: 1, borderWidth: 1, borderColor: 'rgba(245,236,225,0.12)', borderRadius: 12, padding: 12, alignItems: 'center' },
  sideColWin: { borderColor: 'rgba(201,168,106,0.5)', backgroundColor: 'rgba(201,168,106,0.05)' },
  sideTag: { fontSize: 12, letterSpacing: 2, fontFamily: FONTS.semibold },
  sideNames: { color: 'rgba(245,236,225,0.7)', fontSize: 12.5, fontFamily: FONTS.body, marginTop: 5, textAlign: 'center' },
  vs: { color: 'rgba(245,236,225,0.35)', fontSize: 12, fontFamily: FONTS.body, alignSelf: 'center' },
  winner: { color: CREAM, fontSize: 24, fontFamily: FONTS.display, marginBottom: 8 },
  verdictLine: { color: 'rgba(245,236,225,0.85)', fontSize: 15.5, lineHeight: 23, fontFamily: FONTS.displayItalic, marginBottom: 14 },
  summary: { color: 'rgba(245,236,225,0.66)', fontSize: 14, lineHeight: 21, fontFamily: FONTS.body, marginBottom: 16 },
  metric: { borderLeftWidth: 2, borderLeftColor: 'rgba(224,87,111,0.4)', paddingLeft: 12, marginBottom: 14 },
  metricLabel: { color: 'rgba(245,236,225,0.45)', fontSize: 10.5, letterSpacing: 2, fontFamily: FONTS.semibold, marginBottom: 5 },
  metricBody: { color: 'rgba(245,236,225,0.72)', fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.body },
  closingCard: { borderWidth: 1, borderColor: 'rgba(201,168,106,0.3)', borderRadius: 12, padding: 14, backgroundColor: 'rgba(201,168,106,0.04)', marginTop: 4 },
  closingTxt: { color: '#C9A86A', fontSize: 14.5, lineHeight: 21, fontFamily: FONTS.displayItalic },
  crowdCard: { marginTop: 16 },
  crowdRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  crowdNum: { fontSize: 22, fontFamily: FONTS.display },
  crowdMid: { color: 'rgba(245,236,225,0.4)', fontSize: 11, letterSpacing: 1.5, fontFamily: FONTS.medium },
  date: { color: 'rgba(245,236,225,0.35)', fontSize: 12, fontFamily: FONTS.body, marginTop: 20 },
  sub: { color: 'rgba(245,236,225,0.5)', fontSize: 13.5, lineHeight: 20, fontFamily: FONTS.body },
});
