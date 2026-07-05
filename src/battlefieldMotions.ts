// battlefieldMotions.ts — motion tooling for The Battlefield.
//
//   evaluateMotion() — is a PROPOSED motion JUDGEABLE (fact-based, with a knowable
//     evidentiary direction) the way the adjudicator needs? If not, diagnose it and
//     REWRITE it into the nearest judgeable form. Structured tool + temperature 0 —
//     the same discipline as the verdict (no prose-parsing).
//
//   generateMotions() — draft codex-grounded candidate motions for a domain, then
//     keep only the ones evaluateMotion passes. The generator's filter IS the checker.
//
// The codex owns the standard (CORE = the adjudication discipline); this module just
// applies it to a motion before any debate happens.
import Anthropic from '@anthropic-ai/sdk';
import { readContentFile } from './content.js';
import { logUsage } from './usage.js';
import { DOMAIN_LABELS, type DebateDomain } from './battlefieldAdjudicator.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

const CORE = (() => { try { return readContentFile('debate-adjudication-core.md'); } catch { return ''; } })();
// NORMAL-mode overlay for the checker — generous bar for amateur/casual motions.
const CHECK_NORMAL = `\n\n[NORMAL MODE \u2014 you are vetting a motion for AMATEUR / casual practice, not a championship. Be GENEROUS. Pass any motion with ANY reasonable direction to argue \u2014 including light, everyday, or fun topics \u2014 as judgeable \"yes\". Reserve \"no\" for the genuinely unarguable: pure taste with no possible reasoning, incoherent, or not a proposition. Treat what you would call \"borderline\" as \"yes\" here. You may still offer a gentle restructure if it clearly helps, but do NOT gate a beginner's motion behind championship rigor.]`;
const DOMAIN_FILES: Record<DebateDomain, string> = {
  history: 'debate-domain-history.md', economy: 'debate-domain-economy.md', geopolitics: 'debate-domain-geopolitics.md',
  law: 'debate-domain-law.md', democracy: 'debate-domain-democracy.md', philosophy: 'debate-domain-philosophy.md',
  war: 'debate-domain-war.md', technology: 'debate-domain-technology.md', religion: 'debate-domain-religion.md',
  environment: 'debate-domain-environment.md',
};
const _cache: Partial<Record<DebateDomain, string>> = {};
function domainCodex(d: DebateDomain): string {
  if (_cache[d]) return _cache[d]!;
  try { _cache[d] = readContentFile(DOMAIN_FILES[d]); } catch { _cache[d] = ''; }
  return _cache[d]!;
}
const DOMAIN_KEYS = Object.keys(DOMAIN_LABELS) as DebateDomain[];

export type MotionAssessment = {
  judgeable: 'yes' | 'borderline' | 'no';
  issues: string[];
  evidentiaryDirection: string;
  restructured: string;
  suggestedDomain: DebateDomain | 'none';
  note: string;
};

const ASSESS_TOOL = {
  name: 'submit_motion_assessment',
  description: 'Return the structured judgeability assessment of a proposed debate motion.',
  input_schema: {
    type: 'object',
    properties: {
      judgeable: { type: 'string', enum: ['yes', 'borderline', 'no'], description: 'Can the adjudicator rule on this — fact-based, on a knowable evidentiary direction?' },
      issues: { type: 'array', items: { type: 'string', enum: ['values_only', 'vague', 'unfalsifiable', 'loaded', 'tautological', 'compound', 'not_a_proposition', 'none'] }, description: 'What is wrong, if anything. Use ["none"] for a clean motion.' },
      evidentiary_direction: { type: 'string', description: 'What evidence or record would push a fair judge toward one side — or a note that no such direction exists.' },
      restructured: { type: 'string', description: 'The nearest JUDGEABLE rewrite that preserves the intent, phrased "This house believes …". Empty string if already judgeable.' },
      suggested_domain: { type: 'string', enum: [...DOMAIN_KEYS, 'none'], description: 'Best-fit adjudicator domain.' },
      note: { type: 'string', description: 'One or two plain sentences of guidance for the organizer.' },
    },
    required: ['judgeable', 'issues', 'evidentiary_direction', 'restructured', 'suggested_domain', 'note'],
  },
};

