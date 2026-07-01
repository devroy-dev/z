// ════════════════════════════════════════════════════════════════════════
//  yourZ — YOU (profile). Lives inside the Desk. Its HEART is "what Z
//  remembers": the facts Z knows + the moments Z noticed — each with a
//  "forget" button. Deep memory + your control over it = the trust contract.
//  Also: your name/DP, pinned people, settings.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { C, FONTS } from './theme';

// seed: what Z has learned (facts) + noticed (notes). Real data from /notes later.
const SEED_FACTS = [
  { id: 'f1', key: 'work', value: 'building yourZ — a companion app. lawyer before this.' },
  { id: 'f2', key: 'home', value: 'greater noida.' },
  { id: 'f3', key: 'drives you', value: "won't ship anything that doesn't match the vision." },
];
const SEED_NOTES = [
  { id: 'n1', body: "gets sharp and fast when the work is flowing — the ideas come quicker than the words." },
  { id: 'n2', body: "cares more about how something feels than how it looks on paper." },
  { id: 'n3', body: "reframed a bug into a feature tonight without missing a beat. does that a lot." },
];

function MemoryCard({ item, isFact, onForget }) {
  const [forgetting, setForgetting] = useState(false);
  return (
    <View style={[styles.card, forgetting && { opacity: 0.4 }]}>
      <Text style={styles.cardText}>
        {isFact && <Text style={styles.cardKey}>{item.key} · </Text>}
        {isFact ? item.value : item.body}
      </Text>
      <Pressable hitSlop={8} onPress={() => { setForgetting(true); onForget(item.id); }}>
        <Text style={styles.forget}>{forgetting ? '…' : 'forget'}</Text>
      </Pressable>
    </View>
  );
}

export default function You({ onBack = () => {} }) {
  const [facts, setFacts] = useState(SEED_FACTS);
  const [notes, setNotes] = useState(SEED_NOTES);
  const forgetFact = (id) => setTimeout(() => setFacts((f) => f.filter((x) => x.id !== id)), 220);
  const forgetNote = (id) => setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 220);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#160F1C', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>you</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* your identity */}
          <View style={styles.identity}>
            <View style={styles.bigAvatar}><Text style={styles.bigInitial}>D</Text></View>
            <Text style={styles.name}>Dev</Text>
            <Text style={styles.since}>with Z since june</Text>
          </View>

          {/* WHAT Z REMEMBERS — the heart */}
          <View style={styles.memHead}>
            <Text style={styles.memTitle}>what Z remembers</Text>
            <Text style={styles.memSub}>everything here is yours to keep — or to make me forget.</Text>
          </View>

          {(facts.length > 0 || notes.length > 0) ? (
            <>
              {facts.length > 0 && <Text style={styles.sectionLabel}>what i know about you</Text>}
              {facts.map((f) => <MemoryCard key={f.id} item={f} isFact onForget={forgetFact} />)}

              {notes.length > 0 && <Text style={[styles.sectionLabel, { marginTop: 20 }]}>moments i noticed</Text>}
              {notes.map((n) => <MemoryCard key={n.id} item={n} isFact={false} onForget={forgetNote} />)}
            </>
          ) : (
            <Text style={styles.empty}>nothing yet. the more we talk, the more i'll remember.</Text>
          )}

          {/* settings, quiet at the bottom */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>settings</Text>
          {['your name & photo', 'notifications', 'privacy & data', 'sign out'].map((s) => (
            <Pressable key={s} style={styles.settingRow}>
              <Text style={[styles.settingText, s === 'sign out' && { color: '#E0A0A0' }]}>{s}</Text>
              <Text style={styles.settingChev}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  topTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },

  identity: { alignItems: 'center', paddingTop: 10, paddingBottom: 24 },
  bigAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(243,168,95,0.4)', backgroundColor: 'rgba(243,168,95,0.08)' },
  bigInitial: { fontFamily: FONTS.display, color: C.accent, fontSize: 36 },
  name: { fontFamily: FONTS.display, color: C.cream, fontSize: 26, marginTop: 12 },
  since: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 13, marginTop: 3 },

  memHead: { paddingHorizontal: 24, marginBottom: 14 },
  memTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 22 },
  memSub: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 13.5, marginTop: 5, lineHeight: 20 },

  sectionLabel: { fontFamily: FONTS.semibold, color: C.accentSoft, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 },

  card: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 8, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' },
  cardText: { flex: 1, fontFamily: FONTS.body, color: '#E8DCCE', fontSize: 14.5, lineHeight: 21 },
  cardKey: { fontFamily: FONTS.semibold, color: C.accentSoft, textTransform: 'lowercase' },
  forget: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 0.5, paddingLeft: 12, paddingTop: 2 },

  empty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 15, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 30, lineHeight: 23 },

  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingText: { fontFamily: FONTS.body, color: C.cream, fontSize: 15 },
  settingChev: { color: C.faint, fontSize: 20 },
});
