// coach.ts — THE COACH ENGINE (Layer 1: the core teaching loop).
//
// Any exam or topic in → a day-by-day PLAN → a per-day LESSON → an MCQ QUIZ →
// DETERMINISTIC grade (the answer key is stored; grading is an exact index match,
// no model in the loop — trustworthy for a paid product) → WEAK-SPOT detection →
// the next day ADAPTS to what the student missed.
//
// Exam-agnostic: you NAME the exam (GMAT / SAT / IIT-JEE / CAT / UPSC / CLAT / NEET /
// GRE / foreign exams) or a plain topic, and it builds the plan. Bring-your-own-
// material (RAG) is Layer 3. "The coach" persona is the front door; this is the engine.
//
// Pure grading helpers (gradeAnswers / mergeWeakTags) are separated so the graded
// path is unit-testable without the model. Generation reuses the triviaDuel shape:
// strict JSON, per-item validation, safe fallbacks — a bad generation never bricks a day.
import Anthropic from '@anthropic-ai/sdk';
import { logUsage } from './usage.js';
import { supabase } from './db.js';
import { embedQueryLiteral } from './coachEmbed.js';
import { codexText } from './content.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

// The coach's SOUL — his voice/manner, loaded once. It colors HOW he teaches and
// answers; it never touches WHAT is correct (quiz keys, verify, grading stay pure).
const COACH_VOICE = (() => { try { return codexText('coach') || ''; } catch { return ''; } })();
function inVoice(task: string): string {
  if (!COACH_VOICE) return task;
  return `[WHO YOU ARE — this is you, right now, in the room with a student. Your voice, your manner, how you explain, how you react to a score — all of it comes from here. You never name it, never point to it, never call it a character or a codex; there is only you, being yourself.]\n${COACH_VOICE}\n\n[WHAT YOU ARE DOING RIGHT NOW]\n${task}`;
}

export type MCQ = { q: string; opts: string[]; correct: number; tag: string; why: string };
export type DayFocus = { day: number; title: string; focus: string };

// ── PURE: deterministic grading (unit-tested; NO model) ─────────────────
export type GradeResult = {
  score: number;
  total: number;
  perQuestion: { i: number; chosen: number | null; correct: number; right: boolean; tag: string; why: string }[];
  weakTags: string[];   // tags of the questions missed this quiz
};

export function gradeAnswers(questions: MCQ[], answers: (number | null)[]): GradeResult {
  const perQuestion = questions.map((q, i) => {
    const raw = answers[i];
    const chosen = typeof raw === 'number' ? raw : null;
    const right = chosen === q.correct;
    return { i, chosen, correct: q.correct, right, tag: q.tag || 'general', why: q.why || '' };
  });
  const score = perQuestion.filter((p) => p.right).length;
  const weakTags = [...new Set(perQuestion.filter((p) => !p.right).map((p) => p.tag))];
  return { score, total: questions.length, perQuestion, weakTags };
}

// keep the running weak-spot list (newest first), capped
export function mergeWeakTags(prev: string[], add: string[]): string[] {
  return [...new Set([...(add || []), ...(prev || [])])].slice(0, 12);
}

// strip a client answer key: never send `correct`/`why` down before grading
export function quizForClient(questions: MCQ[]): { q: string; opts: string[]; tag: string }[] {
  return questions.map((x) => ({ q: x.q, opts: x.opts, tag: x.tag }));
}

// ── LLM: plan / lesson / quiz generation (device-verified) ──────────────
function parseJSONArray(text: string): any[] {
  const clean = String(text || '').trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const v = JSON.parse(clean);
  return Array.isArray(v) ? v : [];
}
const textOf = (msg: any) => (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');

// Research the exam's CURRENT syllabus/pattern via web_search, returned as a short
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

export async function generatePlan(topic: string, days: number, userId: string, examContext = ''): Promise<DayFocus[]> {
  const ctx = examContext ? `\n\nUSE THIS CURRENT EXAM INFORMATION (researched just now on the web) as the ground truth for the plan structure and coverage; follow the real sections and pattern it describes:\n${examContext}` : "";
  const sys = `You are an expert exam coach. Build a focused ${days}-day study plan for: "${topic}".${ctx} Sequence from foundations to the harder material; each day is ONE tight, teachable focus a student can actually cover and drill in a sitting. Return ONLY a JSON array of exactly ${days} items: [{"day":1,"title":"short title","focus":"one sentence: what this day teaches and drills"}]. No markdown, no prose.`;
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: `Exam/topic: ${topic}\nDays: ${days}` }] });
    logUsage({ userId, surface: 'other', fn: 'coach_plan', model: MODEL, usage: (msg as any).usage });
    const plan: DayFocus[] = [];
    for (const it of parseJSONArray(textOf(msg))) {
      const title = String(it?.title || '').trim().slice(0, 90);
      const focus = String(it?.focus || '').trim().slice(0, 320);
      if (title && focus) plan.push({ day: plan.length + 1, title, focus });
      if (plan.length === days) break;
    }
    if (plan.length) return plan;
  } catch (e: any) { console.error('[coach] plan failed:', e?.message || e); }
  return Array.from({ length: days }, (_, i) => ({ day: i + 1, title: `Day ${i + 1}`, focus: `Study and practice ${topic} — part ${i + 1}.` }));
}

