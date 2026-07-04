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
    `\n\n[YOUR PREPARED MATERIAL for this motion — the field is ${dLabel}. You have studied it cold. Below is only the INDEX of what you prepared. When you need to verify a claim, check the strongest counter, or settle a factual dispute, CONSULT THE RELEVANT SECTION with the read_section tool — do not rely on vague memory; pull the section and read it. Section 8 is your fact-check notes; consult it whenever a factual claim is in play. If the material is silent on a live/contested fact, you may web_search to verify — but never invent a fact-check. You never name this material to the debaters; you speak from it as your own knowledge.]\n\nINDEX:\n${idx}\n`
  );
}

// ── the adjudicator's tools (Donna's toolset) ──
const ADJ_TOOLS = [
  {
    name: 'read_section',
    description: "Retrieve one section of your prepared material by its number (e.g. '5' or '8' or '3.2'). Use it to verify a claim, check the strongest counter-argument, or read your fact-check notes before ruling. Always consult the relevant section before striking a claim as fabricated.",
    input_schema: {
      type: 'object' as const,
      properties: { section: { type: 'string', description: "The section number, e.g. '8'." } },
      required: ['section'],
    },
  },
  {
    name: 'web_search',
    description: 'Search the web to verify a specific factual claim that your prepared material does not cover. Use ONLY for live/contested facts you cannot verify from your material. Never use it to form opinions — only to check facts.',
    input_schema: {
      type: 'object' as const,
      properties: { query: { type: 'string', description: 'A precise factual query.' } },
      required: ['query'],
    },
  },
];

// run the tool-use loop: let the adjudicator retrieve/search until it delivers text.
async function runWithTools(domain: DebateDomain, system: string, userContent: string, maxTokens: number, userId: string): Promise<string> {
  const messages: any[] = [{ role: 'user', content: userContent }];
  const codex = domainCodex(domain);
  for (let hop = 0; hop < 5; hop++) {
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: maxTokens, temperature: 0, system,
      tools: ADJ_TOOLS as any,
      messages,
    });
    logUsage({ userId, surface: 'other', model: MODEL, usage: msg.usage });
    const toolUses = (msg.content || []).filter((b: any) => b.type === 'tool_use');
    if (!toolUses.length) {
      // done — return the text
      return (msg.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
    }
    // execute the tools, feed results back
    messages.push({ role: 'assistant', content: msg.content });
    const results: any[] = [];
    for (const tu of toolUses) {
      let out = '';
      try {
        if (tu.name === 'read_section') {
          const sec = sliceSection(codex, String(tu.input?.section ?? ''));
          out = sec || `(no section '${tu.input?.section}' found in the material)`;
        } else if (tu.name === 'web_search') {
          out = await webSearch(String(tu.input?.query ?? ''));
        }
      } catch (e: any) { out = `(tool error: ${e?.message || e})`; }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: out.slice(0, 6000) });
    }
    messages.push({ role: 'user', content: results });
  }
  // ran out of hops — force a final answer without tools
  const final: any = await anthropic.messages.create({
    model: MODEL, max_tokens: maxTokens, temperature: 0, system,
    messages: [...messages, { role: 'user', content: 'Deliver your final answer now, in the required format, using no further tools.' }],
  });
  logUsage({ userId, surface: 'other', model: MODEL, usage: final.usage });
  return (final.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
}

// minimal web search via the same tool the rest of the engine uses, if present; else
// a graceful "unavailable" so the adjudicator falls back to corpus-silence discipline.
async function webSearch(query: string): Promise<string> {
  try {
    const key = process.env.BRAVE_API_KEY || process.env.SEARCH_API_KEY;
    if (!key) return '(web search unavailable — treat as: material silent, weigh on logic alone)';
    const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=3`, {
      headers: { 'X-Subscription-Token': key, Accept: 'application/json' },
    });
    if (!r.ok) return '(web search failed — treat as: material silent)';
    const d: any = await r.json();
    const items = (d?.web?.results ?? []).slice(0, 3).map((it: any) => `• ${it.title}: ${it.description}`).join('\n');
    return items || '(no results — treat as: material silent)';
  } catch { return '(web search error — treat as: material silent)'; }
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
    logUsage({ userId: 'battlefield', surface: 'other', model: MODEL, usage: (msg as any).usage });
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
    `\n\n[TASK: The debate has concluded. Before you rule, CONSULT your prepared material: read the sections you need to verify the key factual claims and check the strongest counters (start with section 8, your fact-check notes, whenever a factual claim is in play). Then deliver your FINAL ADJUDICATION in your voice, mobile-legible. Judge the debating, not the position; identical standard for PRO and CON regardless of assigned side. Use Matter (50%: logic, evidence, factual accuracy — apply the iron fact-check rule) and Manner (50%: delivery, structure, control).

CRITICAL OUTPUT RULES:
- Decide the winner FIRST and put it on the first line.
- Use PLAIN labels exactly as shown. NO markdown, NO asterisks, NO bold. Each label starts a new line.
- Your WINNER line must agree with your reasoning: whichever side your Matter+Manner audit favours IS the winner.

Output EXACTLY these labelled lines and nothing else:
WINNER: PRO
SUMMARY: <2-3 sentences — the core clash and where it was decided>
MATTER: <2-3 sentences — the substance/fact audit; name any fabrication struck or any claim left unverified>
MANNER: <2-3 sentences — the delivery audit for both sides>
VERDICT: <one line — who wins on Matter and why>
CLOSING: <one sharp closing line>

(Replace PRO on the WINNER line with CON if CON won. No other text.)]`;
  try {
    const text = await runWithTools(args.domain, system, `MOTION: ${args.motion}\n\nFULL TRANSCRIPT:\n${transcript}`, 1200, 'battlefield');
    const clean = text.replace(/\*\*/g, '');
    const LABELS = ['WINNER', 'SUMMARY', 'MATTER', 'MANNER', 'VERDICT', 'CLOSING'];
    const grab = (label: string) => {
      const re = new RegExp(`^\\s*${label}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:${LABELS.join('|')})\\s*:|$)`, 'im');
      return (re.exec(clean)?.[1] ?? '').trim();
    };
    const winnerRaw = grab('WINNER').toUpperCase();
    const w = /\bCON\b/.test(winnerRaw) && !/\bPRO\b/.test(winnerRaw) ? 'CON'
            : /\bPRO\b/.test(winnerRaw) && !/\bCON\b/.test(winnerRaw) ? 'PRO'
            : /\bCON\b/.test(winnerRaw) ? 'CON' : 'PRO';
    return {
      winner: w as 'PRO' | 'CON',
      summary: grab('SUMMARY').slice(0, 1200),
      matter: grab('MATTER').slice(0, 1200),
      manner: grab('MANNER').slice(0, 1200),
      adjVerdict: grab('VERDICT').slice(0, 600),
      closing: grab('CLOSING').slice(0, 400),
      raw: clean.slice(0, 4000),
    };
  } catch (e) {
    return { winner: 'PRO', summary: 'The adjudicator retires to chambers.', matter: '', manner: '', adjVerdict: '', closing: 'The floor is cleared.', raw: '' };
  }
}

// health/diagnostic: confirm the always-on pieces actually loaded
export function adjudicatorReady(): { soul: boolean; core: boolean; domains: number } {
  const domains = (Object.keys(DOMAIN_FILES) as DebateDomain[]).filter((d) => domainCodex(d).length > 0).length;
  return { soul: SOUL.length > 0, core: CORE.length > 0, domains };
}
