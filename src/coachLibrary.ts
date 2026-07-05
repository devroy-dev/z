// coachLibrary.ts — THE HOUSE SUBJECT LIBRARY seeder + lister.
//
// The hand-authored codices — six SKILL codices (universal cognitive skills) and ten
// SUBJECT-KNOWLEDGE codices (the converted domains) — are seeded onto ONE librarian-
// owned shelf, tagged by subject, with no course_id: the shared "house" corpus every
// learner reads in house mode. Brief-direct ingest (the Sonnet clerk is bypassed for
// hand-authored material):
//   read the .md → parse each "## §N …" into a section → insert one coach_briefs row
//   (the 0040 trigger lays the §-rows + FTS) → embedBriefOnShelve fills Voyage vectors.
// Re-seeding a subject deletes its prior librarian doc (cascade) and re-inserts — the
// house corpus keeps no history (user uploads keep the supersede pattern instead).
import { supabase } from './db.js';
import { embedBriefOnShelve } from './coachEmbed.js';
import { readContentFile } from './content.js';

// the fixed librarian identity (matches migration 0044)
export const LIBRARIAN_ID = '00000000-0000-4000-8000-00000000010c';

// subject_key → { label shown in the picker, codex file under content/coach-library/ }
// Skills first (the universal beachhead), then the knowledge subjects. Reorder here.
const SUBJECTS: { key: string; label: string; file: string }[] = [
  // ── SKILL codices (neutral, one-defensible-answer) ──
  { key: 'logical-reasoning',      label: 'Logical & Analytical Reasoning',   file: 'codex-logical-reasoning.md' },
  { key: 'quant-reasoning',        label: 'Quantitative & Numerical Reasoning', file: 'codex-quant-reasoning.md' },
  { key: 'critical-reasoning',     label: 'Critical Reasoning',               file: 'codex-critical-reasoning.md' },
  { key: 'english-grammar',        label: 'English Grammar & Usage',          file: 'codex-english-grammar.md' },
  { key: 'reading-comprehension',  label: 'Reading Comprehension',            file: 'codex-reading-comprehension.md' },
  { key: 'legal-reasoning',        label: 'Legal Reasoning',                  file: 'codex-legal-reasoning.md' },
  // ── SUBJECT-KNOWLEDGE codices (contested real-world bodies of knowledge) ──
  { key: 'history',        label: "History's Turning Points",                    file: 'codex-history.md' },
  { key: 'global-economy', label: 'Global Economy: Trade, Development & Growth',  file: 'codex-global-economy.md' },
  { key: 'geopolitics',    label: 'Geopolitics & the Changing World Order',      file: 'codex-geopolitics.md' },
  { key: 'law',            label: 'Law, Justice & Rights',                       file: 'codex-law.md' },
  { key: 'democracy',      label: 'Democracy, Governance & Political Institutions', file: 'codex-democracy.md' },
  { key: 'philosophy',     label: 'Political Philosophy & Ethics',               file: 'codex-philosophy.md' },
  { key: 'war',            label: 'War, Security & Just War',                    file: 'codex-war.md' },
  { key: 'technology',     label: 'Technology & Society Governance',             file: 'codex-technology.md' },
  { key: 'religion',       label: 'Religion, Secularism & the State',           file: 'codex-religion.md' },
  { key: 'environment',    label: 'Environment & Climate Policy',                file: 'codex-environment.md' },
];

type Section = { ref: string; page: number | null; text: string };

