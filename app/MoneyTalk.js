// [zip54e] identity: old brass on warm ink — the accountant's lamp at night,
// the one room in the house where the numbers sit still and tell the truth.
// ════════════════════════════════════════════════════════════════════════
//  yourZ — MONEY TALK (the Money Man's front door; the money file)
//  Every roomed resident rides a structured record: this is his — the file on
//  your money. THE PICTURE (a one-glance summary) · THE FILE (savings, invested,
//  budget, goals, holdings, risk) · RUN MY MONTH (his audit, one tap, auto-sent).
//  He reads this file on every turn and never asks for what is written here.
//  He informs — facts and tradeoffs; the decisions stay yours, always.
//  Pure client: rides GET/POST /money/file + the persona deep-link opener.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMoneyFile, saveMoneyFile } from './api';
import { FONTS } from './theme';

const BRASS = '#C9A86A';
const B = {
  ground: '#0B0A07',
  raise: 'rgba(201,168,106,0.06)',
  hair: 'rgba(201,168,106,0.16)',
  ink: '#F0EADD',
  mist: 'rgba(240,234,221,0.55)',
  faint: 'rgba(240,234,221,0.30)',
};

const RISKS = [
  { id: 'conservative', label: 'conservative' },
  { id: 'balanced', label: 'balanced' },
  { id: 'aggressive', label: 'aggressive' },
];


// [zip54f] module-scope inputs — the inline defs remounted the TextInput per keystroke.
function Stat({ label, value }) {
  return (
    <View style={st.stat}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statVal} numberOfLines={1}>{value || '\u2014'}</Text>
    </View>
  );
}
function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={value || ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={B.faint}
        multiline={!!multiline}
      />
    </View>
  );
}

export default function MoneyTalk({ onBack = () => {}, onRun = () => {}, onChat = () => {} }) {
  const [file, setFile] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    getMoneyFile().then((r) => { if (r?.file) setFile(r.file); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const set = (k) => (v) => setFile((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await saveMoneyFile(file); setSavedAt(Date.now()); } catch (e) {}
    setSaving(false);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Money talk</Text>
          <Text style={st.sub}>the Money Man's file on your money</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!loaded ? (
          <Text style={st.loading}>opening the file…</Text>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {/* THE PICTURE */}
            <View style={st.statRow}>
              <Stat label="savings" value={file.savings} />
              <Stat label="invested" value={file.invested} />
              <Stat label="monthly budget" value={file.monthly_budget} />
            </View>

            <Text style={st.note}>write it the way you'd say it — any currency, any shorthand. he reads this file before every word he says to you, and never asks for what's already here.</Text>

            {/* THE FILE */}
            <Field label="savings" value={file.savings} onChange={set('savings')} placeholder="what's parked, and where" />
            <Field label="invested" value={file.invested} onChange={set('invested')} placeholder="what's deployed, roughly" />
            <Field label="monthly budget" value={file.monthly_budget} onChange={set('monthly_budget')} placeholder="what a normal month costs you" />
            <Field label="goals" value={file.goals} onChange={set('goals')} placeholder="one per line — the thing, the number, the when" multiline />
            <Field label="holdings / watchlist" value={file.holdings} onChange={set('holdings')} placeholder="what you own or track" multiline />
            <View style={st.field}>
              <Text style={st.label}>risk appetite</Text>
              <View style={st.chipRow}>
                {RISKS.map((o) => (
                  <Pressable key={o.id} onPress={() => set('risk')(file.risk === o.id ? '' : o.id)}
                    style={[st.chip, file.risk === o.id && st.chipOn]}>
                    <Text style={[st.chipTxt, file.risk === o.id && st.chipTxtOn]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Field label="standing notes" value={file.notes} onChange={set('notes')} placeholder="anything else he should carry" multiline />

            <Pressable onPress={save} style={[st.cta, saving && { opacity: 0.6 }]}>
              <Text style={st.ctaTxt}>{saving ? 'filing…' : savedAt ? 'filed ✓ — update the file' : 'file it'}</Text>
            </Pressable>
            <Pressable onPress={() => onRun('run my month — audit where I stand against the file, straight.')} style={st.run}>
              <Text style={st.runTxt}>run my month →</Text>
            </Pressable>
            <Pressable onPress={onChat} style={st.ghost}>
              <Text style={st.ghostTxt}>talk money →</Text>
            </Pressable>

            <Text style={st.footer}>he's not a licensed advisor. facts and tradeoffs from your file — the decisions stay yours.</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: B.ground },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 12 },
  back: { color: B.ink, fontSize: 30, fontFamily: FONTS.light, marginTop: -4 },
  title: { color: B.ink, fontSize: 19, fontFamily: FONTS.semi, letterSpacing: 0.2 },
  sub: { color: B.mist, fontSize: 12, fontFamily: FONTS.light, marginTop: 1 },
  loading: { color: B.mist, fontFamily: FONTS.light, fontSize: 13, padding: 24 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: B.raise, borderWidth: 1, borderColor: B.hair, borderRadius: 12, padding: 10 },
  statLabel: { color: B.faint, fontSize: 10.5, fontFamily: FONTS.light, letterSpacing: 0.4, textTransform: 'lowercase' },
  statVal: { color: BRASS, fontSize: 14, fontFamily: FONTS.semi, marginTop: 3 },
  note: { color: B.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18, marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { color: B.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginBottom: 6, textTransform: 'lowercase' },
  input: { backgroundColor: B.raise, borderWidth: 1, borderColor: B.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: B.ink, fontFamily: FONTS.light, fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: B.hair, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: B.raise },
  chipOn: { backgroundColor: BRASS, borderColor: BRASS },
  chipTxt: { color: B.mist, fontFamily: FONTS.light, fontSize: 13 },
  chipTxtOn: { color: '#171204', fontFamily: FONTS.semi },
  cta: { marginTop: 8, backgroundColor: BRASS, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaTxt: { color: '#171204', fontFamily: FONTS.semi, fontSize: 14.5, letterSpacing: 0.3 },
  run: { marginTop: 10, borderWidth: 1.5, borderColor: BRASS, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  runTxt: { color: BRASS, fontFamily: FONTS.semi, fontSize: 13.5 },
  ghost: { marginTop: 10, borderWidth: 1, borderColor: B.hair, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ghostTxt: { color: B.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
  footer: { color: B.faint, fontSize: 11, fontFamily: FONTS.light, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
