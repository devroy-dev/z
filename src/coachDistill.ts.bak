// coachDistill.ts — THE STUDY CLERK. One document in, one Brief on the coach's shelf.
// Ported from the dreamai engine (reference only), native to yourZ. Adapted for STUDY
// material (chapters, notes, papers) rather than legal docs: it distills into TEACHABLE
// §-sections — concepts, definitions, formulas, key facts, worked steps — each page-
// anchored, with declared gaps for what it could not read. The original stays in Storage
// as the final authority; the Brief is its honest, teach-ready index.
//
// Pipeline: bytes → Supabase Storage (immutable) → one-time Sonnet pass reads the PDF
// natively → §-numbered page-mapped JSON Brief → salvage-on-truncation → insert (the
// trigger lays the §-rows) → embedBriefOnShelve fills the vectors. Briefs are IMMUTABLE.
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './db.js';
import { embedBriefOnShelve } from './coachEmbed.js';
import { calcCostInr, usageFromApi } from './models.js';
import { logUsage } from './usage.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const CLERK_MODEL = 'claude-sonnet-4-6';   // the one-time reading clerk (careful, native PDF)
const BUCKET = 'coach-docs';
const CLERK_MAX_TOKENS = 16000;

const STUDY_CLERK = `You are a reading clerk for a STUDY COACH. You read ONE study document (a chapter, notes, a paper, a syllabus) ONCE and produce its BRIEF — a distilled, page-anchored index that is the only form in which this material will be read while teaching. The original stays in storage as the final authority; your Brief is its honest, TEACH-READY index.

THE CHAIN YOU MUST NEVER BREAK: answer → § → page → original. Every section carries the page it begins on. A § whose page cannot be determined goes into declared_gaps, never under a guessed page.

YOUR LAWS:
1. Distill into TEACHABLE units. One § per concept, definition, rule, theorem, formula, method, or worked example — following the material's own structure and numbering where it has one ("Section 3.2" → ref "§3.2"); unstructured material gets sequential refs §1, §2, … in reading order.
2. Load-bearing content VERBATIM, in quotes, inside the §'s text: definitions, formulas, laws, exact figures, dates, named results, key terms. Paraphrase the surrounding explanation; never paraphrase the operative statement of a rule or formula.
3. Capture EXAMPLES. Where the material works an example, record the setup and the method (the steps), not just the answer — a coach teaches the method.
4. Declared gaps, plainly: whatever you could not read (scanned diagrams, illegible pages, images, missing figures) — one plain sentence each in declared_gaps. An empty string asserts nothing was unreadable.
5. Never invent: no guessed pages, no inferred content, no "textbooks like this usually cover." Absence is reported as absence.
6. Account for the whole document: every page covered by some § or named in declared_gaps. If you cannot index it all within budget, cover what you honestly can and DECLARE THE CUT as a gap ("Content beyond p.20 not indexed in this Brief").

OUTPUT: ONLY the JSON object below — no prose before or after, no markdown fences.
{"title": "<the document's own title, or a faithful descriptive name>", "pages": <count as actually seen>, "sections": [{"ref": "§3.2", "page": 7, "text": "..."}], "declared_gaps": "<one plain sentence per gap, or empty string>"}`;

export type CoachDistillResult = {
  documentId: string; briefId: string; title: string;
  pages: number | null; sectionsCount: number; declaredGaps: string;
  costInr: number; truncated: boolean;
};

// SALVAGE — recover a partial Brief from a beheaded JSON (max_tokens cut): title/pages,
// then every COMPLETE section object before the cut. One complete § is enough to shelve.
export function salvageBrief(raw: string): { title: string | null; pages: number | null; sections: Array<{ ref: string; page: number; text: string }> } {
  const titleM = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const pagesM = raw.match(/"pages"\s*:\s*(\d+)/);
  const sections: Array<{ ref: string; page: number; text: string }> = [];
  const start = raw.indexOf('"sections"');
  if (start !== -1) {
    const arr = raw.indexOf('[', start);
    let i = arr === -1 ? -1 : arr + 1;
    while (i !== -1 && i < raw.length) {
      const open = raw.indexOf('{', i);
      if (open === -1) break;
      let depth = 0, j = open, inStr = false, esc = false, close = -1;
      for (; j < raw.length; j++) {
        const c = raw[j];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { close = j; break; } }
      }
      if (close === -1) break;
      try {
        const obj = JSON.parse(raw.slice(open, close + 1));
        if (obj && typeof obj.ref === 'string' && typeof obj.page === 'number' && typeof obj.text === 'string') sections.push(obj);
      } catch { /* skip malformed, keep walking */ }
      i = close + 1;
    }
  }
  return { title: titleM ? JSON.parse('"' + titleM[1] + '"') : null, pages: pagesM ? parseInt(pagesM[1], 10) : null, sections };
}