export async function generateLesson(topic: string, focus: string, weakTags: string[], userId: string, material = ''): Promise<string> {
  const weak = (weakTags && weakTags.length)
    ? `\n\nThis student has been weak on: ${weakTags.join(', ')}. Where it fits naturally, reinforce these too — don't force it.`
    : '';
  const sys = `You are a warm, genuinely expert coach preparing a real student for "${topic}". Teach TODAY'S focus so they actually get it: (1) explain the core idea in plain language, (2) show 1-2 WORKED examples, step by step, revealing the method, (3) a short "how to spot / handle this in the exam" tip. This is real prep, not filler — be clear, concrete, and useful. ~250-400 words, plain text, light structure.${weak}`;
  try {
    const userMsg = material
      ? `Today's focus: ${focus}\n\nTEACH FROM THE STUDENT'S OWN MATERIAL below — base the lesson on it, explain what it says, and cite the section/page inline like (§3.2, p.7) for specific points. If it doesn't cover today's focus, say so briefly, then teach the concept from your own knowledge.\n\n=== STUDENT'S MATERIAL ===\n${material}\n=== END MATERIAL ===`
      : `Today's focus: ${focus}`;
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: inVoice(sys), messages: [{ role: 'user', content: userMsg }] });
    logUsage({ userId, surface: 'other', fn: 'coach_lesson', model: MODEL, usage: (msg as any).usage });
    return textOf(msg).trim() || `Today: ${focus}`;
  } catch (e: any) { console.error('[coach] lesson failed:', e?.message || e); return `Today's focus: ${focus}\n\n(The lesson couldn't be generated just now — please try again.)`; }
}

// build a full MOCK: questions spanning every day-focus of the course. Reuses
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

export async function generateQuiz(topic: string, focus: string, n: number, userId: string, material = ''): Promise<MCQ[]> {
  const gen = Math.min(n + 3, 12);   // over-generate so the verify pass can drop weak keys and still hit n
  const sys = `You write a short practice quiz for a student preparing for "${topic}". Produce EXACTLY ${gen} multiple-choice questions on today's focus. RULES: crisp, unambiguous, exam-realistic; exactly ONE unambiguously correct option; verifiable — NEVER invent facts or trick wording; mixed difficulty. For each, also give "why" (one sentence: why the correct option is right) and "tag" (the sub-skill it tests, 1-3 words). Output ONLY a JSON array, no markdown: [{"q":"…","opts":["…","…","…","…"],"correct":0,"why":"…","tag":"…"}] — correct is the 0-based index, exactly 4 options.`;
  try {
    const userMsg = material
      ? `Today's focus: ${focus}\n\nWrite the questions ONLY on what the STUDENT'S MATERIAL below actually covers, and put the citation (§, p.) in each "why". If the material is thin on today's focus, you may add a few general questions on the focus too.\n\n=== STUDENT'S MATERIAL ===\n${material}\n=== END MATERIAL ===`
      : `Today's focus: ${focus}`;
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 2200, system: sys, messages: [{ role: 'user', content: userMsg }] });
    logUsage({ userId, surface: 'other', fn: 'coach_quiz', model: MODEL, usage: (msg as any).usage });
    const clean: MCQ[] = [];
    for (const it of parseJSONArray(textOf(msg))) {
      const q = String(it?.q || '').trim().slice(0, 320);
      const opts = Array.isArray(it?.opts) ? it.opts.map((o: any) => String(o).trim().slice(0, 140)) : [];
      const correct = Number(it?.correct);
      const tag = String(it?.tag || 'general').trim().slice(0, 40);
      const why = String(it?.why || '').trim().slice(0, 220);
      if (q && opts.length === 4 && opts.every(Boolean) && Number.isInteger(correct) && correct >= 0 && correct <= 3) {
        clean.push({ q, opts, correct, tag, why });
      }
      if (clean.length === gen) break;
    }
    const verified = await verifyQuiz(topic, clean, userId);
    return verified.slice(0, n);
  } catch (e: any) { console.error('[coach] quiz failed:', e?.message || e); return []; }
}

