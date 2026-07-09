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
import { getMmBrief, saveMmBrief, getMmAnalytics, uploadMmAnalytics, getMmDeskNotes,
  getMmTasks, toggleMmTask, getMmIdeas, draftMmIdea, markMmIdeaPosted } from './api';
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
// [0056] this week's instruction — the note stopped being advice-only; it's a task now.
function TaskRow({ task, onToggle }) {
  const done = task.status === 'done';
  return (
    <Pressable onPress={() => onToggle(task)} style={st.taskRow} hitSlop={6}>
      <View style={[st.check, done && st.checkOn]}>{done ? <Text style={st.checkMark}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={st.taskKicker}>this week</Text>
        <Text style={[st.taskTxt, done && st.taskTxtDone]}>{task.instruction}</Text>
      </View>
    </Pressable>
  );
}
// [0056] a filed idea moving down the pipeline: idea → drafted → posted.
function IdeaCard({ idea, onDraft, onPosted, busy }) {
  return (
    <View style={st.ideaCard}>
      <View style={st.ideaHead}>
        <Text style={st.ideaTitle}>{idea.title}</Text>
        {idea.format ? <Text style={st.ideaFormat}>{idea.format}</Text> : null}
      </View>
      {idea.hook ? <Text style={st.ideaHook}>{idea.hook}</Text> : null}
      {idea.status === 'idea' ? (
        <Pressable onPress={() => onDraft(idea)} style={[st.ideaBtn, busy && { opacity: 0.6 }]} disabled={busy}>
          <Text style={st.ideaBtnTxt}>{busy ? 'he\u2019s writing it…' : 'draft this'}</Text>
        </Pressable>
      ) : null}
      {idea.status === 'drafted' ? (
        <View>
          {idea.draft ? <Text style={st.ideaDraft}>{idea.draft}</Text> : null}
          <Pressable onPress={() => onPosted(idea)} style={st.ideaGhostBtn} hitSlop={6}>
            <Text style={st.ideaGhostTxt}>mark posted ✓</Text>
          </Pressable>
        </View>
      ) : null}
      {idea.status === 'posted' ? <Text style={st.ideaPosted}>posted ✓</Text> : null}
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
  const [tasks, setTasks] = useState(null);
  const [ideas, setIdeas] = useState(null);
  const [draftingId, setDraftingId] = useState(null);

  const load = useCallback(() => {
    getMmDeskNotes().then((r) => setNotes(r?.notes || [])).catch(() => setNotes([]));
    getMmAnalytics().then((r) => setTimeline(r?.timeline || [])).catch(() => setTimeline([]));
    getMmBrief().then((r) => { if (r?.brief) setBrief(r.brief); }).catch(() => {});
    getMmTasks().then((r) => setTasks(r?.tasks || [])).catch(() => setTasks([]));
    getMmIdeas().then((r) => setIdeas(r?.ideas || [])).catch(() => setIdeas([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  // [0056] tick the instruction — optimistic, reconcile on failure
  const toggleTask = async (task) => {
    setTasks((ts) => (ts || []).map((t) => (t.id === task.id ? { ...t, status: t.status === 'done' ? 'open' : 'done' } : t)));
    try { await toggleMmTask(task.id); } catch (e) { load(); }
  };
  // [0056] draft this — he writes it server-side; the card flips to drafted
  const draftIdea = async (idea) => {
    if (draftingId) return;
    setDraftingId(idea.id);
    try {
      const r = await draftMmIdea(idea.id);
      if (r?.idea) setIdeas((xs) => (xs || []).map((i) => (i.id === idea.id ? r.idea : i)));
    } catch (e) {} finally { setDraftingId(null); }
  };
  const postIdea = async (idea) => {
    setIdeas((xs) => (xs || []).map((i) => (i.id === idea.id ? { ...i, status: 'posted' } : i)));
    try { await markMmIdeaPosted(idea.id); } catch (e) { load(); }
  };

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
        {tasks && tasks[0] ? <TaskRow task={tasks[0]} onToggle={toggleTask} /> : null}

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

        {/* THE PIPELINE — ideas he shapes in talk, filed and moved */}
        <Text style={st.section}>the pipeline</Text>
        {ideas === null ? null : ideas.length === 0 ? (
          <Text style={st.empty}>nothing in the pipeline yet. talk an idea through with him and it files itself here — then tap draft and he writes it from your brief and your numbers.</Text>
        ) : (
          ideas.map((i) => (
            <IdeaCard key={i.id} idea={i} busy={draftingId === i.id} onDraft={draftIdea} onPosted={postIdea} />
          ))
        )}

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
  taskRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, padding: 12, marginTop: 8 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: FLUORO, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkOn: { backgroundColor: FLUORO },
  checkMark: { color: '#191A06', fontSize: 13, fontFamily: FONTS.semi, lineHeight: 15 },
  taskKicker: { color: M.faint, fontSize: 10, fontFamily: FONTS.semi, letterSpacing: 0.4, textTransform: 'lowercase', marginBottom: 2 },
  taskTxt: { color: M.ink, fontSize: 13.5, fontFamily: FONTS.light, lineHeight: 19 },
  taskTxtDone: { color: M.mist, textDecorationLine: 'line-through' },
  ideaCard: { backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, padding: 12, marginBottom: 8 },
  ideaHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ideaTitle: { flex: 1, color: M.ink, fontSize: 14, fontFamily: FONTS.semi, lineHeight: 19 },
  ideaFormat: { color: FLUORO, fontSize: 10.5, fontFamily: FONTS.semi, textTransform: 'lowercase', borderWidth: 1, borderColor: M.hair, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  ideaHook: { color: M.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18, marginTop: 5 },
  ideaBtn: { marginTop: 10, borderWidth: 1.5, borderColor: FLUORO, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  ideaBtnTxt: { color: FLUORO, fontFamily: FONTS.semi, fontSize: 12.5 },
  ideaDraft: { color: M.ink, fontSize: 13, fontFamily: FONTS.light, lineHeight: 19, marginTop: 10, backgroundColor: M.ground, borderRadius: 8, padding: 10 },
  ideaGhostBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 6 },
  ideaGhostTxt: { color: M.mist, fontFamily: FONTS.semi, fontSize: 12 },
  ideaPosted: { color: M.faint, fontFamily: FONTS.semi, fontSize: 11.5, marginTop: 8 },
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
