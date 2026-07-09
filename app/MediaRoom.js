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
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';   // [fixes-A X4] the deliverable is extractable
import { getMmBrief, saveMmBrief, getMmAnalytics, uploadMmAnalytics, getMmDeskNotes,
  getMmTasks, toggleMmTask, getMmIdeas, draftMmIdea, markMmIdeaPosted, addMmAnalyticsManual, getMmRateCard,
  updateMmAnalytics, deleteMmAnalytics, refreshMmDeskNote } from './api';
import { FONTS } from './theme';

// [fixes-A X2] a fetch that FAILED is not a fetch that's EMPTY — this sentinel
// lets the render tell the two apart and speak one quiet line in his voice.
const ERR = '__err';

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

// [fixes-A X2] failure becomes a visible, muted, in-voice line — never a red
// banner, never an alert. Tapping it (or pulling to refresh) tries again.
function QuietError({ line, onRetry }) {
  return (
    <Pressable onPress={onRetry} style={st.quietErr} hitSlop={6}>
      <Text style={st.quietErrTxt}>{line}</Text>
    </Pressable>
  );
}

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
function NumberRow({ r, onEdit, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const bits = [r.followers && `${r.followers} followers`, r.reach && `reach ${r.reach}`, r.growth].filter(Boolean).join('  ·  ');
  const tapX = () => { if (confirm) { onDelete(r); return; } setConfirm(true); setTimeout(() => setConfirm(false), 2500); };
  return (
    <View style={st.numRow}>
      <Pressable style={{ flex: 1 }} onPress={() => onEdit(r)}>
        <Text style={st.numPlatform}>{r.platform || 'platform'}{r.period ? `  —  ${r.period}` : ''}</Text>
        <Text style={st.numBits}>{bits || 'filed'}</Text>
        {r.top_content ? <Text style={st.numTop} numberOfLines={1}>top: {r.top_content}</Text> : null}
      </Pressable>
      <Pressable onPress={tapX} hitSlop={8} style={[st.numX, confirm && st.numXConfirm]}>
        <Text style={[st.numXTxt, confirm && st.numXTxtConfirm]}>{confirm ? 'delete?' : '✕'}</Text>
      </Pressable>
    </View>
  );
}
// [0056] the filed instruction — the note stopped being advice-only; it's a task now.
// [fixes-2 BUG-2] the kicker tells the truth of week_of: this week / last week / the date —
// last week's ungraded work never masquerades as fresh.
function taskKicker(weekOf) {
  const w = String(weekOf || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w)) return 'on the file';
  const istNow = new Date(Date.now() + 5.5 * 3600 * 1000);
  const monday = (d) => { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); return x.toISOString().slice(0, 10); };
  const thisMon = monday(istNow);
  const lastMon = monday(new Date(istNow.getTime() - 7 * 86400 * 1000));
  if (w >= thisMon) return 'this week';
  if (w >= lastMon) return 'last week';
  const d = new Date(w + 'T00:00:00Z');
  return isNaN(d.getTime()) ? 'on the file' : d.toDateString().toLowerCase().replace(/^\w+ /, '');
}
function TaskRow({ task, onToggle }) {
  const done = task.status === 'done';
  return (
    <Pressable onPress={() => onToggle(task)} style={st.taskRow} hitSlop={6}>
      <View style={[st.check, done && st.checkOn]}>{done ? <Text style={st.checkMark}>✓</Text> : null}</View>
      <View style={{ flex: 1 }}>
        <Text style={st.taskKicker}>{taskKicker(task.week_of)}</Text>
        <Text style={[st.taskTxt, done && st.taskTxtDone]}>{task.instruction}</Text>
      </View>
    </Pressable>
  );
}
// [0056] a filed idea moving down the pipeline: idea → drafted → posted.
function IdeaCard({ idea, onDraft, onPosted, busy }) {
  const [copied, setCopied] = useState(false);
  // [fixes-A X4] copy the caption he wrote — the whole point is to paste it where you post
  const copy = async () => {
    try { await Clipboard.setStringAsync(String(idea.draft || '')); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch (e) {}
  };
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
          {idea.draft ? (
            <Pressable onPress={copy} style={st.ideaCopyBtn} hitSlop={6}>
              <Text style={st.ideaCopyTxt}>{copied ? 'copied \u2713' : 'copy \u2702'}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => onPosted(idea)} style={st.ideaGhostBtn} hitSlop={6}>
            <Text style={st.ideaGhostTxt}>mark posted ✓</Text>
          </Pressable>
        </View>
      ) : null}
      {idea.status === 'posted' ? <Text style={st.ideaPosted}>posted ✓</Text> : null}
    </View>
  );
}

