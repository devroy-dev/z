#!/usr/bin/env python3
# apply_coach_modes.py — coach house/custom mode phase + the header-image fix.
# Run from repo root (/workspaces/z) after unzipping. Drops migrations/0045 and the
# extended src/coachLibrary.ts into place; patches coach.ts, index.ts, api.js, Coach.js.
# Anchored, idempotent, backs up each file.
import os, sys, shutil, tempfile
def die(m): print("ABORT:", m); sys.exit(1)
def backup(p):
    if not os.path.exists(p + ".bak"): shutil.copy2(p, p + ".bak")
def write_atomic(path, text):
    d = os.path.dirname(path) or "."; fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)
def patch(path, edits, sig=None):
    if not os.path.isfile(path): die(f"{path} not found.")
    txt = open(path, encoding="utf-8").read(); orig = txt
    for old, new in edits:
        if new in txt: continue                          # already applied (idempotent)
        if txt.count(old) != 1: die(f"{path}: anchor {txt.count(old)}x (need 1): {old[:50]!r}")
        txt = txt.replace(old, new)
    if txt != orig:
        backup(path); write_atomic(path, txt); print(f"{os.path.basename(path):16s}-> patched")
    else: print(f"{os.path.basename(path):16s}-> already current")

if not os.path.isdir("src"): die("run from repo root (/workspaces/z).")
for f in ("migrations/0045_coach_modes.sql", "src/coachLibrary.ts"):
    if not os.path.isfile(f): die(f"missing {f} — unzip the zip at repo root first.")

# ── coach.ts: import LIBRARIAN_ID + branch retrieveForCourse house/custom ──
patch("src/coach.ts", [
  ("import { embedQueryLiteral } from './coachEmbed.js';",
   "import { embedQueryLiteral } from './coachEmbed.js';\nimport { LIBRARIAN_ID } from './coachLibrary.js';"),
  ("""export async function retrieveForCourse(userId: string, courseId: string, query: string, limit = 8): Promise<Cite[]> {
  const { data: briefs } = await supabase.from('coach_briefs').select('id').eq('course_id', courseId).is('superseded_by', null);
  const ids = new Set(((briefs || []) as any[]).map((b) => b.id));
  if (!ids.size) return [];
  const qEmb = await embedQueryLiteral(query);
  const { data } = await supabase.rpc('coach_search_sections', { p_user_id: userId, p_query: query, p_limit: 24, p_query_embedding: qEmb });
  return ((data || []) as any[]).filter((r) => ids.has(r.brief_id)).slice(0, limit).map((r) => ({ title: r.title, ref: r.ref, page: r.page, body: r.body }));
}""",
   """export async function retrieveForCourse(userId: string, courseId: string, query: string, limit = 8): Promise<Cite[]> {
  // which shelf? house courses read the shared LIBRARY (librarian, by subject); others read the user's own uploads.
  const { data: course } = await supabase.from('coach_courses').select('mode, subject_key').eq('id', courseId).maybeSingle();
  const house = !!(course && (course as any).mode === 'house' && (course as any).subject_key);
  const ownerId = house ? LIBRARIAN_ID : userId;
  const briefQ = house
    ? supabase.from('coach_briefs').select('id').eq('user_id', LIBRARIAN_ID).eq('subject_key', (course as any).subject_key).is('superseded_by', null)
    : supabase.from('coach_briefs').select('id').eq('course_id', courseId).is('superseded_by', null);
  const { data: briefs } = await briefQ;
  const ids = new Set(((briefs || []) as any[]).map((b) => b.id));
  if (!ids.size) return [];
  const qEmb = await embedQueryLiteral(query);
  const { data } = await supabase.rpc('coach_search_sections', { p_user_id: ownerId, p_query: query, p_limit: 24, p_query_embedding: qEmb });
  return ((data || []) as any[]).filter((r) => ids.has(r.brief_id)).slice(0, limit).map((r) => ({ title: r.title, ref: r.ref, page: r.page, body: r.body }));
}"""),
])

