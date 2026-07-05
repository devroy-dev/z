import io, sys
C='src/coach.ts'; I='src/index.ts'
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))

NEWFN = r'''// Research the exam's CURRENT syllabus/pattern via web_search, returned as a short
// factual brief. Grounds the plan in today's official structure, not training memory.
export async function fetchExamContext(topic: string, userId: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 800,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 } as any],
      system: `You are researching an exam to help build an accurate, CURRENT study plan. Use web_search to find the exam's OFFICIAL current syllabus, section structure, question types, counts, and marking scheme (prefer the latest notified/official pattern). Then write a tight FACTUAL brief (150-250 words): the sections, what each tests, question format/counts, and any recent pattern changes. Plain text, no fluff, no citation markup. If it is a general topic rather than a formal exam, briefly outline the key sub-areas a learner should cover.`,
      messages: [{ role: 'user', content: `Exam or topic: ${topic}` }],
    });
    logUsage({ userId, surface: 'other', fn: 'coach_exam_context', model: MODEL, usage: (msg as any).usage });
    return (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim().slice(0, 2000);
  } catch (e: any) { console.error('[coach] exam context failed:', e?.message || e); return ''; }
}

export async function generatePlan(topic: string, days: number, userId: string, examContext = ''): Promise<DayFocus[]> {'''
E(C,"export async function generatePlan(topic: string, days: number, userId: string): Promise<DayFocus[]> {",
  NEWFN,"coach fetchExamContext + plan signature", marker="export async function fetchExamContext")

OLD_SYS='  const sys = `You are an expert exam coach. Build a focused ${days}-day study plan for: "${topic}". Sequence from foundations to the harder material;'
NEW_SYS='  const ctx = examContext ? `\\n\\nUSE THIS CURRENT EXAM INFORMATION (researched just now on the web) as the ground truth for the plan structure and coverage; follow the real sections and pattern it describes:\\n${examContext}` : "";\n  const sys = `You are an expert exam coach. Build a focused ${days}-day study plan for: "${topic}".${ctx} Sequence from foundations to the harder material;'
E(C, OLD_SYS, NEW_SYS, "coach plan uses ctx", marker="USE THIS CURRENT EXAM INFORMATION")

E(I,"    const plan = await generatePlan(topic, days, user.id);",
  "    const examContext = await fetchExamContext(topic, user.id);\n    const plan = await generatePlan(topic, days, user.id, examContext);",
  "start fetches exam context", marker="const examContext = await fetchExamContext")
E(I,"import { generatePlan, generateLesson, generateQuiz, gradeAnswers, mergeWeakTags, quizForClient, type MCQ } from './coach.js';",
  "import { generatePlan, fetchExamContext, generateLesson, generateQuiz, gradeAnswers, mergeWeakTags, quizForClient, type MCQ } from './coach.js';",
  "import fetchExamContext", marker="generatePlan, fetchExamContext,")

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
