import io, os, sys
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))
C='src/coach.ts'; I='src/index.ts'

# coach.ts: generateMock + breakdownByTag (append after quizForClient block)
E(C,"export async function generateQuiz(topic: string, focus: string, n: number, userId: string, material = ''): Promise<MCQ[]> {",
  """// build a full MOCK: questions spanning every day-focus of the course. Reuses
// generateQuiz (generation + verify + grounding) per focus so coverage is even.
export async function generateMock(topic: string, focuses: string[], perFocus: number, userId: string, material = ''): Promise<MCQ[]> {
  const pool: MCQ[] = [];
  for (const f of focuses) {
    const qs = await generateQuiz(topic, f, Math.max(1, Math.min(perFocus, 8)), userId, material);
    pool.push(...qs);
  }
  return pool;
}

// PURE: per-topic breakdown from a graded result (unit-tested).
export function breakdownByTag(perQuestion: GradeResult['perQuestion']): Record<string, { right: number; total: number }> {
  const out: Record<string, { right: number; total: number }> = {};
  for (const p of perQuestion) {
    const t = p.tag || 'general';
    if (!out[t]) out[t] = { right: 0, total: 0 };
    out[t].total++; if (p.right) out[t].right++;
  }
  return out;
}

export async function generateQuiz(topic: string, focus: string, n: number, userId: string, material = ''): Promise<MCQ[]> {""",
  "coach generateMock+breakdownByTag", marker="export async function generateMock")

# index.ts: import
E(I,"import { retrieveForCourse, materialFromSections, answerFromMaterial } from './coach.js';",
  "import { retrieveForCourse, materialFromSections, answerFromMaterial, generateMock, breakdownByTag } from './coach.js';",
  "index import mock", marker="generateMock, breakdownByTag }")

# index.ts: mock endpoints (before the /ask comment)
ROUTES='''// ── COACH: MOCK TESTS (Layer 4) ─────────────────────────────────────────
app.post('/coach/:id/mock/start', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const focuses: string[] = (((c.plan as any[]) || []).map((p) => p.focus).filter(Boolean));
    if (!focuses.length) focuses.push(c.topic);
    const n = Math.max(5, Math.min(Number(req.body?.n) || 20, 40));
    const minutes = Math.max(5, Math.min(Number(req.body?.minutes) || 30, 180));
    const perFocus = Math.max(1, Math.ceil(n / focuses.length));
    const mats = await retrieveForCourse(user.id, c.id, c.topic, 12);
    const pool = await generateMock(c.topic, focuses, perFocus, user.id, materialFromSections(mats));
    const questions = pool.slice(0, n);
    if (questions.length < 3) return res.status(502).json({ error: 'could not generate the mock — try again' });
    const { data: m, error } = await supabase.from('coach_mocks').insert({
      course_id: c.id, user_id: user.id, questions, duration_sec: minutes * 60,
    }).select('id, started_at, duration_sec').single();
    if (error || !m) return res.status(500).json({ error: error?.message || 'mock create failed' });
    res.json({ mockId: m.id, count: questions.length, durationSec: m.duration_sec, startedAt: m.started_at, grounded: mats.length > 0, questions: quizForClient(questions) });
  } catch (e: any) { res.status(500).json({ error: 'mock start failed: ' + (e?.message || String(e)) }); }
});
app.post('/coach/:id/mock/:mockId/submit', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const { data: m } = await supabase.from('coach_mocks').select('*').eq('id', req.params.mockId).eq('user_id', user.id).maybeSingle();
    if (!m) return res.status(404).json({ error: 'no such mock' });
    if (m.status === 'done') return res.status(400).json({ error: 'this mock is already submitted' });
    const quiz: MCQ[] = (m.questions as any) || [];
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const graded = gradeAnswers(quiz, answers);
    const breakdown = breakdownByTag(graded.perQuestion);
    await supabase.from('coach_mocks').update({
      score: graded.score, total: graded.total, breakdown, status: 'done', submitted_at: new Date().toISOString(),
    }).eq('id', m.id);
    res.json({ score: graded.score, total: graded.total, breakdown, results: graded.perQuestion });
  } catch (e: any) { res.status(500).json({ error: 'mock submit failed: ' + (e?.message || String(e)) }); }
});

'''
E(I,"// ── COACH: ask / teach from the course's material ───────────────────────",
  ROUTES+"// ── COACH: ask / teach from the course's material ───────────────────────",
  "index mock endpoints", marker="COACH: MOCK TESTS (Layer 4)")

cache={}
def load(p):
    if p not in cache: cache[p]=io.open(p,encoding='utf-8').read()
    return cache[p]
placed=[]
for fn,dest in [('0041_coach_mocks.sql','migrations/0041_coach_mocks.sql')]:
    if os.path.isfile(fn) and not os.path.isfile(dest):
        io.open(dest,'w',encoding='utf-8').write(io.open(fn,encoding='utf-8').read()); placed.append(dest)
planned,skipped=[],[]
for (path,old,new,label,marker) in edits:
    s=load(path)
    if (marker and marker in s) or (not marker and old not in s): skipped.append(label); continue
    if s.count(old)!=1: print(f"  ! {label}: anchor x{s.count(old)} in {path} — ABORT"); sys.exit(1)
    cache[path]=s.replace(old,new); planned.append(label)
for p,c in cache.items(): io.open(p,'w',encoding='utf-8').write(c)
for p in placed: print(f"  + {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