async function ensureBucket(): Promise<void> {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message)) throw new Error(`storage bucket: ${error.message}`);
}

// Upload a PDF (base64) for a course, distill it into a Brief, embed it. Returns the summary.
export async function distillMaterial(
  userId: string, courseId: string | null, filename: string, dataB64: string,
): Promise<CoachDistillResult> {
  await ensureBucket();
  const storageRef = `${userId}/${Date.now()}_${filename.replace(/[^\w.\-]/g, '_')}`;
  const bytes = Buffer.from(dataB64, 'base64');
  const up = await supabase.storage.from(BUCKET).upload(storageRef, bytes, { contentType: 'application/pdf', upsert: true });
  if (up.error) throw new Error(`upload: ${up.error.message}`);

  const { data: doc, error: docErr } = await supabase.from('coach_documents')
    .insert({ user_id: userId, course_id: courseId, storage_ref: storageRef, filename, content_type: 'application/pdf' })
    .select('id').single();
  if (docErr || !doc) throw new Error(`document row: ${docErr?.message || 'insert failed'}`);

  // the clerk — STREAMED (a large output can exceed the non-stream ceiling)
  const stream = anthropic.messages.stream({
    model: CLERK_MODEL, max_tokens: CLERK_MAX_TOKENS, system: STUDY_CLERK,
    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dataB64 } } as any,
      { type: 'text', text: 'Produce the Brief for this study document. JSON only.' },
    ] }],
  });
  const resp = await stream.finalMessage();
  logUsage({ userId, surface: 'other', fn: 'coach_distill', model: CLERK_MODEL, usage: (resp as any).usage });
  const costInr = calcCostInr(CLERK_MODEL, usageFromApi((resp as any).usage)).inr;
  const truncated = resp.stop_reason === 'max_tokens';
  const raw = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');

  // persist the clerk's raw output beside the original — nothing evaporates
  await supabase.storage.from(BUCKET).upload(`${storageRef}.clerk.txt`, Buffer.from(raw, 'utf-8'), { contentType: 'text/plain', upsert: true }).then(() => {}, () => {});

  let title: string, pages: number | null, sections: Array<{ ref: string; page: number; text: string }>, declaredGaps: string;
  try {
    const parsed = JSON.parse(raw);
    title = String(parsed.title || filename).slice(0, 200);
    pages = Number.isInteger(parsed.pages) ? parsed.pages : null;
    sections = Array.isArray(parsed.sections) ? parsed.sections.filter((s: any) => s && typeof s.ref === 'string' && typeof s.text === 'string') : [];
    declaredGaps = String(parsed.declared_gaps || '');
  } catch {
    const s = salvageBrief(raw);
    title = (s.title || filename).slice(0, 200);
    pages = s.pages;
    sections = s.sections;
    declaredGaps = (s.sections.length ? 'Brief was truncated; only the sections before the cut are indexed. ' : 'The clerk output could not be parsed. ') + 'Re-distillation may recover more.';
  }
  if (!sections.length) throw new Error('the clerk produced no usable sections');

  const { data: brief, error: briefErr } = await supabase.from('coach_briefs').insert({
    document_id: doc.id, user_id: userId, course_id: courseId, title, sections, pages,
    declared_gaps: declaredGaps, distilled_by: CLERK_MODEL,
  }).select('id').single();
  if (briefErr || !brief) throw new Error(`brief row: ${briefErr?.message || 'insert failed'}`);

  // the trigger has laid the §-rows; fill the meaning index (non-fatal)
  await embedBriefOnShelve(brief.id);

  return {
    documentId: doc.id, briefId: brief.id, title, pages,
    sectionsCount: sections.length, declaredGaps, costInr, truncated,
  };
}