# ── index.ts: import codexPlan/subjectMeta + mode-branch /coach/start + no-store on /coach/library ──
patch("src/index.ts", [
  ("import { seedLibrary, listLibrary } from './coachLibrary.js';",
   "import { seedLibrary, listLibrary, codexPlan, subjectMeta } from './coachLibrary.js';"),
  ("    res.json({ subjects: await listLibrary() });",
   "    res.setHeader('Cache-Control', 'no-store');\n    res.json({ subjects: await listLibrary() });"),
  ("""    const user = await resolveUser(authId);
    const topic = String(req.body?.topic || '').trim().slice(0, 160);
    const days = Math.max(1, Math.min(Number(req.body?.days) || 7, 30));
    if (!topic) return res.status(400).json({ error: 'topic required (the exam or subject to coach)' });
    const examContext = await fetchExamContext(topic, user.id);
    const plan = await generatePlan(topic, days, user.id, examContext);
    const { data: c, error } = await supabase.from('coach_courses').insert({
      user_id: user.id, topic, total_days: plan.length, current_day: 1, plan, progress: {}, weak_tags: [],
    }).select('id').single();
    if (error || !c) return res.status(500).json({ error: error?.message || 'course create failed' });
    res.json({ courseId: c.id, topic, totalDays: plan.length, currentDay: 1, plan });""",
   """    const user = await resolveUser(authId);
    const days = Math.max(1, Math.min(Number(req.body?.days) || 7, 30));
    const mode = req.body?.mode === 'house' ? 'house' : 'custom';

    if (mode === 'house') {
      // learn from the shared LIBRARY: the codex's own § order is the plan (section order = study plan)
      const subject = String(req.body?.subject || '').trim();
      const meta = subjectMeta(subject);
      if (!meta) return res.status(400).json({ error: 'unknown subject' });
      const plan = codexPlan(subject, Number(req.body?.days) > 0 ? days : 0);
      if (!plan.length) return res.status(500).json({ error: 'could not build the plan from the codex' });
      const { data: c, error } = await supabase.from('coach_courses').insert({
        user_id: user.id, topic: meta.label, mode: 'house', subject_key: subject,
        total_days: plan.length, current_day: 1, plan, progress: {}, weak_tags: [],
      }).select('id').single();
      if (error || !c) return res.status(500).json({ error: error?.message || 'course create failed' });
      return res.json({ courseId: c.id, topic: meta.label, mode: 'house', subjectKey: subject, totalDays: plan.length, currentDay: 1, plan });
    }

    // custom / bring-your-own: name the topic (web-grounded), then upload material to ground it
    const topic = String(req.body?.topic || '').trim().slice(0, 160);
    if (!topic) return res.status(400).json({ error: 'topic required (the exam or subject to coach)' });
    const examContext = await fetchExamContext(topic, user.id);
    const plan = await generatePlan(topic, days, user.id, examContext);
    const { data: c, error } = await supabase.from('coach_courses').insert({
      user_id: user.id, topic, mode: 'custom', total_days: plan.length, current_day: 1, plan, progress: {}, weak_tags: [],
    }).select('id').single();
    if (error || !c) return res.status(500).json({ error: error?.message || 'course create failed' });
    res.json({ courseId: c.id, topic, mode: 'custom', totalDays: plan.length, currentDay: 1, plan });"""),
])

# ── api.js: coachStart takes opts (mode/subject); add coachMaterial + coachLibrary ──
patch("app/api.js", [
  ("export async function coachStart(topic, days) { return authedJSON('POST', '/coach/start', { topic, days }); }",
   "export async function coachStart(topic, days, opts = {}) { return authedJSON('POST', '/coach/start', { topic, days, ...opts }); }"),
  ("export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }",
   "export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }\n"
   "export async function coachLibrary() { return authedJSON('GET', '/coach/library'); }\n"
   "export async function coachMaterial(id, filename, dataB64) { return authedJSON('POST', `/coach/${id}/material`, { filename, dataB64 }); }"),
])

# ── Coach.js: header top-right uses the HUB image (coach face stays on Says/meet) ──
patch("app/Coach.js", [
  ("const FACE = `${API_BASE}/faces/the_coach.jpg?v=4`;",
   "const FACE = `${API_BASE}/faces/the_coach.jpg?v=4`;\nconst HUB_FACE = `${API_BASE}/faces/the_coaching_hub.jpg?v=5`;"),
  ("function Portrait({ size = 40 }) {", "function Portrait({ size = 40, uri = FACE, mark = 'C' }) {"),
  ("source={{ uri: FACE }} onError={() => setOk(false)}", "source={{ uri }} onError={() => setOk(false)}"),
  ("fontSize: size * 0.5, marginTop: -1 }}>C</Text>", "fontSize: size * 0.5, marginTop: -1 }}>{mark}</Text>"),
  ("      <Portrait size={30} />", "      <Portrait size={30} uri={HUB_FACE} mark=\"\u25c8\" />"),
])
print("done.")
