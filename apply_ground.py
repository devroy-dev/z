import io, os, sys
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))
C='src/coach.ts'; I='src/index.ts'

# ---- coach.ts: imports ----
E(C,"import { logUsage } from './usage.js';",
  "import { logUsage } from './usage.js';\nimport { supabase } from './db.js';\nimport { embedQueryLiteral } from './coachEmbed.js';",
  "coach imports supabase+embed", marker="embedQueryLiteral } from './coachEmbed.js'")

# ---- coach.ts: generateLesson signature + grounded user message ----
E(C,"export async function generateLesson(topic: string, focus: string, weakTags: string[], userId: string): Promise<string> {",
  "export async function generateLesson(topic: string, focus: string, weakTags: string[], userId: string, material = ''): Promise<string> {",
  "generateLesson signature", marker="userId: string, material = ''): Promise<string>")
E(C,"    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: `Today's focus: ${focus}` }] });",
  "    const userMsg = material\n      ? `Today's focus: ${focus}\\n\\nTEACH FROM THE STUDENT'S OWN MATERIAL below — base the lesson on it, explain what it says, and cite the section/page inline like (\u00a73.2, p.7) for specific points. If it doesn't cover today's focus, say so briefly, then teach the concept from your own knowledge.\\n\\n=== STUDENT'S MATERIAL ===\\n${material}\\n=== END MATERIAL ===`\n      : `Today's focus: ${focus}`;\n    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: userMsg }] });",
  "generateLesson grounded msg", marker="TEACH FROM THE STUDENT'S OWN MATERIAL below")

# ---- coach.ts: generateQuiz signature + grounded user message ----
E(C,"export async function generateQuiz(topic: string, focus: string, n: number, userId: string): Promise<MCQ[]> {",
  "export async function generateQuiz(topic: string, focus: string, n: number, userId: string, material = ''): Promise<MCQ[]> {",
  "generateQuiz signature", marker="userId: string, material = ''): Promise<MCQ[]>")
E(C,"    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 2200, system: sys, messages: [{ role: 'user', content: `Today's focus: ${focus}` }] });",
  "    const userMsg = material\n      ? `Today's focus: ${focus}\\n\\nWrite the questions ONLY on what the STUDENT'S MATERIAL below actually covers, and put the citation (\u00a7, p.) in each \"why\". If the material is thin on today's focus, you may add a few general questions on the focus too.\\n\\n=== STUDENT'S MATERIAL ===\\n${material}\\n=== END MATERIAL ===`\n      : `Today's focus: ${focus}`;\n    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 2200, system: sys, messages: [{ role: 'user', content: userMsg }] });",
  "generateQuiz grounded msg", marker="Write the questions ONLY on what the STUDENT'S MATERIAL")

# ---- coach.ts: append retrieval + ask helpers ----
E(C,"export async function verifyQuiz(topic: string, questions: MCQ[], userId: string): Promise<MCQ[]> {",
  "// ── grounding: retrieve the COURSE'S OWN material (fused FTS+vector), course-scoped ──\nexport type Cite = { title: string; ref: string; page: number | null; body: string };\nexport async function retrieveForCourse(userId: string, courseId: string, query: string, limit = 8): Promise<Cite[]> {\n  const { data: briefs } = await supabase.from('coach_briefs').select('id').eq('course_id', courseId).is('superseded_by', null);\n  const ids = new Set(((briefs || []) as any[]).map((b) => b.id));\n  if (!ids.size) return [];\n  const qEmb = await embedQueryLiteral(query);\n  const { data } = await supabase.rpc('coach_search_sections', { p_user_id: userId, p_query: query, p_limit: 24, p_query_embedding: qEmb });\n  return ((data || []) as any[]).filter((r) => ids.has(r.brief_id)).slice(0, limit).map((r) => ({ title: r.title, ref: r.ref, page: r.page, body: r.body }));\n}\nexport function materialFromSections(sections: Cite[]): string {\n  return sections.map((s) => `(${s.ref}${s.page ? `, p.${s.page}` : ''}) ${s.body}`).join('\\n\\n');\n}\nexport async function answerFromMaterial(topic: string, question: string, material: string, userId: string): Promise<string> {\n  const sys = material\n    ? `You are a warm, expert coach for \"${topic}\". Answer the student's question using their MATERIAL below — explain what it says and cite (\u00a7, p.) for specific points. If the material doesn't answer it, say so, then answer from general knowledge.\\n\\n=== STUDENT'S MATERIAL ===\\n${material}\\n=== END MATERIAL ===`\n    : `You are a warm, expert coach for \"${topic}\". Answer the student's question clearly. (No uploaded material was found for this course.)`;\n  try {\n    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1200, system: sys, messages: [{ role: 'user', content: question }] });\n    logUsage({ userId, surface: 'other', fn: 'coach_ask', model: MODEL, usage: (msg as any).usage });\n    return textOf(msg).trim() || 'Could not answer just now — try again.';\n  } catch (e: any) { console.error('[coach] ask failed:', e?.message || e); return 'Could not answer just now — try again.'; }\n}\n\nexport async function verifyQuiz(topic: string, questions: MCQ[], userId: string): Promise<MCQ[]> {",
  "append retrieve/ask helpers", marker="export async function retrieveForCourse")

