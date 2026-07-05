// battlefieldAdjudicator.ts — THE ADJUDICATOR (Tyrion), the judge of The Battlefield.
//
// Runs entirely on callmeZ's own engine (NOT DreamAI). Architecture mirrors DreamAI's
// analyst pattern:
//   ALWAYS-ON (his permanent discipline, cached):  soul + Adjudication Universal Core
//   PER-DEBATE (loaded as required):                one Format Module + one Domain Codex
//
// Two model calls in a duel's life:
//   • runningNote()  — after each completed exchange, one razor line (the commentary track)
//   • finalVerdict() — the full Matter/Manner adjudication when the debate is ripe
//
// The codex owns HOW he judges; deterministic game code owns turns/phases/floors.
import Anthropic from '@anthropic-ai/sdk';
import { readContentFile } from './content.js';
import { logUsage } from './usage.js';
import { extractIndex, indexAsText, sliceSection } from './codexRetrieval.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

// ── load the always-on pieces once at boot (his permanent self) ──
const SOUL = (() => { try { return readContentFile('debate-adjudicator-soul.md'); } catch { return ''; } })();
const CORE = (() => { try { return readContentFile('debate-adjudication-core.md'); } catch { return ''; } })();

// ── the per-debate domain codexes, keyed. Loaded lazily, held after first read. ──
export type DebateDomain =
  | 'history' | 'economy' | 'geopolitics' | 'law' | 'democracy'
  | 'philosophy' | 'war' | 'technology' | 'religion' | 'environment';

const DOMAIN_FILES: Record<DebateDomain, string> = {
  history:     'debate-domain-history.md',
  economy:     'debate-domain-economy.md',
  geopolitics: 'debate-domain-geopolitics.md',
  law:         'debate-domain-law.md',
  democracy:   'debate-domain-democracy.md',
  philosophy:  'debate-domain-philosophy.md',
  war:         'debate-domain-war.md',
  technology:  'debate-domain-technology.md',
  religion:    'debate-domain-religion.md',
  environment: 'debate-domain-environment.md',
};
const _domainCache: Partial<Record<DebateDomain, string>> = {};
function domainCodex(d: DebateDomain): string {
  if (_domainCache[d]) return _domainCache[d]!;
  try { _domainCache[d] = readContentFile(DOMAIN_FILES[d]); } catch { _domainCache[d] = ''; }
  return _domainCache[d]!;
}

export const DOMAIN_LABELS: Record<DebateDomain, string> = {
  history: "History's Turning Points", economy: 'The Global Economy',
  geopolitics: 'Geopolitics & World Order', law: 'Law, Justice & Rights',
  democracy: 'Democracy & Governance', philosophy: 'Political Philosophy & Ethics',
  war: 'War, Security & Just War', technology: 'Technology Governance',
  religion: 'Religion, Secularism & the State', environment: 'Environment & Climate Policy',
};

// The always-on prefix — his soul + his judging discipline + the INDEX of the domain
// (section headers only, so he knows what he can consult). NOT the whole codex — he
// retrieves the sections he needs, the way an expert consults his prepared material,
// so his attention stays focused instead of drowning in the full text.
function staticPrefix(domain: DebateDomain): string {
  const dLabel = DOMAIN_LABELS[domain];
  const idx = indexAsText(extractIndex(domainCodex(domain)));
  return (
    SOUL +
    '\n\n[YOUR DISCIPLINE — the method of adjudication itself, always open to you. You judge through it constantly and draw on it as your own mastery; you never name it, never call it a codex or a reference. There is only you and what the floor gives you.]\n' +
    CORE +
    `\n\n[YOUR PREPARED MATERIAL for this motion — the field is ${dLabel}. You have studied it cold. Below is only the INDEX of what you prepared. When you need to verify a claim, check the strongest counter, or settle a factual dispute, CONSULT THE RELEVANT SECTION with the read_section tool — do not rely on vague memory; pull the section and read it. Section 8 is your fact-check notes; consult it whenever a factual claim is in play. If the material is silent on a claim, you never invent a fact-check and you never bring in a fact neither debater raised — you name the claim as unverified and weigh it on its logic alone. You never name this material to the debaters; you speak from it as your own knowledge.]\n\nINDEX:\n${idx}\n`
  );
}

// ── the adjudicator's tools (Donna's toolset) ──
// ── the adjudicator's tools (Donna's toolset) — codex retrieval only in v1. ──
// NO web search: the adjudicator judges on his prepared material + what was said on the
// floor. He never introduces facts neither debater raised. When the codex is silent, the
// soul's iron rule applies (name it unverified, weigh on logic). Web verification is a
// deliberate v2 decision, not a default.
const ADJ_TOOLS = [
  {
    name: 'read_section',
    description: "Retrieve one section of your prepared material by its number (e.g. '5' or '8' or '3.2'). Use it to verify a claim a debater made, check the strongest counter-argument, or read your fact-check notes before ruling. Always consult the relevant section before striking a claim as fabricated.",
    input_schema: {
      type: 'object' as const,
      properties: { section: { type: 'string', description: "The section number, e.g. '8'." } },
      required: ['section'],
    },
  },
];

