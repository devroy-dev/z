// ════════════════════════════════════════════════════════════════════════
//  yourZ — YOU (profile). Lives inside the Desk. Its HEART is "what Z
//  remembers": the facts Z knows + the moments Z noticed — each with a
//  "forget" button. Deep memory + your control over it = the trust contract.
//  Also: your name/DP, pinned people, settings.
// ════════════════════════════════════════════════════════════════════════
import * as Updates from 'expo-updates';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { C, FONTS } from './theme';
import { getLedger, getMemory, forgetMemory } from './api';

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

export default function You({ onBack = () => {}, onLogout = () => {} }) {
  const [showLedger, setShowLedger] = React.useState(false);
  // ── the update lever: no more guessing which bundle the device runs ──
  const [updState, setUpdState] = React.useState(null);
  const checkUpdates = async () => {
    setUpdState('checking…');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        setUpdState('downloading…');
        await Updates.fetchUpdateAsync();
        setUpdState('restarting…');
        await Updates.reloadAsync();
      } else setUpdState('up to date ✓');
    } catch (e) { setUpdState('check failed — try again'); }
  };
  const [ledger, setLedger] = React.useState(null);
  React.useEffect(() => { getLedger().then(setLedger).catch(() => {}); }, []);
  const [facts, setFacts] = useState([]);
  const [notes, setNotes] = useState([]);
  React.useEffect(() => {
    getMemory().then((items) => {
      setFacts(items.filter((m) => m.kind !== 'note').map((m) => ({ id: m.id, key: m.key, value: m.value })));
      setNotes(items.filter((m) => m.kind === 'note').map((m) => ({ id: m.id, body: m.value })));
    });
  }, []);
  const forgetFact = (id) => { forgetMemory(id); setTimeout(() => setFacts((f) => f.filter((x) => x.id !== id)), 220); };
  const forgetNote = (id) => { forgetMemory(id); setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 220); };

  if (showLedger) return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={() => setShowLedger(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>the ledger</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>
          {(!ledger || !ledger.feed || ledger.feed.length === 0) ? (
            <Text style={styles.ledgerEmpty}>nothing on the record yet. win a scene or take a match — it lands here.</Text>
          ) : ledger.feed.slice(0, 60).map((e, i) => (
            <View key={i} style={styles.ledgerRow}>
              <Text style={[styles.ledgerOutcome, { color: e.outcome === 'win' ? '#8FD98F' : e.outcome === 'loss' ? '#F0708C' : 'rgba(232,236,244,0.5)' }]}>
                {e.outcome === 'win' ? 'W' : e.outcome === 'loss' ? 'L' : '–'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle}>
                  {e.kind === 'stage' ? `${(e.title || 'a scene').replace(/_/g, ' ')} · the stage` : `${e.title}${e.persona ? ` vs ${String(e.persona).replace(/^the_/, 'the ').replace(/_/g, ' ')}` : ''}${e.you != null ? ` · ${e.you}–${e.z}` : ''}`}
                </Text>
                {e.kind === 'stage' && e.notes ? <Text style={styles.ledgerNotes} numberOfLines={3}>“{e.notes}”</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
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

          {/* the ledger: its own room now */}
          <Pressable style={[styles.settingRow, { marginTop: 4 }]} onPress={() => setShowLedger(true)}>
            <View>
              <Text style={styles.settingText}>the ledger</Text>
              <Text style={styles.ledgerSub}>every judged moment — scenes, matches, verdicts</Text>
            </View>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>

          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>what z remembers</Text>
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
          <Pressable style={styles.settingRow} onPress={checkUpdates}>
            <Text style={styles.settingText}>{updState || 'check for updates'}</Text>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>
          <Text style={{ fontFamily: 'Figtree_300Light', color: 'rgba(232,236,244,0.32)', fontSize: 10.5, marginHorizontal: 20, marginTop: -8, paddingBottom: 10 }}>
            {Updates.createdAt ? 'updated ' + new Date(Updates.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + new Date(Updates.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : 'built-in bundle'}{Updates.updateId ? '  ·  ' + Updates.updateId.slice(0, 8) : ''}
          </Text>
          {['your name & photo', 'notifications', 'privacy & data', 'sign out'].map((s) => (
            <Pressable key={s} style={styles.settingRow} onPress={s === 'sign out' ? onLogout : undefined}>
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
  ledgerEmpty: { fontFamily: FONTS.light, color: 'rgba(231,215,199,0.45)', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  ledgerRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  ledgerOutcome: { fontFamily: FONTS.display, fontSize: 16, width: 18, textAlign: 'center', marginTop: 1 },
  ledgerTitle: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.88)', fontSize: 13.5 },
  ledgerNotes: { fontFamily: FONTS.displayItalic, color: 'rgba(231,215,199,0.55)', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  root: { flex: 1, backgroundColor: '#090C12' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  chev: { color: 'rgba(232,236,244,0.55)', fontSize: 30, width: 26, marginTop: -3 },
  topTitle: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 20 },

  identity: { alignItems: 'center', paddingTop: 10, paddingBottom: 24 },
  bigAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(159,194,232,0.4)', backgroundColor: 'rgba(159,194,232,0.07)' },
  bigInitial: { fontFamily: FONTS.display, color: '#9FC2E8', fontSize: 36 },
  name: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 26, marginTop: 12 },
  since: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.4)', fontSize: 12.5, marginTop: 3 },

  memHead: { paddingHorizontal: 24, marginBottom: 14 },
  memTitle: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 22 },
  memSub: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.5)', fontSize: 13, marginTop: 5, lineHeight: 19 },

  sectionLabel: { fontFamily: FONTS.semibold, color: 'rgba(159,194,232,0.8)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 },

  card: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 8, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' },
  cardText: { flex: 1, fontFamily: FONTS.body, color: '#E8DCCE', fontSize: 14.5, lineHeight: 21 },
  cardKey: { fontFamily: FONTS.semibold, color: C.accentSoft, textTransform: 'lowercase' },
  forget: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 0.5, paddingLeft: 12, paddingTop: 2 },

  empty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 15, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 30, lineHeight: 23 },

  ledgerSub: { fontFamily: FONTS.light, color: 'rgba(232,236,244,0.4)', fontSize: 11.5, marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingText: { fontFamily: FONTS.body, color: '#E8ECF4', fontSize: 14.5 },
  settingChev: { color: C.faint, fontSize: 20 },
});