# ---- index.ts: import the grounding helpers ----
E(I,"import { distillMaterial } from './coachDistill.js';",
  "import { distillMaterial } from './coachDistill.js';\nimport { retrieveForCourse, materialFromSections, answerFromMaterial } from './coach.js';",
  "index import grounding", marker="retrieveForCourse, materialFromSections, answerFromMaterial")

# ---- index.ts: /lesson grounds + returns grounded/citations ----
E(I,"    const lesson = await generateLesson(c.topic, focus, c.weak_tags || [], user.id);",
  "    const mats = await retrieveForCourse(user.id, c.id, focus);\n    const lesson = await generateLesson(c.topic, focus, c.weak_tags || [], user.id, materialFromSections(mats));",
  "lesson retrieval", marker="const mats = await retrieveForCourse(user.id, c.id, focus);\n    const lesson")
E(I,"    res.json({ day, title, focus, lesson });",
  "    res.json({ day, title, focus, lesson, grounded: mats.length > 0, citations: mats.map((m) => ({ ref: m.ref, page: m.page, title: m.title })) });",
  "lesson response grounded", marker="grounded: mats.length > 0, citations")

# ---- index.ts: /quiz grounds ----
E(I,"    const quiz: MCQ[] = await generateQuiz(c.topic, focus, n, user.id);",
  "    const qmats = await retrieveForCourse(user.id, c.id, focus);\n    const quiz: MCQ[] = await generateQuiz(c.topic, focus, n, user.id, materialFromSections(qmats));",
  "quiz retrieval", marker="const qmats = await retrieveForCourse")
E(I,"    res.json({ day, count: quiz.length, questions: quizForClient(quiz) });",
  "    res.json({ day, count: quiz.length, questions: quizForClient(quiz), grounded: qmats.length > 0 });",
  "quiz response grounded", marker="grounded: qmats.length > 0")

# ---- index.ts: /ask endpoint (insert before /coach/:id/material via the shelf-block anchor) ----
E(I,"// ── COACH: bring-your-own-material (RAG ingest) ─────────────────────────",
  "// ── COACH: ask / teach from the course's material ───────────────────────\napp.post('/coach/:id/ask', express.json(), async (req, res) => {\n  try {\n    const authId = await authUser(req);\n    if (!authId) return res.status(401).json({ error: 'unauthorized' });\n    const user = await resolveUser(authId);\n    const c = await loadCoachCourse(req.params.id, user.id);\n    if (!c) return res.status(404).json({ error: 'no such course' });\n    const question = String(req.body?.question || '').trim().slice(0, 800);\n    if (!question) return res.status(400).json({ error: 'question required' });\n    const mats = await retrieveForCourse(user.id, c.id, question);\n    const answer = await answerFromMaterial(c.topic, question, materialFromSections(mats), user.id);\n    res.json({ answer, grounded: mats.length > 0, citations: mats.map((m) => ({ ref: m.ref, page: m.page, title: m.title })) });\n  } catch (e: any) { res.status(500).json({ error: 'ask failed: ' + (e?.message || String(e)) }); }\n});\n\n// ── COACH: bring-your-own-material (RAG ingest) ─────────────────────────",
  "index /ask endpoint", marker="/coach/:id/ask")

cache={}
def load(p):
    if p not in cache: cache[p]=io.open(p,encoding='utf-8').read()
    return cache[p]
planned,skipped=[],[]
for (path,old,new,label,marker) in edits:
    s=load(path)
    if (marker and marker in s) or (not marker and old not in s): skipped.append(label); continue
    if s.count(old)!=1: print(f"  ! {label}: anchor x{s.count(old)} in {path} — ABORT"); sys.exit(1)
    cache[path]=s.replace(old,new); planned.append(label)
for p,c in cache.items(): io.open(p,'w',encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