// The verdict is returned as STRUCTURED DATA via this tool — never parsed from prose.
// The winner is an explicit enum, so it can never disagree with the reasoning or drift
// with the model's formatting. This is the root fix for the winner-flip.
const SUBMIT_VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Submit your final adjudication as structured data. Call this exactly once, at the very end, after you have consulted whatever material you needed. The winner MUST be the side your matter and manner audits favour.',
  input_schema: {
    type: 'object' as const,
    properties: {
      winner: { type: 'string', enum: ['PRO', 'CON'], description: 'The side that won the debate on the merits. Must match your audits.' },
      summary: { type: 'string', description: '2-3 sentences: the core clash and where it was decided.' },
      matter: { type: 'string', description: '2-3 sentences: the substance/fact audit; name any fabrication struck or any claim left unverified.' },
      manner: { type: 'string', description: '2-3 sentences: the delivery audit for both sides.' },
      verdict_line: { type: 'string', description: 'One line: who wins on Matter and why.' },
      closing: { type: 'string', description: 'One sharp closing line, in your voice.' },
    },
    required: ['winner', 'summary', 'matter', 'manner', 'verdict_line', 'closing'],
  },
};

// The verdict loop: read_section retrieval is available for the adjudicator to consult
// consult, and the debate ENDS when it calls submit_verdict with structured data. The
// winner is read from the enum field — NEVER parsed from prose. On failure we throw
// loudly (the caller surfaces it); we never fabricate a default winner.
async function runVerdictWithTools(domain: DebateDomain, system: string, userContent: string, userId: string): Promise<Verdict> {
  const messages: any[] = [{ role: 'user', content: userContent }];
  const codex = domainCodex(domain);
  const tools = [...ADJ_TOOLS, SUBMIT_VERDICT_TOOL];
  let sawText = '';
  for (let hop = 0; hop < 6; hop++) {
    const forceVerdict = hop === 5; // last hop: force the verdict tool
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: 2000, temperature: 0, system,
      tools: tools as any,
      tool_choice: forceVerdict ? ({ type: 'tool', name: 'submit_verdict' } as any) : ({ type: 'auto' } as any),
      messages,
    });
    logUsage({ userId, surface: 'other', fn: 'bf_verdict', model: MODEL, usage: msg.usage });
    const blocks = msg.content || [];
    sawText = blocks.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n') || sawText;
    const verdictCall = blocks.find((b: any) => b.type === 'tool_use' && b.name === 'submit_verdict');
    if (verdictCall) {
      const v = (verdictCall as any).input || {};
      const winner = String(v.winner || '').toUpperCase() === 'CON' ? 'CON'
                   : String(v.winner || '').toUpperCase() === 'PRO' ? 'PRO' : null;
      if (!winner) throw new Error('submit_verdict returned no valid winner enum: ' + JSON.stringify(v).slice(0, 300));
      // if the tool call was truncated mid-generation (max_tokens), the later fields
      // (matter/manner/closing) can arrive empty. Don't ship a hollow verdict — nudge one
      // re-submit asking ONLY for the missing prose, kept short so it fits.
      const matterEmpty = !String(v.matter || '').trim();
      const mannerEmpty = !String(v.manner || '').trim();
      if ((matterEmpty || mannerEmpty) && msg.stop_reason === 'max_tokens' && hop < 5) {
        messages.push({ role: 'assistant', content: blocks });
        messages.push({ role: 'user', content: `Your submit_verdict was cut off before the audits were complete. Call submit_verdict again with the SAME winner (${winner}) and summary, but keep matter and manner to 2 tight sentences each so nothing is lost.` });
        continue;
      }
      return {
        winner,
        summary: String(v.summary || '').slice(0, 1200),
        matter: String(v.matter || '').slice(0, 1200),
        manner: String(v.manner || '').slice(0, 1200),
        adjVerdict: String(v.verdict_line || '').slice(0, 600),
        closing: String(v.closing || '').slice(0, 400),
        raw: JSON.stringify(v).slice(0, 4000),
      };
    }
    const otherTools = blocks.filter((b: any) => b.type === 'tool_use' && b.name !== 'submit_verdict');
    if (!otherTools.length) {
      // model produced text but didn't submit — nudge it to submit on the next hop
      messages.push({ role: 'assistant', content: blocks });
      messages.push({ role: 'user', content: 'Now call submit_verdict with your structured adjudication.' });
      continue;
    }
    // execute retrieval/search tools, feed results back
    messages.push({ role: 'assistant', content: blocks });
    const results: any[] = [];
    for (const tu of otherTools) {
      let out = '';
      try {
        if (tu.name === 'read_section') {
          const sec = sliceSection(codex, String(tu.input?.section ?? ''));
          out = sec || `(no section '${tu.input?.section}' found in the material)`;
        }
      } catch (e: any) { out = `(tool error: ${e?.message || e})`; }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.slice(0, 6000) });
    }
    messages.push({ role: 'user', content: results });
  }
  // exhausted hops without a structured verdict — do NOT fabricate a winner.
  throw new Error('adjudicator did not submit a structured verdict after 6 hops. last text: ' + sawText.slice(0, 300));
}

