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

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

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

export async function generatePlan(topic: string, days: number, userId: string): Promise<DayFocus[]> {
  const sys = `You are an expert exam coach. Build a focused ${days}-day study plan for: "${topic}". Sequence from foundations to the harder material; each day is ONE tight, teachable focus a student can actually cover and drill in a sitting. Return ONLY a JSON array of exactly ${days} items: [{"day":1,"title":"short title","focus":"one sentence: what this day teaches and drills"}]. No markdown, no prose.`;
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

export async function generateLesson(topic: string, focus: string, weakTags: string[], userId: string): Promise<string> {
  const weak = (weakTags && weakTags.length)
    ? `\n\nThis student has been weak on: ${weakTags.join(', ')}. Where it fits naturally, reinforce these too — don't force it.`
    : '';
  const sys = `You are a warm, genuinely expert coach preparing a real student for "${topic}". Teach TODAY'S focus so they actually get it: (1) explain the core idea in plain language, (2) show 1-2 WORKED examples, step by step, revealing the method, (3) a short "how to spot / handle this in the exam" tip. This is real prep, not filler — be clear, concrete, and useful. ~250-400 words, plain text, light structure.${weak}`;
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: `Today's focus: ${focus}` }] });
    logUsage({ userId, surface: 'other', fn: 'coach_lesson', model: MODEL, usage: (msg as any).usage });
    return textOf(msg).trim() || `Today: ${focus}`;
  } catch (e: any) { console.error('[coach] lesson failed:', e?.message || e); return `Today's focus: ${focus}\n\n(The lesson couldn't be generated just now — please try again.)`; }
}

export async function generateQuiz(topic: string, focus: string, n: number, userId: string): Promise<MCQ[]> {
  const sys = `You write a short practice quiz for a student preparing for "${topic}". Produce EXACTLY ${n} multiple-choice questions on today's focus. RULES: crisp, unambiguous, exam-realistic; exactly ONE unambiguously correct option; verifiable — NEVER invent facts or trick wording; mixed difficulty. For each, also give "why" (one sentence: why the correct option is right) and "tag" (the sub-skill it tests, 1-3 words). Output ONLY a JSON array, no markdown: [{"q":"…","opts":["…","…","…","…"],"correct":0,"why":"…","tag":"…"}] — correct is the 0-based index, exactly 4 options.`;
  try {
    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 2200, system: sys, messages: [{ role: 'user', content: `Today's focus: ${focus}` }] });
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
      if (clean.length === n) break;
    }
    return clean;
  } catch (e: any) { console.error('[coach] quiz failed:', e?.message || e); return []; }
}
