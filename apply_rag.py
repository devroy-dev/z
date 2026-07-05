import io, os, sys
I = 'src/index.ts'
edits=[]
def E(old,new,label,marker=None): edits.append((old,new,label,marker))
E("import { generatePlan, generateLesson, generateQuiz, gradeAnswers, mergeWeakTags, quizForClient, type MCQ } from './coach.js';",
  "import { generatePlan, generateLesson, generateQuiz, gradeAnswers, mergeWeakTags, quizForClient, type MCQ } from './coach.js';\nimport { distillMaterial } from './coachDistill.js';",
  "index import coach RAG", marker="distillMaterial } from './coachDistill.js'")
ROUTES = r'''// ── COACH: bring-your-own-material (RAG ingest) ─────────────────────────
app.post('/coach/:id/material', express.json({ limit: '25mb' }), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const filename = String(req.body?.filename || 'material.pdf').trim().slice(0, 160);
    const dataB64 = String(req.body?.dataB64 || '');
    if (!dataB64) return res.status(400).json({ error: 'dataB64 (base64 PDF) required' });
    const result = await distillMaterial(user.id, c.id, filename, dataB64);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: 'material failed: ' + (e?.message || String(e)) }); }
});
app.get('/coach/:id/shelf', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    const c = await loadCoachCourse(req.params.id, user.id);
    if (!c) return res.status(404).json({ error: 'no such course' });
    const { data } = await supabase.from('coach_briefs')
      .select('id, title, pages, declared_gaps, created_at, sections')
      .eq('user_id', user.id).eq('course_id', c.id).is('superseded_by', null)
      .order('created_at', { ascending: false });
    const briefs = (data || []).map((b: any) => ({ id: b.id, title: b.title, pages: b.pages, sections: Array.isArray(b.sections) ? b.sections.length : 0, declaredGaps: b.declared_gaps, createdAt: b.created_at }));
    res.json({ courseId: c.id, briefs });
  } catch (e: any) { res.status(500).json({ error: 'shelf failed: ' + (e?.message || String(e)) }); }
});

'''
E("app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  ROUTES + "app.get('/battlefield/watch/:sessionId', async (req, res) => {",
  "index coach material endpoints", marker="/coach/:id/material")

if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
placed=[]
for fn,dest in [('coachEmbed.ts','src/coachEmbed.ts'),('coachDistill.ts','src/coachDistill.ts'),('0040_coach_rag.sql','migrations/0040_coach_rag.sql')]:
    if os.path.isfile(fn) and not os.path.isfile(dest):
        io.open(dest,'w',encoding='utf-8').write(io.open(fn,encoding='utf-8').read()); placed.append(dest)
    elif os.path.isfile(dest): placed.append(dest+' (already)')
src=io.open(I,encoding='utf-8').read(); staged=src; planned,skipped=[],[]
for (old,new,label,marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged): skipped.append(label); continue
    if staged.count(old)!=1: print(f"  ! {label}: anchor x{staged.count(old)} — ABORT"); sys.exit(1)
    staged=staged.replace(old,new); planned.append(label)
if planned: io.open(I,'w',encoding='utf-8').write(staged)
for p in placed: print(f"  + {p}")
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