// ── after each completed exchange: one live diagnostic line (the commentary track) ──
// Light + fast: no tools, whole-of-exchange is tiny. Determinism via temperature 0.
export async function runningNote(args: {
  domain: DebateDomain; motion: string;
  seatA_role: string; seatB_role: string;
  lastExchange: { seat: 0 | 1; role: string; text: string }[];
  momentumA: number;
}): Promise<{ swing: number; note: string }> {
  const transcript = args.lastExchange
    .map((s) => `${s.seat === 0 ? 'PRO' : 'CON'} (${s.role}): ${s.text}`).join('\n\n');
  const system = staticPrefix(args.domain) +
    `\n\n[TASK: You have just heard ONE completed exchange. Drop your single-sentence live adjudicator note in your own forensic voice — name what landed and what was dropped. Then give the momentum swing.\nOutput EXACTLY two lines, nothing else:\nSWING: <integer -15..15, positive favours PRO, negative favours CON — on MERIT, never on the side>\nNOTE: <one razor line, under 22 words, your live read of this exchange>]`;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 120, temperature: 0, system,
      messages: [{ role: 'user', content: `MOTION: ${args.motion}\nMOMENTUM: PRO ${args.momentumA} / CON ${100 - args.momentumA}\n\nTHE EXCHANGE:\n${transcript}` }],
    });
    logUsage({ userId: 'battlefield', surface: 'other', fn: 'bf_running_note', model: MODEL, usage: (msg as any).usage });
    const text = ((msg.content?.[0] as any)?.text ?? '');
    const swing = Math.max(-15, Math.min(15, parseInt(/SWING:\s*(-?\d+)/.exec(text)?.[1] ?? '0', 10) || 0));
    const note = (/NOTE:\s*(.+)/.exec(text)?.[1] ?? '').trim().slice(0, 200);
    return { swing, note };
  } catch { return { swing: 0, note: '' }; }
}

// ── the final verdict: the full Matter/Manner adjudication report ──
export type Verdict = {
  winner: 'PRO' | 'CON';
  summary: string;
  matter: string;
  manner: string;
  adjVerdict: string;   // who wins on Matter, one line
  closing: string;
  raw: string;          // full text, for display fallback
};

export async function finalVerdict(args: {
  domain: DebateDomain; motion: string;
  fullTranscript: { seat: 0 | 1; role: string; text: string }[];
}): Promise<Verdict> {
  const transcript = args.fullTranscript
    .map((s) => `${s.seat === 0 ? 'PRO' : 'CON'} (${s.role}): ${s.text}`).join('\n\n');
  const system = staticPrefix(args.domain) +
    `\n\n[TASK: The debate has concluded. Before you rule, CONSULT your prepared material with read_section: verify the key factual claims and check the strongest counters (start with section 8, your fact-check notes, whenever a factual claim is in play). You judge only on what the debaters said and what your material supports — you never introduce a fact neither side raised. Judge the debating, not the position; identical standard for PRO and CON regardless of assigned side. Weigh Matter (50%: logic, evidence, factual accuracy — apply the iron fact-check rule) and Manner (50%: delivery, structure, control).

When you have finished consulting, call submit_verdict exactly once with your structured adjudication. The winner field MUST be the side your matter and manner audits favour — it cannot contradict your own reasoning. Write the prose fields (summary, matter, manner, verdict_line, closing) in your own forensic voice.]`;
  try {
    const v = await runVerdictWithTools(args.domain, system, `MOTION: ${args.motion}\n\nFULL TRANSCRIPT:\n${transcript}`, 'battlefield');
    return v;
  } catch (e: any) {
    // NEVER fabricate a winner on failure. Surface the error loudly so it can't be
    // laundered into a real-looking verdict.
    console.error('[battlefield] verdict failed — NOT defaulting a winner:', e?.message || e);
    throw new Error('adjudication_failed: ' + (e?.message || String(e)));
  }
}

// health/diagnostic: confirm the always-on pieces actually loaded
export function adjudicatorReady(): { soul: boolean; core: boolean; domains: number } {
  const domains = (Object.keys(DOMAIN_FILES) as DebateDomain[]).filter((d) => domainCodex(d).length > 0).length;
  return { soul: SOUL.length > 0, core: CORE.length > 0, domains };
}