// PURE: apply an independent checker's verdicts — keep only questions the checker
// confirmed (agreed answer, not unsure). If the checker returned nothing usable,
// best-effort KEEP all (a verifier hiccup must not brick the day). Unit-tested.
export function applyVerdicts(questions: MCQ[], verdicts: { i: number; answer: number; unsure?: boolean }[]): MCQ[] {
  const map = new Map<number, { answer: number; unsure: boolean }>();
  for (const c of verdicts || []) {
    const i = Number((c as any)?.i);
    if (Number.isInteger(i)) map.set(i, { answer: Number((c as any)?.answer), unsure: !!(c as any)?.unsure });
  }
  if (map.size === 0) return questions;   // verifier gave nothing usable -> don't drop
  return questions.filter((q, i) => { const v = map.get(i); return !!v && !v.unsure && v.answer === q.correct; });
}

// Independent verification: a SECOND model answers each question COLD (no key shown);
// we keep only questions whose stored key matches the checker. The 'never trust one
// generation' guard (same discipline that fixed the debate verdict). Best-effort on error.
// ── grounding: retrieve the COURSE'S OWN material (fused FTS+vector), course-scoped ──
export type Cite = { title: string; ref: string; page: number | null; body: string };
export async function retrieveForCourse(userId: string, courseId: string, query: string, limit = 8): Promise<Cite[]> {
  const { data: briefs } = await supabase.from('coach_briefs').select('id').eq('course_id', courseId).is('superseded_by', null);
  const ids = new Set(((briefs || []) as any[]).map((b) => b.id));
  if (!ids.size) return [];
  const qEmb = await embedQueryLiteral(query);
  const { data } = await supabase.rpc('coach_search_sections', { p_user_id: userId, p_query: query, p_limit: 24, p_query_embedding: qEmb });
  return ((data || []) as any[]).filter((r) => ids.has(r.brief_id)).slice(0, limit).map((r) => ({ title: r.title, ref: r.ref, page: r.page, body: r.body }));
}
export function materialFromSections(sections: Cite[]): string {
  return sections.map((s) => `(${s.ref}${s.page ? `, p.${s.page}` : ''}) ${s.body}`).join('\n\n');
}
export async function answerFromMaterial(topic: string, question: string, material: string, userId: string): Promise<string> {
  const sys = material
    ? `You are a warm, expert coach for "${topic}". Answer the student's question using their MATERIAL below — explain what it says and cite (§, p.) for specific points. If the material doesn't answer it, say so, then answer from general knowledge.\n\n=== STUDENT'S MATERIAL ===\n${material}\n=== END MATERIAL ===`
    : `You are a warm, expert coach for "${topic}". Answer the student's question clearly. (No uploaded material was found for this course.)`;
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1200, system: inVoice(sys), messages: [{ role: 'user', content: question }] });
    logUsage({ userId, surface: 'other', fn: 'coach_ask', model: MODEL, usage: (msg as any).usage });
    return textOf(msg).trim() || 'Could not answer just now — try again.';
  } catch (e: any) { console.error('[coach] ask failed:', e?.message || e); return 'Could not answer just now — try again.'; }
}

export async function verifyQuiz(topic: string, questions: MCQ[], userId: string): Promise<MCQ[]> {
  if (!questions.length) return questions;
  const sys = `You are a meticulous exam answer-checker for "${topic}". You are given multiple-choice questions with their options but NOT the answer key. For EACH, independently work out the single best answer. If a question is ambiguous, flawed, or has no single clearly-correct option, mark it unsure. Output ONLY a JSON array: [{"i":0,"answer":2,"unsure":false}] where i is the 0-based question index (matching input order), answer is the 0-based option you judge correct, unsure is true when you cannot confidently pick one. No prose, no markdown.`;
  const payload = questions.map((q, i) => ({ i, q: q.q, opts: q.opts }));
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: JSON.stringify(payload) }] });
    logUsage({ userId, surface: 'other', fn: 'coach_quiz_verify', model: MODEL, usage: (msg as any).usage });
    return applyVerdicts(questions, parseJSONArray(textOf(msg)) as any);
  } catch (e: any) { console.error('[coach] verify failed:', e?.message || e); return questions; }
}
