// memoryGardener.ts — THE NIGHTLY GARDENER for per-user memory (z.memory).
//
// [zip03] The janitor the table never had. The harvester (memory.ts) guards the
// GATE; the gardener tends what's already INSIDE: it merges duplicates, resolves
// contradictions (newest wins), pulls transient/situational weeds, and evicts
// third-party facts that slipped in before the gate was hardened (the Vaibhav rows).
//
// Design laws:
//   - The MODEL proposes actions on numbered rows; the CODE applies them. The model
//     never writes SQL and never invents new facts — it may only DELETE rows or
//     REWRITE a survivor's wording when merging duplicates.
//   - Conservative: when unsure, KEEP. Bits are kept unless literal duplicates.
//   - Temperature 0, structured JSON out (the adjudicator discipline: no prose-parsing).
//   - Runs nightly via overseer-run (Railway cron) + on-demand via the founder-gated
//     endpoint POST /memory/garden (the one-time cleanup lever).
import { supabase } from './db.js';
import Anthropic from '@anthropic-ai/sdk';
import { llm, firstText } from './llm.js';
import { logUsage } from './usage.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

type Row = { id: string; kind: string; key: string | null; value: string; updated_at: string };
export type GardenSummary = { userId: string; rows: number; deleted: number; rewritten: number; skipped?: string };

export async function gardenUserMemory(userId: string): Promise<GardenSummary> {
  const { data } = await supabase
    .from('memory')
    .select('id, kind, key, value, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: true });
  const rows = (data ?? []) as Row[];
  if (rows.length < 2) return { userId, rows: rows.length, deleted: 0, rewritten: 0, skipped: 'too few rows' };

  const numbered = rows.map((r, i) =>
    `${i}. [${r.kind}]${r.key ? ' (' + r.key + ')' : ''} ${r.value}   — updated ${r.updated_at.slice(0, 10)}`).join('\n');

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0,
    system:
      'You are the memory gardener. You are given the numbered memory rows of ONE user, oldest first. Propose cleanup actions ONLY as JSON. The laws: '
      + '(1) DUPLICATES — rows stating the same fact (even worded differently): keep ONE (prefer the newest / most complete), delete the rest; you may rewrite the survivor to the best merged wording. '
      + '(2) CONTRADICTIONS — rows that cannot both be true: the newest wins; delete the older. '
      + '(3) TRANSIENT WEEDS — passing states stored as facts ("not investing at this time", a mood, a today-plan): delete. '
      + '(4) THIRD-PARTY FACTS — rows clearly about a public figure, celebrity, or someone the user was merely discussing (a cricketer\'s debut, an actor\'s tour, a politician\'s statement) rather than the user\'s own life: delete. Biographical claims that fit a known public figure and sit oddly beside the user\'s other rows are third-party. '
      + '(5) PERFORMED STANCES — beliefs or positions that read as debate stances, spar sides, or argument-practice postures rather than sincere life facts ("believes X always beats Y" with no life context): delete. '   // [zip46]
      + '(6) MIRROR ROWS — rows describing the AI friend or any persona (their manner, their advice style, what they offer or are like) rather than the user: delete. '
      + '(7) META ROWS — rows about this app itself, its personas, features, tests, product plans, or the conversation ("discussed the wingman persona", "running a tour/feature"): delete. '
      + '(8) NEVER invent facts, never rewrite meaning, never touch rows you are unsure about — when in doubt, KEEP. [bit] rows are kept unless literal duplicates — and a bit that describes the FRIEND\'S service rather than the friendship\'s shared color is a mirror row: delete. '
      + 'Return ONLY {"delete":[row numbers],"rewrite":[{"i":row number,"value":"new wording"}]} — valid JSON, no prose, no markdown.',
    messages: [{ role: 'user', content: `THE ROWS:\n${numbered}` }],
  });
  try { logUsage({ userId, threadId: null, personaKey: null, surface: 'other', fn: 'memory_garden', model: MODEL, usage: (resp as any).usage }); } catch {}

  const raw = (firstText(resp) || '{}');
  let plan: { delete?: number[]; rewrite?: { i: number; value: string }[] } = {};
  try { plan = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch { return { userId, rows: rows.length, deleted: 0, rewritten: 0, skipped: 'unparseable plan' }; }

  const delIdx = Array.isArray(plan.delete) ? plan.delete.filter((n) => Number.isInteger(n) && n >= 0 && n < rows.length) : [];
  const rewrites = Array.isArray(plan.rewrite) ? plan.rewrite.filter((r) => r && Number.isInteger(r.i) && r.i >= 0 && r.i < rows.length && typeof r.value === 'string' && r.value.trim().length > 0 && !delIdx.includes(r.i)) : [];

  // safety valve: a plan that wants to raze the garden is a bad plan — never delete
  // more than half the rows in one pass. (The founder can run it twice.)
  if (delIdx.length > Math.ceil(rows.length / 2)) {
    return { userId, rows: rows.length, deleted: 0, rewritten: 0, skipped: `plan wanted ${delIdx.length}/${rows.length} deletions — refused` };
  }

  let deleted = 0, rewritten = 0;
  if (delIdx.length) {
    const ids = delIdx.map((i) => rows[i].id);
    const { error } = await supabase.from('memory').delete().in('id', ids);
    if (!error) deleted = ids.length;
  }
  for (const rw of rewrites) {
    const { error } = await supabase.from('memory')
      .update({ value: rw.value.trim(), updated_at: new Date().toISOString() })
      .eq('id', rows[rw.i].id);
    if (!error) rewritten += 1;
  }
  console.log(`[gardener] user=${userId} rows=${rows.length} deleted=${deleted} rewritten=${rewritten}`);
  return { userId, rows: rows.length, deleted, rewritten };
}

// Nightly sweep: every user who has memory rows. Small delay between users so the
// cron never bursts the API. Failures are per-user and never abort the sweep.
export async function gardenAllUsers(): Promise<{ users: number; deleted: number; rewritten: number }> {
  const { data } = await supabase.from('memory').select('user_id');
  const ids: string[] = Array.from(new Set<string>((data ?? []).map((r: any) => String(r.user_id))));
  let deleted = 0, rewritten = 0, users = 0;
  for (const uid of ids) {
    try {
      const s = await gardenUserMemory(uid);
      users += 1; deleted += s.deleted; rewritten += s.rewritten;
    } catch (e: any) { console.error(`[gardener] user=${uid} failed:`, e?.message || e); }
    await new Promise((r) => setTimeout(r, 800));
  }
  return { users, deleted, rewritten };
}