export default function MediaRoom({ onBack = () => {}, onChat = () => {}, onAsk = () => {} }) {
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
  const [refreshing, setRefreshing] = useState(false);   // [fixes-A X1] pull-to-refresh
  // [§5.4] manual numbers + the deal desk
  const [rate, setRate] = useState({ cards: [], pitch: '' });
  const [manualOpen, setManualOpen] = useState(false);
  const [mForm, setMForm] = useState({ platform: '', followers: '', reach: '', period: '' });
  const [savingManual, setSavingManual] = useState(false);
  const [editId, setEditId] = useState(null);            // [fixes-B MM-A] correcting a filed number
  const [refreshingNote, setRefreshingNote] = useState(false);   // [fixes-B MM-B] the ↻
  const [noteLine, setNoteLine] = useState('');          // [fixes-B MM-B] the once-a-day honest line

  // [fixes-A X1/X2] load returns a promise so pull-to-refresh can await it;
  // the sections that carry his written work fall to ERR (not []) on failure.
  const load = useCallback(() => Promise.all([
    getMmDeskNotes().then((r) => setNotes(r?.notes || [])).catch(() => setNotes(ERR)),
    getMmAnalytics().then((r) => setTimeline(r?.timeline || [])).catch(() => setTimeline(ERR)),
    getMmBrief().then((r) => { if (r?.brief) setBrief(r.brief); }).catch(() => {}),
    getMmTasks().then((r) => setTasks(r?.tasks || [])).catch(() => setTasks([])),
    getMmIdeas().then((r) => setIdeas(r?.ideas || [])).catch(() => setIdeas(ERR)),
    getMmRateCard().then(setRate).catch(() => {}),
  ]), []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }, [load]);

  const saveManual = async () => {
    if (savingManual) return;
    if (!mForm.platform.trim() || (!mForm.followers.trim() && !mForm.reach.trim())) return;
    setSavingManual(true);
    try {
      if (editId) await updateMmAnalytics(editId, mForm);   // [fixes-B MM-A] correction (update-in-place)
      else await addMmAnalyticsManual(mForm);
      setMForm({ platform: '', followers: '', reach: '', period: '' }); setManualOpen(false); setEditId(null); load();
    } catch (e) {} finally { setSavingManual(false); }
  };
  // [fixes-B MM-A] tap a filed number to correct it — prefill the manual form
  const editNumber = (r) => {
    setMForm({ platform: r.platform || '', followers: r.followers || '', reach: r.reach || '', period: r.period || '' });
    setEditId(r.id); setManualOpen(true);
  };
  const deleteNumber = async (r) => {
    setTimeline((cur) => (Array.isArray(cur) ? cur.filter((x) => x.id !== r.id) : cur));
    if (editId === r.id) { setEditId(null); setManualOpen(false); }
    try { await deleteMmAnalytics(r.id); } catch (e) { load(); }
  };
  const toggleManual = () => {
    if (manualOpen) { setEditId(null); setMForm({ platform: '', followers: '', reach: '', period: '' }); }
    setManualOpen((v) => !v);
  };
  // [fixes-B MM-B] the desk note ↻ — once-a-day gate speaks its honest line
  const refreshNote = async () => {
    if (refreshingNote) return;
    setRefreshingNote(true); setNoteLine('');
    try {
      const r = await refreshMmDeskNote();
      if (r.already) setNoteLine(r.line);
      else if (r.notes) setNotes(r.notes);
    } catch (e) { setNoteLine('couldn\u2019t refresh just now — try again in a bit.'); }
    finally { setRefreshingNote(false); }
  };

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

  const latest = Array.isArray(notes) && notes[0];

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={FLUORO} />}>
        <Image source={{ uri: 'https://callmez.app/rooms/media-hub.jpg?v=1' }} style={st.hero} resizeMode="cover" />

        {/* THE DESK NOTE */}
        <View style={st.noteHead}>
          <Text style={[st.section, { marginTop: 0 }]}>the desk note</Text>
          <Pressable onPress={refreshNote} disabled={refreshingNote} hitSlop={10} style={st.noteRefresh}>
            <Text style={st.noteRefreshTxt}>{refreshingNote ? '…' : '↻'}</Text>
          </Pressable>
        </View>
        {notes === null ? (
          <ActivityIndicator color={FLUORO} style={{ marginVertical: 16 }} />
        ) : notes === ERR ? (
          <QuietError line={'couldn\u2019t reach the desk \u2014 pull to refresh'} onRetry={onRefresh} />
        ) : latest ? (
          <View style={st.noteCard}>
            <Text style={st.noteDate}>{new Date(latest.created_at).toDateString().toLowerCase()}</Text>
            <Text style={st.noteTxt}>{latest.note}</Text>
          </View>
        ) : (
          <Text style={st.empty}>his first memo writes itself this week — it lands here, on the desk, before your day starts.</Text>
        )}
        {noteLine ? <Text style={st.noteLine}>{noteLine}</Text> : null}
        {/* [fixes-B M3] the WEEK's commitments, not just tasks[0] — open ones + this-week's done (struck) */}
        {(() => {
          if (tasks === null) return null;
          const arr = Array.isArray(tasks) ? tasks : [];
          const weekAgo = new Date(Date.now() + 5.5 * 3600 * 1000 - 8 * 86400 * 1000).toISOString().slice(0, 10);
          const shown = [
            ...arr.filter((t) => t.status === 'open'),
            ...arr.filter((t) => t.status === 'done' && String(t.week_of || '') >= weekAgo),
          ];
          if (!shown.length) return <Text style={st.tasksEmpty}>no commitments on the desk this week — lock one with him and it lands here.</Text>;
          return shown.map((t) => <TaskRow key={t.id} task={t} onToggle={toggleTask} />);
        })()}

        {/* THE NUMBERS */}
        <Text style={st.section}>the numbers</Text>
        {timeline === null ? null : timeline === ERR ? (
          <QuietError line={'couldn\u2019t reach the desk \u2014 pull to refresh'} onRetry={onRefresh} />
        ) : timeline.length === 0 ? (
          <Text style={st.empty}>nothing filed yet. one screenshot of your insights and he carries your trajectory for good.</Text>
        ) : (
          timeline.slice(0, 6).map((r) => <NumberRow key={r.id} r={r} onEdit={editNumber} onDelete={deleteNumber} />)
        )}

        <Pressable onPress={fileAnalytics} style={[st.cta, filing && { opacity: 0.6 }]}>
          <Text style={st.ctaTxt}>{filing ? 'under his eye…' : '+ file this month\u2019s analytics'}</Text>
        </Pressable>
        {fileErr ? <Text style={st.err}>{fileErr}</Text> : null}
        {/* [§5.4] or type the numbers by hand — screenshots stay primary */}
        <Pressable onPress={toggleManual}><Text style={st.manualToggle}>{manualOpen ? (editId ? '– cancel correction' : '– type them instead') : 'or type them instead ›'}</Text></Pressable>
        {manualOpen ? (
          <View style={st.manualBox}>
            <View style={st.manualRow}>
              <TextInput style={st.manualInput} value={mForm.platform} onChangeText={(v) => setMForm((f) => ({ ...f, platform: v }))} placeholder="platform (instagram)" placeholderTextColor={M.faint} />
              <TextInput style={st.manualInput} value={mForm.period} onChangeText={(v) => setMForm((f) => ({ ...f, period: v }))} placeholder="period (this month)" placeholderTextColor={M.faint} />
            </View>
            <View style={st.manualRow}>
              <TextInput style={st.manualInput} value={mForm.followers} onChangeText={(v) => setMForm((f) => ({ ...f, followers: v }))} placeholder="followers (12.5K)" placeholderTextColor={M.faint} />
              <TextInput style={st.manualInput} value={mForm.reach} onChangeText={(v) => setMForm((f) => ({ ...f, reach: v }))} placeholder="reach (40K)" placeholderTextColor={M.faint} />
            </View>
            <Pressable onPress={saveManual} style={[st.manualSave, savingManual && { opacity: 0.6 }]}><Text style={st.manualSaveTxt}>{savingManual ? 'filing…' : editId ? 'save the correction' : 'file these numbers'}</Text></Pressable>
          </View>
        ) : null}

        {/* [§5.4] THE DEAL DESK — what you can charge, from your own ledger */}
        {rate.cards.length ? (
          <View>
            <Text style={st.section}>the deal desk</Text>
            <Text style={st.dealHint}>what you can ask per sponsored post — computed from your filed numbers.</Text>
            {rate.cards.map((c) => (
              <View key={c.platform} style={st.dealRow}>
                <Text style={st.dealPlat}>{c.platform}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={st.dealRs}>Rs {c.low.toLocaleString('en-IN')} – {c.high.toLocaleString('en-IN')}</Text>
                  <Text style={st.dealBasis}>per post · from your {c.basis}</Text>
                </View>
              </View>
            ))}
            <Pressable onPress={() => onAsk(rate.pitch)} style={st.pitchBtn}>
              <Text style={st.pitchTxt}>draft the pitch DM ›</Text>
            </Pressable>
          </View>
        ) : null}

        {/* THE PIPELINE — ideas he shapes in talk, filed and moved */}
        <Text style={st.section}>the pipeline</Text>
        {ideas === null ? null : ideas === ERR ? (
          <QuietError line={'couldn\u2019t reach the desk \u2014 pull to refresh'} onRetry={onRefresh} />
        ) : ideas.length === 0 ? (
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
  noteHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  noteRefresh: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: M.hair, alignItems: 'center', justifyContent: 'center' },
  noteRefreshTxt: { color: FLUORO, fontSize: 15, fontFamily: FONTS.semi, lineHeight: 18 },
  noteLine: { color: M.mist, fontSize: 12, fontFamily: FONTS.light, lineHeight: 17, marginTop: 8 },
  tasksEmpty: { color: M.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18, marginTop: 8 },
  numX: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, borderWidth: 1, borderColor: M.hair, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  numXConfirm: { backgroundColor: 'rgba(232,169,169,0.15)', borderColor: '#E8A9A9' },
  numXTxt: { color: M.mist, fontFamily: FONTS.semi, fontSize: 12 },
  numXTxtConfirm: { color: '#E8A9A9', fontSize: 10.5 },
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
  ideaCopyBtn: { marginTop: 8, alignItems: 'center', paddingVertical: 6, borderWidth: 1, borderColor: M.hair, borderRadius: 8 },
  ideaCopyTxt: { color: FLUORO, fontFamily: FONTS.semi, fontSize: 12 },
  quietErr: { marginVertical: 12 },
  quietErrTxt: { color: M.mist, fontSize: 12.5, fontFamily: FONTS.light, lineHeight: 18 },
  ideaPosted: { color: M.faint, fontFamily: FONTS.semi, fontSize: 11.5, marginTop: 8 },
  numRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, padding: 11, marginBottom: 7 },
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
  manualToggle: { color: '#A9DDF2', fontFamily: FONTS.light, fontSize: 12, marginTop: 10, opacity: 0.85 },
  manualBox: { marginTop: 10, borderWidth: 1, borderColor: M.hair, borderRadius: 12, padding: 12, gap: 8 },
  manualRow: { flexDirection: 'row', gap: 8 },
  manualInput: { flex: 1, backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: M.ink, fontFamily: FONTS.light, fontSize: 12.5 },
  manualSave: { backgroundColor: '#A9DDF2', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginTop: 2 },
  manualSaveTxt: { color: '#0C0C08', fontFamily: FONTS.semi, fontSize: 13 },
  dealHint: { color: M.faint, fontFamily: FONTS.light, fontSize: 11.5, lineHeight: 16, marginTop: -2, marginBottom: 10 },
  dealRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: M.raise, borderWidth: 1, borderColor: M.hair, borderRadius: 10, padding: 12, marginBottom: 8 },
  dealPlat: { color: '#A9DDF2', fontFamily: FONTS.semi, fontSize: 13, width: 84, textTransform: 'lowercase' },
  dealRs: { color: M.ink, fontFamily: FONTS.semi, fontSize: 15 },
  dealBasis: { color: M.faint, fontFamily: FONTS.light, fontSize: 10.5, marginTop: 2 },
  pitchBtn: { borderWidth: 1.5, borderColor: '#A9DDF2', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 2 },
  pitchTxt: { color: '#A9DDF2', fontFamily: FONTS.semi, fontSize: 13.5 },
});
