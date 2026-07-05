import io, os, sys
I = 'src/index.ts'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

E("import { createTraitors, stepTraitors, viewTraitors, type Seat as TSeat } from './games/traitors.js';",
  "import { createTraitors, stepTraitors, viewTraitors, type Seat as TSeat } from './games/traitors.js';\nimport { generatePlan, generateLesson, generateQuiz, gradeAnswers, mergeWeakTags, quizForClient, type MCQ } from './coach.js';",
  "index import coach", marker="generatePlan, generateLesson, generateQuiz")

ROUTES = r'''// ── THE COACH (tutoring engine v1) ──────────────────────────────────────
async function loadCoachCourse(id: string, userId: string) {
  const { data } = await supabase.from('coach_courses').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
  return data as any;
}
app.post('/coach/start', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const topic = String(req.body?.topic || '').trim().slice(0, 160);
    const days = Math.max(1, Math.min(Number(req.body?.days) || 7, 30));
    if (!topic) return res.status(400).json({ error: 'topic required (the exam or subject to coach)' });
    const plan = await generatePlan(topic, days, user.id);
    const { data: c, error } = await supabase.from('coach_courses').insert({
      user_id: user.id, topic, total_days: plan.length, current_day: 1, plan, progress: {}, weak_tags: [],
    }).select('id').single();
    if (error || !c) return res.status(500).json({ error: error?.message || 'course create failed' });
    res.json({ courseId: c.id, topic, totalDays: plan.length, currentDay: 1, plan });
  } catch (e: any) { res.status(500).json({ error: 'coach start failed: ' + (e?.message || String(e)) }); }
});
app.post('/coach/:id/lesson', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const day = c.current_day;
    const focus = (c.plan?.[day - 1]?.focus) || c.topic;
    const title = (c.plan?.[day - 1]?.title) || ('Day ' + day);
    const lesson = await generateLesson(c.topic, focus, c.weak_tags || [], user.id);
    const progress = { ...(c.progress || {}) };
    progress[day] = { ...(progress[day] || {}), lesson };
    await supabase.from('coach_courses').update({ progress, updated_at: new Date().toISOString() }).eq('id', c.id);
    res.json({ day, title, focus, lesson });
  } catch (e: any) { res.status(500).json({ error: 'lesson failed: ' + (e?.message || String(e)) }); }
});
app.post('/coach/:id/quiz', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const day = c.current_day;
    const focus = (c.plan?.[day - 1]?.focus) || c.topic;
    const n = Math.max(3, Math.min(Number(req.body?.n) || 5, 10));
    const quiz: MCQ[] = await generateQuiz(c.topic, focus, n, user.id);
    if (!quiz.length) return res.status(502).json({ error: 'could not generate the quiz — try again' });
    const progress = { ...(c.progress || {}) };
    progress[day] = { ...(progress[day] || {}), quiz };   // stored WITH the key (server-side only)
    await supabase.from('coach_courses').update({ progress, updated_at: new Date().toISOString() }).eq('id', c.id);
    res.json({ day, count: quiz.length, questions: quizForClient(quiz) });
  } catch (e: any) { res.status(500).json({ error: 'quiz failed: ' + (e?.message || String(e)) }); }
});
app.post('/coach/:id/grade', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const day = c.current_day;
    const quiz: MCQ[] = (c.progress?.[day]?.quiz) || [];
    if (!quiz.length) return res.status(400).json({ error: 'no quiz to grade — request the quiz first' });
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const graded = gradeAnswers(quiz, answers);
    const weakTags = mergeWeakTags(c.weak_tags || [], graded.weakTags);
    const lastDay = day >= c.total_days;
    const nextDay = lastDay ? day : day + 1;
    const progress = { ...(c.progress || {}) };
    progress[day] = { ...(progress[day] || {}), graded: { score: graded.score, total: graded.total, weakTags: graded.weakTags } };
    await supabase.from('coach_courses').update({
      progress, weak_tags: weakTags, current_day: nextDay,
      status: lastDay ? 'done' : 'active', updated_at: new Date().toISOString(),
    }).eq('id', c.id);
    res.json({ day, score: graded.score, total: graded.total, results: graded.perQuestion, weakTags, nextDay: lastDay ? null : nextDay, done: lastDay });
  } catch (e: any) { res.status(500).json({ error: 'grade failed: ' + (e?.message || String(e)) }); }
});
app.get('/coach/:id', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const days: any = {};
    for (const [d, p] of Object.entries(c.progress || {})) days[d] = { hasLesson: !!(p as any).lesson, graded: (p as any).graded || null };
    res.json({ courseId: c.id, topic: c.topic, totalDays: c.total_days, currentDay: c.current_day, status: c.status, plan: c.plan, weakTags: c.weak_tags, days });
  } catch (e: any) { res.status(500).json({ error: 'course fetch failed: ' + (e?.message || String(e)) }); }
});

'''
E("app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  ROUTES + "app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  "index coach endpoints", marker="/coach/start")

if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
placed = []
for fn, dest in [('coach.ts','src/coach.ts'), ('0039_coach.sql','migrations/0039_coach.sql')]:
    if os.path.isfile(fn) and not os.path.isfile(dest):
        io.open(dest,'w',encoding='utf-8').write(io.open(fn,encoding='utf-8').read()); placed.append(dest)
    elif os.path.isfile(dest): placed.append(dest+' (already)')
src = io.open(I, encoding='utf-8').read(); staged = src; planned, skipped = [], []
for (old,new,label,marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged): skipped.append(label); continue
    if staged.count(old)!=1: print(f"  ! {label}: anchor x{staged.count(old)} — ABORT"); sys.exit(1)
    staged = staged.replace(old,new); planned.append(label)
if planned: io.open(I,'w',encoding='utf-8').write(staged)
for p in placed: print(f"  + {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
