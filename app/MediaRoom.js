// [zip54d] identity: extremely dirty white + light fluorescent yellow — the only
// lit room in the house: the agency floor at noon, paper that has been worked.
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE MEDIA MANAGER (his front door; the client brief)
//  Every pinned institutional resident has a room: the anchor's newsroom, the
//  GM's forge, the coach's study, the interviewer's panel. This is his — the
//  desk where the client's file sits open. STRUCTURED brief (handle · platforms
//  · niche · pillars · audience · stage · goal · deals · cadence), because these
//  fields are the rails his counsel rides: he reads this file on every turn and
//  never asks for what is already written here. Records, not prose.
//  Pure client: rides GET/POST /mm/brief + the persona deep-link opener.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMmBrief, saveMmBrief } from './api';
import { FONTS } from './theme';

const FLUORO = '#D7F53C';   // light fluorescent yellow — the highlighter on the file
const M = {
  ground: '#8B877B',                    // extremely dirty white — paper that has lived
  raise: 'rgba(23,22,16,0.06)',
  hair: 'rgba(23,22,16,0.18)',
  ink: '#191811',                       // dark ink on the lit ground (the inverted room)
  mist: 'rgba(25,24,17,0.60)',
  faint: 'rgba(25,24,17,0.35)',
};

const STAGES = [
  { id: 'starting', label: 'just starting' },
  { id: 'growing', label: 'growing' },
  { id: 'established', label: 'established' },
];
const GOALS = [
  { id: 'money', label: 'money' },
  { id: 'growth', label: 'growth' },
  { id: 'authority', label: 'authority' },
];

export default function MediaRoom({ onBack = () => {}, onChat = () => {} }) {
  const [brief, setBrief] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    getMmBrief().then((r) => { if (r?.brief) setBrief(r.brief); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const set = (k) => (v) => setBrief((b) => ({ ...b, [k]: v }));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await saveMmBrief(brief); setSavedAt(Date.now()); } catch (e) {}
    setSaving(false);
  };

  const Field = ({ label, k, placeholder, multiline }) => (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={brief[k] || ''}
        onChangeText={set(k)}
        placeholder={placeholder}
        placeholderTextColor={M.faint}
        multiline={!!multiline}
      />
    </View>
  );

  const Chips = ({ label, k, options }) => (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <View style={st.chipRow}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => set(k)(brief[k] === o.id ? '' : o.id)}
            style={[st.chip, brief[k] === o.id && st.chipOn]}>
            <Text style={[st.chipTxt, brief[k] === o.id && st.chipTxtOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>the Media Manager</Text>
          <Text style={st.sub}>the client brief — your file on his desk</Text>
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!loaded ? (
          <Text style={st.loading}>opening the file…</Text>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={st.note}>fill what you have. he reads this file before every word he says to you — and never asks for what is already written here. leave a line empty and he treats it as a gap in his notes, to fill in its own time.</Text>

            <Field label="name / handle" k="handle" placeholder="@yourhandle, or the name you go by" />
            <Field label="platforms" k="platforms" placeholder="instagram · youtube · shorts · linkedin · x" />
            <Field label="niche" k="niche" placeholder="what your content is about, in one line" />
            <Field label="content pillars" k="pillars" placeholder="the 2–4 recurring themes you post on" multiline />
            <Field label="audience" k="audience" placeholder="size per platform, who they are" multiline />
            <Chips label="stage" k="stage" options={STAGES} />
            <Chips label="the goal" k="goal" options={GOALS} />
            <Field label="active deals" k="deals" placeholder="brands, rates, what's in the pipeline" multiline />
            <Field label="cadence" k="cadence" placeholder="how often you publish, per platform" />
            <Field label="standing notes" k="notes" placeholder="anything else he should carry" multiline />

            <Pressable onPress={save} style={[st.cta, saving && { opacity: 0.6 }]}>
              <Text style={st.ctaTxt}>{saving ? 'filing…' : savedAt ? 'filed ✓ — update the brief' : 'file the brief'}</Text>
            </Pressable>
            <Pressable onPress={onChat} style={st.ghost}>
              <Text style={st.ghostTxt}>take it to his desk →</Text>
            </Pressable>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: M.ground },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 12 },
  back: { color: M.ink, fontSize: 30, fontFamily: FONTS.light, marginTop: -4 },
  title: { color: M.ink, fontSize: 19, fontFamily: FONTS.semi, letterSpacing: 0.2 },
  sub: { color: M.mist, fontSize: 12, fontFamily: FONTS.light, marginTop: 1 },
  loading: { color: M.mist, fontFamily: FONTS.light, fontSize: 13, padding: 24 },
  note: { color: M.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18, marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { color: M.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginBottom: 6, textTransform: 'lowercase' },
  input: { backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: M.ink, fontFamily: FONTS.light, fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: M.hair, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: M.raise },
  chipOn: { backgroundColor: FLUORO, borderColor: FLUORO },
  chipTxt: { color: M.mist, fontFamily: FONTS.light, fontSize: 13 },
  chipTxtOn: { color: '#191811', fontFamily: FONTS.semi },
  cta: { marginTop: 8, backgroundColor: FLUORO, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaTxt: { color: '#191811', fontFamily: FONTS.semi, fontSize: 14.5, letterSpacing: 0.3 },
  ghost: { marginTop: 10, borderWidth: 1, borderColor: M.hair, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ghostTxt: { color: M.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
});
