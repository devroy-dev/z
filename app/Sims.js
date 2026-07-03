// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE SIMS WING. Real-world emulators with the house inside them:
//  every other sim is a spreadsheet; ours has a cast. First fixture: the
//  Trading Floor. The auction and the pitch take their doors later.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Grain from './Grain';
import { NIGHT as C, FONTS } from './theme';

const TEAL = '#6FC9E0';

export default function Sims({ onBack = () => {}, onOpenFloor = () => {}, onOpenLeague = () => {} }) {
  return (
    <View style={st.root}>
      <LinearGradient colors={['#0C1216', '#0A0D12', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <Grain />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={st.header}>
          <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹ the play</Text></Pressable>
          <Text style={st.kicker}>simulate</Text>
          <Text style={st.title}>the sims</Text>
          <Text style={st.intro}>slices of the real world, run with phantom stakes — and the house living inside each one.</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <Pressable style={st.fixture} onPress={onOpenFloor}>
            <LinearGradient colors={['rgba(111,201,224,0.10)', 'rgba(111,201,224,0.02)']} style={st.fixtureInner}>
              <View style={st.fixtureTop}>
                <Svg width="30" height="30" viewBox="0 0 24 24">
                  <Path d="M3 18l5-6 4 3 6-8M15 7h4v4" stroke={TEAL} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[st.live, { color: TEAL }]}>OPEN</Text>
              </View>
              <Text style={st.fixtureTitle}>The Trading Floor</Text>
              <Text style={st.fixtureLine}>₹10,00,000 phantom. real crypto prices. build a book, climb the board — the economist reads your close every night.</Text>
              <Text style={st.disclaimer}>phantom money · real prices · zero real value</Text>
            </LinearGradient>
          </Pressable>

          <Pressable style={st.fixture} onPress={onOpenLeague}>
            <LinearGradient colors={['rgba(143,217,143,0.10)', 'rgba(143,217,143,0.02)']} style={[st.fixtureInner, { borderColor: 'rgba(143,217,143,0.22)' }]}>
              <View style={st.fixtureTop}>
                <Svg width="30" height="30" viewBox="0 0 24 24">
                  <Path d="M12 3a9 9 0 100 18 9 9 0 000-18zM12 8l3 2.2-1.1 3.6h-3.8L9 10.2 12 8z" stroke="#8FD98F" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
                </Svg>
                <Text style={[st.live, { color: '#8FD98F' }]}>OPEN</Text>
              </View>
              <Text style={st.fixtureTitle}>Fantasy Football</Text>
              <Text style={st.fixtureLine}>pick five and a captain from the real EPL pool. real gameweek points, a friends board, and the hustler talking trash at every close.</Text>
              <Text style={st.disclaimer}>house league · real points · zero real value</Text>
            </LinearGradient>
          </Pressable>

          <View style={st.coming}>
            <Text style={st.comingTitle}>The Auction</Text>
            <Text style={st.comingLine}>a franchise auction night with friends and rival persona owners. december.</Text>
          </View>
          <View style={st.coming}>
            <Text style={st.comingTitle}>The Pitch</Text>
            <Text style={st.comingLine}>raise phantom rounds from the house's toughest investors. later.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 14 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginBottom: 10 },
  kicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 32, marginTop: 2 },
  intro: { fontFamily: FONTS.light, color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8, maxWidth: 330 },

  fixture: { marginBottom: 16 },
  fixtureInner: { borderRadius: 24, borderWidth: 1, borderColor: 'rgba(111,201,224,0.22)', padding: 22 },
  fixtureTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  live: { fontFamily: FONTS.semibold, fontSize: 11, letterSpacing: 2 },
  fixtureTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 25, marginTop: 12 },
  fixtureLine: { fontFamily: FONTS.light, color: C.muted, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
  disclaimer: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 0.5, marginTop: 14 },

  coming: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,240,228,0.06)', padding: 18, marginBottom: 12, opacity: 0.55 },
  comingTitle: { fontFamily: FONTS.display, color: C.muted, fontSize: 18 },
  comingLine: { fontFamily: FONTS.light, color: C.faint, fontSize: 12.5, lineHeight: 18, marginTop: 4 },
});