function assessSystem(domain?: DebateDomain, difficulty: 'normal' | 'pro' = 'pro'): string {
  const dLine = domain
    ? `The organizer has tagged this to the domain: ${DOMAIN_LABELS[domain]}.`
    : 'No domain was specified — suggest the best fit.';
  return `You are the motion clerk for The Battlefield, applying the adjudicator's discipline to a PROPOSED debate motion, before any debate happens.

${CORE ? 'THE ADJUDICATION DISCIPLINE (your standard):\n' + CORE + '\n\n' : ''}A JUDGEABLE motion is a SINGLE, CLEAR proposition that is FACT-BASED with a KNOWABLE EVIDENTIARY DIRECTION: evidence, logic, and the historical or empirical record could push a fair judge toward one side. Only then can the adjudicator rule on Matter with defensible rigor.

A motion is NOT judgeable (in v1) when it is: a pure VALUE or taste claim with no factual anchor ("X is beautiful / just" with no empirical core); VAGUE or ambiguous; UNFALSIFIABLE; LOADED or question-begging; TAUTOLOGICAL; COMPOUND (two claims in one); or not a proposition at all.

When a motion is not judgeable, do NOT merely reject it — REWRITE it into the nearest judgeable motion that preserves the organizer's evident intent. The standard move is to anchor a values question to an empirical proxy: "capital punishment is just" → "This house believes capital punishment deters serious crime more effectively than life imprisonment." Keep the organizer's subject; give it an evidentiary spine.

${dLine}

Assess the motion and call submit_motion_assessment. Be honest and specific. A clean motion passes with issues ["none"] and an empty restructured field.` + (difficulty === 'normal' ? CHECK_NORMAL : '');
}

export async function evaluateMotion(motion: string, domain?: DebateDomain, userId = 'battlefield', difficulty: 'normal' | 'pro' = 'normal'): Promise<MotionAssessment> {
  const msg: any = await anthropic.messages.create({
    model: MODEL, max_tokens: 700, temperature: 0,
    system: assessSystem(domain, difficulty),
    tools: [ASSESS_TOOL] as any,
    tool_choice: { type: 'tool', name: 'submit_motion_assessment' } as any,
    messages: [{ role: 'user', content: `The proposed motion:\n"${motion}"` }],
  });
  logUsage({ userId, surface: 'other', fn: 'bf_motion_check', model: MODEL, usage: msg.usage });
  const use = (msg.content || []).find((b: any) => b.type === 'tool_use');
  const inp = (use && use.input) || {};
  const jg = inp.judgeable;
  return {
    judgeable: (jg === 'yes' || jg === 'no' || jg === 'borderline') ? jg : 'borderline',
    issues: Array.isArray(inp.issues) ? inp.issues : [],
    evidentiaryDirection: String(inp.evidentiary_direction || ''),
    restructured: String(inp.restructured || ''),
    suggestedDomain: (DOMAIN_KEYS.indexOf(inp.suggested_domain) >= 0 ? inp.suggested_domain : 'none'),
    note: String(inp.note || ''),
  };
}

// draft codex-grounded candidate motions for a domain, then keep only the judgeable.
export async function generateMotions(domain: DebateDomain, n = 12, userId = 'battlefield', tier: 'light' | 'pro' = 'pro'): Promise<{ kept: any[]; dropped: any[]; raw: string[] }> {
  const codex = domainCodex(domain);
  const sys = tier === 'light'
    ? `You draft LIGHT, ACCESSIBLE debate motions for AMATEUR / casual players — everyday, relatable, even fun, but still genuinely ARGUABLE with a real direction (not pure taste). Produce ${n} distinct motions a beginner would enjoy and could argue both sides of, loosely themed to the domain. Phrase each as "This house believes …". Concrete, low-jargon. Output ONLY a JSON array of strings, nothing else.`
    : `You draft DEBATE MOTIONS grounded in a domain's knowledge codex. Produce ${n} distinct, FACT-BASED motions this codex could adjudicate — each a single clear proposition with a knowable evidentiary direction, drawn from the codex's live debates and contested claims. Phrase each as "This house believes …". No pure value/taste claims, no compound motions, no vague ones. Output ONLY a JSON array of strings, nothing else.`;
  const userMsg = tier === 'light'
    ? `DOMAIN THEME: ${DOMAIN_LABELS[domain]}\n\nDraft ${n} light, accessible motions now.`
    : `DOMAIN: ${DOMAIN_LABELS[domain]}\n\n=== CODEX ===\n${codex}\n=== END CODEX ===\n\nDraft ${n} motions now.`;
  const msg: any = await anthropic.messages.create({
    model: MODEL, max_tokens: 1500, temperature: tier === 'light' ? 0.8 : 0.5,
    system: sys,
    messages: [{ role: 'user', content: userMsg }],
  });
  logUsage({ userId, surface: 'other', fn: 'bf_motion_gen', model: MODEL, usage: msg.usage });
  const text = (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  let candidates: string[] = [];
  try {
    const a = text.indexOf('['), b = text.lastIndexOf(']');
    if (a >= 0 && b > a) candidates = JSON.parse(text.slice(a, b + 1));
  } catch { candidates = []; }
  candidates = candidates.filter((x) => typeof x === 'string' && x.length > 10).slice(0, n);
  const kept: any[] = [], dropped: any[] = [];
  for (const m of candidates) {
    const asmt = await evaluateMotion(m, domain, userId, tier === 'light' ? 'normal' : 'pro');
    if (asmt.judgeable === 'yes') kept.push({ motion: m, domain, note: asmt.note });
    else dropped.push({ motion: m, judgeable: asmt.judgeable, issues: asmt.issues, restructured: asmt.restructured });
  }
  return { kept, dropped, raw: candidates };
}
