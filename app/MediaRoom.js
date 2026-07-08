// [zip54l] identity: dark like the house, fluorescent yellow as the lone accent —
// the highlighter on the file. The lit-room experiment is retired; the agency
// floor above the desk carries the warmth now.
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE MEDIA MANAGER v2 (the desk that watches your career)
//  The engine came first (zip54k, curl-proven). This room is its surface:
//  THE DESK NOTE (his weekly memo greets you) · THE NUMBERS (your trajectory,
//  filed under his eye) · FILE ANALYTICS (the room's primary act: screenshot in,
//  numbers out, the brief self-updates) · THE BRIEF (folded into a drawer —
//  present, no longer the point) · his desk, one door away.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getMmBrief, saveMmBrief, getMmAnalytics, uploadMmAnalytics, getMmDeskNotes } from './api';
import { FONTS } from './theme';

const FLUORO = '#A9DDF2';   // [zip54n] the fluoro is retired — the accent is the ice of his own neon sign
const M = {
  ground: '#0C0C08',
  raise: 'rgba(215,245,60,0.05)',
  hair: 'rgba(215,245,60,0.14)',
  ink: '#EFEFE4',
  mist: 'rgba(239,239,228,0.55)',
  faint: 'rgba(239,239,228,0.30)',
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

// module scope — the keyboard law (zip54f) holds
function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        style={[st.input, multiline && { minHeight: 64, textAlignVertical: 'top' }]}
        value={value || ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={M.faint}
        multiline={!!multiline}
      />
    </View>
  );
}
function Chips({ label, value, onChange, options }) {
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <View style={st.chipRow}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => onChange(value === o.id ? '' : o.id)}
            style={[st.chip, value === o.id && st.chipOn]}>
            <Text style={[st.chipTxt, value === o.id && st.chipTxtOn]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
function NumberRow({ r }) {
  const bits = [r.followers && `${r.followers} followers`, r.reach && `reach ${r.reach}`, r.growth].filter(Boolean).join('  ·  ');
  return (
    <View style={st.numRow}>
      <View style={{ flex: 1 }}>
        <Text style={st.numPlatform}>{r.platform || 'platform'}{r.period ? `  —  ${r.period}` : ''}</Text>
        <Text style={st.numBits}>{bits || 'filed'}</Text>
        {r.top_content ? <Text style={st.numTop} numberOfLines={1}>top: {r.top_content}</Text> : null}
      </View>
    </View>
  );
}

export default function MediaRoom({ onBack = () => {}, onChat = () => {} }) {
  const [brief, setBrief] = useState({});
  const [notes, setNotes] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [filing, setFiling] = useState(false);
  const [fileErr, setFileErr] = useState('');

  const load = useCallback(() => {
    getMmDeskNotes().then((r) => setNotes(r?.notes || [])).catch(() => setNotes([]));
    getMmAnalytics().then((r) => setTimeline(r?.timeline || [])).catch(() => setTimeline([]));
    getMmBrief().then((r) => { if (r?.brief) setBrief(r.brief); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const set = (k) => (v) => setBrief((b) => ({ ...b, [k]: v }));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try { await saveMmBrief(brief); setSavedAt(Date.now()); } catch (e) {}
    setSaving(false);
  };

  const fileAnalytics = async () => {
    if (filing) return;
    setFileErr('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, quality: 0.6, base64: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      setFiling(true);
      await uploadMmAnalytics({ media_type: 'image/jpeg', data: res.assets[0].base64 });
      load();
    } catch (e) {
      setFileErr("couldn't read that screenshot — a clearer one (full insights screen, no crop) files best.");
    } finally { setFiling(false); }
  };

  const latest = notes && notes[0];

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>the Media Manager</Text>
          <Text style={st.sub}>the desk that watches your career</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: 'https://callmez.app/rooms/media-hub.jpg?v=1' }} style={st.hero} resizeMode="cover" />

        {/* THE DESK NOTE */}
        <Text style={st.section}>the desk note</Text>
        {notes === null ? (
          <ActivityIndicator color={FLUORO} style={{ marginVertical: 16 }} />
        ) : latest ? (
          <View style={st.noteCard}>
            <Text style={st.noteDate}>{new Date(latest.created_at).toDateString().toLowerCase()}</Text>
            <Text style={st.noteTxt}>{latest.note}</Text>
          </View>
        ) : (
          <Text style={st.empty}>his first memo writes itself this week — it lands here, on the desk, before your day starts.</Text>
        )}

        {/* THE NUMBERS */}
        <Text style={st.section}>the numbers</Text>
        {timeline === null ? null : timeline.length === 0 ? (
          <Text style={st.empty}>nothing filed yet. one screenshot of your insights and he carries your trajectory for good.</Text>
        ) : (
          timeline.slice(0, 6).map((r) => <NumberRow key={r.id} r={r} />)
        )}

        <Pressable onPress={fileAnalytics} style={[st.cta, filing && { opacity: 0.6 }]}>
          <Text style={st.ctaTxt}>{filing ? 'under his eye…' : '+ file this month\u2019s analytics'}</Text>
        </Pressable>
        {fileErr ? <Text style={st.err}>{fileErr}</Text> : null}

        {/* THE BRIEF — folded away */}
        <Pressable onPress={() => setBriefOpen((v) => !v)} style={st.drawerHead}>
          <Text style={st.drawerHeadTxt}>the client brief</Text>
          <Text style={st.drawerChevron}>{briefOpen ? '▾' : '▸'}</Text>
        </Pressable>
        {briefOpen && (
          <View style={st.drawer}>
            <Field label="name / handle" value={brief.handle} onChange={set('handle')} placeholder="@yourhandle, or the name you go by" />
            <Field label="platforms" value={brief.platforms} onChange={set('platforms')} placeholder="instagram · youtube · shorts · linkedin · x" />
            <Field label="niche" value={brief.niche} onChange={set('niche')} placeholder="what your content is about, in one line" />
            <Field label="content pillars" value={brief.pillars} onChange={set('pillars')} placeholder="the 2–4 recurring themes you post on" multiline />
            <Field label="audience" value={brief.audience} onChange={set('audience')} placeholder="self-updates when you file analytics" multiline />
            <Chips label="stage" value={brief.stage} onChange={set('stage')} options={STAGES} />
            <Chips label="the goal" value={brief.goal} onChange={set('goal')} options={GOALS} />
            <Field label="active deals" value={brief.deals} onChange={set('deals')} placeholder="brands, rates, what's in the pipeline" multiline />
            <Field label="cadence" value={brief.cadence} onChange={set('cadence')} placeholder="how often you publish, per platform" />
            <Field label="standing notes" value={brief.notes} onChange={set('notes')} placeholder="anything else he should carry" multiline />
            <Pressable onPress={save} style={[st.fileBrief, saving && { opacity: 0.6 }]}>
              <Text style={st.fileBriefTxt}>{saving ? 'filing…' : savedAt ? 'filed ✓ — update the brief' : 'file the brief'}</Text>
            </Pressable>
          </View>
        )}

        <Pressable onPress={onChat} style={st.ghost}>
          <Text style={st.ghostTxt}>talk to your social Media Manager →</Text>{/* [zip63] */}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: M.ground },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 12 },
  back: { color: M.ink, fontSize: 30, fontFamily: FONTS.light, marginTop: -4 },
  title: { color: M.ink, fontSize: 19, fontFamily: FONTS.semi, letterSpacing: 0.2 },
  sub: { color: M.mist, fontSize: 12, fontFamily: FONTS.light, marginTop: 1 },
  hero: { width: '100%', height: 150, borderRadius: 14, marginBottom: 6 },
  section: { color: M.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginTop: 18, marginBottom: 8, textTransform: 'lowercase' },
  empty: { color: M.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18 },
  noteCard: { backgroundColor: M.raise, borderLeftWidth: 3, borderLeftColor: FLUORO, borderRadius: 10, padding: 12 },
  noteDate: { color: M.faint, fontSize: 10.5, fontFamily: FONTS.light, marginBottom: 5 },
  noteTxt: { color: M.ink, fontSize: 13.5, fontFamily: FONTS.light, lineHeight: 20 },
  numRow: { backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, padding: 11, marginBottom: 7 },
  numPlatform: { color: FLUORO, fontSize: 11.5, fontFamily: FONTS.semi, textTransform: 'lowercase' },
  numBits: { color: M.ink, fontSize: 13.5, fontFamily: FONTS.light, marginTop: 3 },
  numTop: { color: M.mist, fontSize: 11.5, fontFamily: FONTS.light, marginTop: 3 },
  cta: { marginTop: 10, backgroundColor: FLUORO, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaTxt: { color: '#191A06', fontFamily: FONTS.semi, fontSize: 14.5, letterSpacing: 0.3 },
  err: { color: '#E8A9A9', fontSize: 12, fontFamily: FONTS.light, marginTop: 8, lineHeight: 17 },
  drawerHead: { marginTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: M.hair, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  drawerHeadTxt: { color: M.ink, fontFamily: FONTS.semi, fontSize: 13.5, textTransform: 'lowercase' },
  drawerChevron: { color: M.mist, fontSize: 13 },
  drawer: { marginTop: 10 },
  field: { marginBottom: 14 },
  label: { color: M.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginBottom: 6, textTransform: 'lowercase' },
  input: { backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: M.ink, fontFamily: FONTS.light, fontSize: 14 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { borderWidth: 1, borderColor: M.hair, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: M.raise },
  chipOn: { backgroundColor: FLUORO, borderColor: FLUORO },
  chipTxt: { color: M.mist, fontFamily: FONTS.light, fontSize: 13 },
  chipTxtOn: { color: '#191A06', fontFamily: FONTS.semi },
  fileBrief: { marginTop: 4, borderWidth: 1.5, borderColor: FLUORO, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  fileBriefTxt: { color: FLUORO, fontFamily: FONTS.semi, fontSize: 13.5 },
  ghost: { marginTop: 12, borderWidth: 1, borderColor: M.hair, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  ghostTxt: { color: M.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
});