// Parse a codex into its teachable §-sections. Every "## §N …" heading (and its body
// through the next "## ") is one section; the ref is the §-token (handles §4.1 too).
// Scope / How-tested / title are front matter and are not shelved. page is always null.
export function parseCodex(md: string): Section[] {
  const out: Section[] = [];
  const blocks = String(md || '').split(/\n(?=##\s)/);
  for (const block of blocks) {
    const m = block.match(/^##\s+(§\S+)\b/);
    if (!m) continue;
    const text = block.trim();
    if (text) out.push({ ref: m[1], page: null, text });
  }
  return out;
}

async function seedOne(s: { key: string; label: string; file: string }): Promise<{ subject: string; sections: number }> {
  const md = readContentFile(`coach-library/${s.file}`);
  const sections = parseCodex(md);
  if (!sections.length) throw new Error(`${s.file}: no §-sections parsed`);

  // house re-seed: drop the prior librarian doc for this file (cascade → brief → §-rows)
  await supabase.from('coach_documents').delete().eq('user_id', LIBRARIAN_ID).eq('filename', s.file);

  const { data: doc, error: docErr } = await supabase.from('coach_documents')
    .insert({ user_id: LIBRARIAN_ID, course_id: null, storage_ref: `library/${s.file}`, filename: s.file, content_type: 'text/markdown' })
    .select('id').single();
  if (docErr || !doc) throw new Error(`${s.file} document: ${docErr?.message || 'insert failed'}`);

  const { data: brief, error: briefErr } = await supabase.from('coach_briefs')
    .insert({ document_id: doc.id, user_id: LIBRARIAN_ID, course_id: null, subject_key: s.key,
              title: s.label, sections, pages: null, declared_gaps: '', distilled_by: 'hand-authored' })
    .select('id').single();
  if (briefErr || !brief) throw new Error(`${s.file} brief: ${briefErr?.message || 'insert failed'}`);

  // the 0040 trigger has laid the §-rows (FTS live); fill the Voyage vectors (non-fatal)
  await embedBriefOnShelve(brief.id);
  return { subject: s.key, sections: sections.length };
}

// Seed the house library. With `only`, seeds just that subject_key (a fallback if the
// full run is slow). Idempotent. Returns a per-subject summary.
export async function seedLibrary(only?: string): Promise<{ subject: string; sections: number }[]> {
  const list = only ? SUBJECTS.filter((s) => s.key === only) : SUBJECTS;
  if (only && !list.length) throw new Error(`unknown subject '${only}'`);
  const out: { subject: string; sections: number }[] = [];
  for (const s of list) out.push(await seedOne(s));
  return out;
}

// The house subjects available to the picker: [{ key, label }], seeded ones only,
// in the authored order.
export async function listLibrary(): Promise<{ key: string; label: string }[]> {
  const { data } = await supabase.from('coach_briefs')
    .select('subject_key, title').eq('user_id', LIBRARIAN_ID).is('superseded_by', null).not('subject_key', 'is', null);
  const seen = new Set<string>();
  for (const r of (data || []) as any[]) if (r.subject_key) seen.add(r.subject_key);
  return SUBJECTS.filter((s) => seen.has(s.key)).map((s) => ({ key: s.key, label: s.label }));
}

// ── house course plan: the codex's own § order becomes the day-by-day spine ──
// (section order = study plan). One § per day; maxDays>0 caps it, 0 = all sections.
export function codexPlan(subjectKey: string, maxDays: number): { day: number; title: string; focus: string }[] {
  const s = SUBJECTS.find((x) => x.key === subjectKey);
  if (!s) return [];
  const heads: string[] = [];
  try {
    const md = readContentFile(`coach-library/${s.file}`);
    for (const line of md.split('\n')) {
      const m = line.match(/^##\s+§\S+\s+(.+?)\s*$/);
      if (m) heads.push(m[1].trim());
    }
  } catch { return []; }
  if (!heads.length) return [];
  const n = Math.max(1, maxDays > 0 ? Math.min(maxDays, heads.length) : heads.length);
  return heads.slice(0, n).map((title, i) => ({ day: i + 1, title, focus: title }));
}

// label lookup for a subject_key (null if not a house subject)
export function subjectMeta(key: string): { key: string; label: string } | null {
  const s = SUBJECTS.find((x) => x.key === key);
  return s ? { key: s.key, label: s.label } : null;
}
