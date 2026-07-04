// Battlefield.js — THE BATTLEFIELD (shell / v0).
//
// The place where debate happens: 1v1, judged by the adjudicator, watched by the
// room. This is the entry surface — it establishes the FORMAT (motion, PRO/CON,
// the three phases, the two-results verdict) so the shape is real and felt, before
// the live adjudicator + duel loop are wired. No engine, no external call yet.
//
// Register: crimson — this is the arena of argument. Serious, electric, not warm.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from './theme';

const CRIMSON = '#E0576F';
const INK = '#08060A';

function Swords({ size = 30, color = CRIMSON }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 4l10 10M4 5l1-1 2 2-1 1zM14 14l1.5 1.5a2 2 0 002.8 0M19 4L9 14M20 5l-1-1-2 2 1 1zM10 14l-1.5 1.5a2 2 0 01-2.8 0"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Phase({ n, name, who, note }) {
  return (
    <View style={styles.phaseRow}>
      <View style={styles.phaseNum}><Text style={styles.phaseNumTxt}>{n}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.phaseName}>{name}</Text>
        <Text style={styles.phaseWho}>{who}</Text>
        {note ? <Text style={styles.phaseNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

export default function Battlefield({ onBack = () => {}, onEnterDuel = () => {}, onWatch = () => {} }) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0A10', '#12070C', INK]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topRow}>
          <Pressable hitSlop={12} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Swords size={34} />
            <Text style={styles.kicker}>ARGUE IT OUT</Text>
          </View>
          <Text style={styles.title}>The Battlefield</Text>
          <Text style={styles.lede}>
            Two people. One motion. Assigned sides. No shouting past each other — a structured duel of reason, judged by an adjudicator who rewards <Text style={styles.ledeEm}>truth over confidence</Text>, and watched by the room.
          </Text>

          {/* the motion example */}
          <Text style={styles.sectionLabel}>THE MOTION</Text>
          <View style={styles.motionCard}>
            <Text style={styles.motionText}>"This house believes economic sanctions do more to entrench regimes than to weaken them."</Text>
            <View style={styles.sidesRow}>
              <View style={[styles.sideChip, { borderColor: 'rgba(120,200,255,0.4)' }]}><Text style={[styles.sideTxt, { color: '#78C8FF' }]}>PRO</Text></View>
              <Text style={styles.vs}>vs</Text>
              <View style={[styles.sideChip, { borderColor: 'rgba(224,87,111,0.5)' }]}><Text style={[styles.sideTxt, { color: CRIMSON }]}>CON</Text></View>
            </View>
            <Text style={styles.motionSub}>Sides are assigned, not chosen. Arguing the position you're given is the skill.</Text>
          </View>

          {/* the phases */}
          <Text style={styles.sectionLabel}>HOW A DUEL RUNS</Text>
          <View style={styles.phasesCard}>
            <Phase n="1" name="Opening" who="PRO states the case, then CON." />
            <Phase n="2" name="Rebuttal" who="Each attacks the other's opening." note="Where it sharpens." />
            <Phase n="3" name="Closing" who="Final case, both sides. No new arguments." />
            <View style={styles.turnNote}>
              <Text style={styles.turnNoteTxt}>Turn-locked. Only one speaks at a time — the other watches, and so does the room.</Text>
            </View>
          </View>

          {/* the adjudicator */}
          <Text style={styles.sectionLabel}>THE ADJUDICATOR</Text>
          <View style={styles.adjCard}>
            <Text style={styles.adjLine}>An undefeated judge with an encyclopedic corpus. He fact-checks live, strikes fabricated data, and never rewards a confident lie over a nuanced truth.</Text>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricPct}>50%</Text>
                <Text style={styles.metricName}>MATTER</Text>
                <Text style={styles.metricSub}>logic · evidence · fact</Text>
              </View>
              <View style={styles.metricDivide} />
              <View style={styles.metric}>
                <Text style={styles.metricPct}>50%</Text>
                <Text style={styles.metricName}>MANNER</Text>
                <Text style={styles.metricSub}>delivery · structure · control</Text>
              </View>
            </View>
          </View>

          {/* the two results */}
          <Text style={styles.sectionLabel}>TWO VERDICTS</Text>
          <View style={styles.twoCard}>
            <View style={styles.twoRow}>
              <Text style={styles.twoTag}>THE ADJUDICATOR</Text>
              <Text style={styles.twoDesc}>decides the winner — on the merits.</Text>
            </View>
            <View style={styles.twoRow}>
              <Text style={styles.twoTag}>THE ROOM</Text>
              <Text style={styles.twoDesc}>votes too. Charisma often wins the crowd.</Text>
            </View>
            <Text style={styles.twoGap}>When they disagree — that's the whole point. Eloquence can mask a weak argument. It can't survive a factual audit.</Text>
          </View>

          {/* enter a practice duel, or watch one live */}
          <Pressable style={styles.enterBtn} onPress={onEnterDuel}>
            <Swords size={20} color={INK} />
            <Text style={styles.enterTxt}>Try a practice duel</Text>
          </Pressable>
          <Pressable style={styles.watchBtn} onPress={onWatch}>
            <Text style={styles.watchTxt}>Watch a live duel</Text>
          </Pressable>
          <Text style={styles.enterSub}>Take an assigned side against the house, or watch two debaters go head to head and vote on the winner. 1v1 duels, live spectators, and college tournaments are on their way.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INK },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, height: 44 },
  chev: { fontFamily: FONTS.display, color: 'rgba(245,236,225,0.7)', fontSize: 34, marginTop: -4 },

  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  kicker: { fontFamily: FONTS.semibold, color: 'rgba(224,87,111,0.9)', fontSize: 11, letterSpacing: 3 },
  title: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 38, marginTop: 10 },
  lede: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.72)', fontSize: 17, lineHeight: 26, marginTop: 14 },
  ledeEm: { fontFamily: FONTS.displayItalic, color: CRIMSON },

  sectionLabel: { fontFamily: FONTS.semibold, color: 'rgba(245,236,225,0.4)', fontSize: 10.5, letterSpacing: 2.5, marginTop: 32, marginBottom: 12 },

  motionCard: { borderWidth: 1, borderColor: 'rgba(224,87,111,0.2)', borderRadius: 18, padding: 20, backgroundColor: 'rgba(224,87,111,0.04)' },
  motionText: { fontFamily: FONTS.displayItalic, color: '#F5ECE1', fontSize: 20, lineHeight: 28 },
  sidesRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  sideChip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 6 },
  sideTxt: { fontFamily: FONTS.semibold, fontSize: 13, letterSpacing: 1.5 },
  vs: { fontFamily: FONTS.displayItalic, color: 'rgba(245,236,225,0.4)', fontSize: 16 },
  motionSub: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.45)', fontSize: 13, marginTop: 16, lineHeight: 19 },

  phasesCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 8, paddingVertical: 6 },
  phaseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 14 },
  phaseNum: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(224,87,111,0.4)', alignItems: 'center', justifyContent: 'center' },
  phaseNumTxt: { fontFamily: FONTS.display, color: CRIMSON, fontSize: 15 },
  phaseName: { fontFamily: FONTS.medium, color: '#F5ECE1', fontSize: 16.5 },
  phaseWho: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 13.5, marginTop: 3, lineHeight: 19 },
  phaseNote: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 13.5, marginTop: 4 },
  turnNote: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', margin: 14, marginTop: 4, paddingTop: 14 },
  turnNoteTxt: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.5)', fontSize: 13, lineHeight: 19 },

  adjCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 },
  adjLine: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.75)', fontSize: 16, lineHeight: 24 },
  metricRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  metric: { flex: 1, alignItems: 'center' },
  metricPct: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 26 },
  metricName: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 11, letterSpacing: 2, marginTop: 4 },
  metricSub: { fontFamily: FONTS.body, color: 'rgba(245,236,225,0.4)', fontSize: 11.5, marginTop: 4 },
  metricDivide: { width: 1, height: 54, backgroundColor: 'rgba(255,255,255,0.08)' },

  twoCard: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 20 },
  twoRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 12 },
  twoTag: { fontFamily: FONTS.semibold, color: '#F5ECE1', fontSize: 11.5, letterSpacing: 1.5, width: 130 },
  twoDesc: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.6)', fontSize: 14.5, flex: 1, lineHeight: 20 },
  twoGap: { fontFamily: FONTS.displayItalic, color: 'rgba(224,87,111,0.85)', fontSize: 15, lineHeight: 23, marginTop: 8 },

  soonBar: { marginTop: 34, borderWidth: 1, borderColor: 'rgba(224,87,111,0.25)', borderRadius: 18, padding: 20, backgroundColor: 'rgba(224,87,111,0.05)' },
  soonTitle: { fontFamily: FONTS.display, color: '#F5ECE1', fontSize: 19 },
  soonSub: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.62)', fontSize: 14.5, lineHeight: 22, marginTop: 8 },

  enterBtn: { marginTop: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: CRIMSON, borderRadius: 14, paddingVertical: 16 },
  enterTxt: { fontFamily: FONTS.semibold, color: INK, fontSize: 16, letterSpacing: 0.3 },
  watchBtn: { marginTop: 12, borderWidth: 1, borderColor: 'rgba(224,87,111,0.5)', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  watchTxt: { fontFamily: FONTS.semibold, color: CRIMSON, fontSize: 15, letterSpacing: 0.3 },
  enterSub: { fontFamily: FONTS.light, color: 'rgba(245,236,225,0.55)', fontSize: 13.5, lineHeight: 20, marginTop: 14, textAlign: 'center', paddingHorizontal: 8 },
});
