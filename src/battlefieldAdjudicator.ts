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
import { llm, firstText } from './llm.js';
import { readContentFile } from './content.js';
import { logUsage } from './usage.js';
import { extractIndex, indexAsText, sliceSection } from './codexRetrieval.js';

const anthropic = llm();   // [zip34] the second generator — provider-routable
const MODEL = 'claude-haiku-4-5-20251001';

// ── load the always-on pieces once at boot (his permanent self) ──
const SOUL = (() => { try { return readContentFile('debate-adjudicator-soul.md'); } catch { return ''; } })();
const CORE = (() => { try { return readContentFile('debate-adjudication-core.md'); } catch { return ''; } })();

// NORMAL-mode overlays — appended only when difficulty==='normal'. PRO is unchanged.
const VERDICT_NORMAL = `\n\n[NORMAL MODE \u2014 you are judging AMATEUR debaters, not a championship final. Keep every ounce of HONESTY \u2014 never lie about who won, never invent praise \u2014 but change your BEDSIDE MANNER completely. Lead with what each side did WELL. Frame every weakness as a next step (\"next time, answer their strongest point first\"), never as a wound. Reward clear thinking, a genuine attempt to engage, and courage under pressure \u2014 do NOT demand citations or championship rigor from beginners, and do NOT strike honest-but-unsupported claims as if they were fabrications. If there was little real clash, say so gently and SHOW them what a clash would look like, rather than declaring the debate void. Warm, plain, generous: a beginner must leave wanting to debate again. You are the encouraging coach who still tells the truth \u2014 not the executioner.]`;
const NOTE_NORMAL = `\n\n[NORMAL MODE: keep the note WARM and instructive \u2014 name what landed and one thing to try next, encouragingly. Not a savage read.]`;

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
// exported for diagnostics: the cache lever's contract is that this string is
// byte-identical across a duel's every adjudicator call (notes through verdict) —
// provable by calling it twice and comparing (CE condition 3's gate).
export function staticPrefix(domain: DebateDomain): string {
  const dLabel = DOMAIN_LABELS[domain];
  const idx = indexAsText(extractIndex(domainCodex(domain)));
  return (
    SOUL +
    '\n\n[YOUR DISCIPLINE — the method of adjudication itself, always open to you. You judge through it constantly and draw on it as your own mastery; you never name it, never call it a codex or a reference. There is only you and what the floor gives you.]\n' +
    CORE +
    `\n\n[YOUR PREPARED MATERIAL for this motion — the field is ${dLabel}. You have studied it cold. Below is only the INDEX of what you prepared; when you rule, the relevant sections are opened to you alongside the floor (section 8 is your fact-check notes). If the material is silent on a claim, you never invent a fact-check and you never bring in a fact neither debater raised — you name the claim as unverified and weigh it on its logic alone. You never name this material to the debaters; you speak from it as your own knowledge.]\n\nINDEX:\n${idx}\n`
  );
}

// ── DETERMINISTIC section pre-selection (LITE, CE condition 2) ──
// The verdict no longer runs a retrieval tool-loop (each hop resent transcript+corpus —
// the ~94% cost line item). Instead the relevant sections are picked HERE, by pure
// keyword overlap against the index — index/keyword selection, NO model call, so it
// never counts as a hop. Section 8 (the fact-check notes) is always opened; the top two
// index entries sharing content words with the motion join it. Deterministic by
// construction: stable scoring, ties broken by section order.
// NO web search stands: the adjudicator judges on his prepared material + what was said
// on the floor. When the material is silent, the soul's iron rule applies (name it
// unverified, weigh on logic). Web verification is a deliberate v2 decision.
const MOTION_STOPWORDS = new Set([
  'this', 'house', 'believes', 'that', 'the', 'than', 'more', 'most', 'have', 'does',
  'their', 'them', 'they', 'with', 'from', 'into', 'over', 'under', 'between', 'rather',
  'should', 'would', 'been', 'were', 'when', 'what', 'which', 'other', 'only', 'both',
]);
const SECTION_SLICE_CAP = 6000;      // per-section chars (matches the old tool_result cap)
const PREPARED_TOTAL_CAP = 14000;    // total prepared-material chars per verdict

export function pickSections(domain: DebateDomain, motion: string): { ids: string[]; text: string } {
  const codex = domainCodex(domain);
  const idx = extractIndex(codex);
  const words = [...new Set(
    motion.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/)
      .filter((w) => w.length > 3 && !MOTION_STOPWORDS.has(w))
  )];
  // score section BODIES, not titles — the codexes' index titles are structurally
  // uniform ("The factual record"), so title overlap is blind; the bodies carry the
  // motion's actual subject. Occurrence count discriminates (verified across the bank:
  // §4 tops every motion, the right section for a fact-checking bench beside §8).
  const scored = idx
    .filter((s) => s.id !== '8')
    .map((s, i) => {
      const body = (sliceSection(codex, s.id) || '').toLowerCase();
      let score = 0;
      for (const w of words) {
        const m = body.match(new RegExp('\\b' + w.replace(/[^a-z]/g, ''), 'g'));
        score += m ? m.length : 0;
      }
      return { id: s.id, score, order: i };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => (b.score - a.score) || (a.order - b.order))
    .slice(0, 2);
  const ids = ['8', ...scored.map((s) => s.id)];
  const parts: string[] = [];
  let total = 0;
  for (const id of ids) {
    const sec = (sliceSection(codex, id) || '').slice(0, SECTION_SLICE_CAP);
    if (!sec) continue;
    if (total + sec.length > PREPARED_TOTAL_CAP) break;
    parts.push(sec);
    total += sec.length;
  }
  return { ids, text: parts.join('\n\n') };
}

// The verdict is returned as STRUCTURED DATA via this tool — never parsed from prose.
// The winner is an explicit enum, so it can never disagree with the reasoning or drift
// with the model's formatting. This is the root fix for the winner-flip.
//
// THE REFUSAL LIVES IN THE SCHEMA (LITE, CE condition 1): tool_choice forces this tool
// on the first hop, which removes the model's ability to refuse by NOT calling it — so
// the refusal is now an explicit enum value. A transcript too thin, garbled, or empty
// to adjudicate honestly returns winner=ADJUDICATION_FAILED with a failure_reason; the
// caller maps it onto the exact same failure path loop-exhaustion used to reach. A
// fabricated winner in perfect schema is the precise failure this exists to prevent.
const SUBMIT_VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Submit your final adjudication as structured data. Call this exactly once. The winner MUST be the side your matter and manner audits favour. If the transcript cannot be adjudicated honestly (empty, gibberish, no genuine arguments on either side), set winner to ADJUDICATION_FAILED with a failure_reason — NEVER fabricate a winner from a transcript that gave you nothing to judge.',
  input_schema: {
    type: 'object' as const,
    properties: {
      winner: { type: 'string', enum: ['PRO', 'CON', 'ADJUDICATION_FAILED'], description: 'The side that won on the merits — must match your audits. ADJUDICATION_FAILED only when no honest adjudication is possible.' },
      failure_reason: { type: 'string', description: 'Required when winner is ADJUDICATION_FAILED: one plain sentence on why the transcript could not be judged. Empty string otherwise.' },
      summary: { type: 'string', description: '2-3 sentences: the core clash and where it was decided.' },
      matter: { type: 'string', description: '2-3 sentences: the substance/fact audit; name any fabrication struck or any claim left unverified.' },
      manner: { type: 'string', description: '2-3 sentences: the delivery audit for both sides.' },
      verdict_line: { type: 'string', description: 'One line: who wins on Matter and why.' },
      closing: { type: 'string', description: 'One sharp closing line, in your voice.' },
    },
    required: ['winner', 'summary', 'matter', 'manner', 'verdict_line', 'closing'],
  },
};

// THE ONE-HOP VERDICT (LITE lever 1). tool_choice forces submit_verdict on the first
// hop — the prepared material is already in the prompt (deterministic pre-selection),
// so there is nothing left to retrieve. The old loop's up-to-6 hops each resent the
// full transcript+corpus; this sends them once. The ONLY second hop is the truncation
// re-submit (max_tokens cut the tool call mid-prose) — hard-capped at 3 total.
// The winner is read from the enum, NEVER parsed from prose. ADJUDICATION_FAILED in
// the enum throws onto the exact failure path loop-exhaustion used to reach — the
// refusal survived the forced tool_choice by moving into the schema (CE condition 1).
async function runVerdictOneHop(system: any, userContent: string, userId: string): Promise<Verdict> {
  const messages: any[] = [{ role: 'user', content: userContent }];
  for (let hop = 0; hop < 3; hop++) {
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: 2000, temperature: 0, system,
      tools: [SUBMIT_VERDICT_TOOL] as any,
      tool_choice: { type: 'tool', name: 'submit_verdict' } as any,
      messages,
    });
    logUsage({ userId, surface: 'other', fn: 'bf_verdict', model: MODEL, usage: msg.usage });
    const blocks = msg.content || [];
    const verdictCall = blocks.find((b: any) => b.type === 'tool_use' && b.name === 'submit_verdict');
    if (!verdictCall) {
      // forced tool_choice should make this unreachable; max_tokens can truncate the
      // call before it forms. One retry with a tighter ask; never a fabricated winner.
      if (msg.stop_reason === 'max_tokens' && hop < 2) {
        messages.push({ role: 'user', content: 'Call submit_verdict now. Keep every prose field to 2 tight sentences.' });
        continue;
      }
      throw new Error('adjudicator returned no submit_verdict call (stop: ' + msg.stop_reason + ')');
    }
    const v = (verdictCall as any).input || {};
    const w = String(v.winner || '').toUpperCase();
    if (w === 'ADJUDICATION_FAILED') {
      // the schema-borne refusal: same loud failure the caller already handles.
      throw new Error('adjudication_failed (adjudicator refusal): ' + String(v.failure_reason || 'transcript could not be judged').slice(0, 300));
    }
    const winner = w === 'CON' ? 'CON' : w === 'PRO' ? 'PRO' : null;
    if (!winner) throw new Error('submit_verdict returned no valid winner enum: ' + JSON.stringify(v).slice(0, 300));
    // if the tool call was truncated mid-generation (max_tokens), the later fields
    // (matter/manner/closing) can arrive empty. Don't ship a hollow verdict — nudge one
    // re-submit asking ONLY for the missing prose, kept short so it fits.
    const matterEmpty = !String(v.matter || '').trim();
    const mannerEmpty = !String(v.manner || '').trim();
    if ((matterEmpty || mannerEmpty) && msg.stop_reason === 'max_tokens' && hop < 2) {
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
  // exhausted the truncation retries without a whole verdict — do NOT fabricate one.
  throw new Error('adjudicator could not complete a structured verdict within 3 hops');
}

// ── after each completed exchange: one live diagnostic line (the commentary track) ──
// Light + fast: no tools, whole-of-exchange is tiny. Determinism via temperature 0.
export async function runningNote(args: {
  domain: DebateDomain; motion: string;
  seatA_role: string; seatB_role: string;
  lastExchange: { seat: 0 | 1; role: string; text: string }[];
  momentumA: number; difficulty?: 'normal' | 'pro';
}): Promise<{ swing: number; note: string }> {
  const transcript = args.lastExchange
    .map((s) => `${s.seat === 0 ? 'PRO' : 'CON'} (${s.role}): ${s.text}`).join('\n\n');
  // cache split (LITE lever 2, mirrors loop.ts:335): the static prefix — soul + CORE +
  // domain index, byte-identical across every call of a duel — is ephemeral-cached; the
  // task + overlay ride dynamic. cache_control is valid at runtime but not in this
  // SDK's TextBlockParam type; the cast keeps the field in the payload.
  const system: any[] = [
    { type: 'text', text: staticPrefix(args.domain), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: `[TASK: You have just heard ONE completed exchange. Drop your single-sentence live adjudicator note in your own forensic voice — name what landed and what was dropped. Then give the momentum swing.\nOutput EXACTLY two lines, nothing else:\nSWING: <integer -15..15, positive favours PRO, negative favours CON — on MERIT, never on the side>\nNOTE: <one razor line, under 22 words, your live read of this exchange>]` + (args.difficulty === 'normal' ? NOTE_NORMAL : '') },
  ];
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 220, temperature: 0, system: system as any,
      messages: [{ role: 'user', content: `MOTION: ${args.motion}\nMOMENTUM: PRO ${args.momentumA} / CON ${100 - args.momentumA}\n\nTHE EXCHANGE:\n${transcript}` }],
    });
    logUsage({ userId: 'battlefield', surface: 'other', fn: 'bf_running_note', model: MODEL, usage: (msg as any).usage });
    const text = firstText(msg);
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
  domain: DebateDomain; motion: string; difficulty?: 'normal' | 'pro';
  fullTranscript: { seat: 0 | 1; role: string; text: string }[];
}): Promise<Verdict> {
  const transcript = args.fullTranscript
    .map((s) => `${s.seat === 0 ? 'PRO' : 'CON'} (${s.role}): ${s.text}`).join('\n\n');
  // deterministic pre-selection (no model call — CE condition 2): section 8 always,
  // plus the top motion-keyword matches from the index. Rides the DYNAMIC block so the
  // static prefix stays byte-identical with the running notes' — the cache carries
  // across a duel's every adjudicator call, notes through verdict.
  const prepared = pickSections(args.domain, args.motion);
  const task =
    `[YOUR PREPARED MATERIAL, OPENED — the sections relevant to this motion (${prepared.ids.join(', ')}), including section 8, your fact-check notes:]\n${prepared.text}\n\n` +
    `[TASK: The debate has concluded. Rule on it now. Verify the key factual claims against the opened material above; you judge only on what the debaters said and what your material supports — you never introduce a fact neither side raised, and where the material is silent you name the claim unverified and weigh it on its logic alone. Judge the debating, not the position; identical standard for PRO and CON regardless of assigned side. Weigh Matter (50%: logic, evidence, factual accuracy — apply the iron fact-check rule) and Manner (50%: delivery, structure, control).

Call submit_verdict exactly once with your structured adjudication. The winner field MUST be the side your matter and manner audits favour — it cannot contradict your own reasoning. Write the prose fields (summary, matter, manner, verdict_line, closing) in your own forensic voice.

THE REFUSAL: if the transcript gave you nothing to judge — empty or near-empty speeches, gibberish, no genuine argument attempted on either side — set winner to ADJUDICATION_FAILED with a one-line failure_reason. This is for transcripts where honest adjudication is IMPOSSIBLE, never for amateur quality: a weak but genuine attempt still gets a real verdict. Fabricating a winner from nothing is the one sin this bench does not commit.]` +
    (args.difficulty === 'normal' ? VERDICT_NORMAL : '');
  // cache split (LITE lever 2): identical static prefix to the running notes'.
  const system: any[] = [
    { type: 'text', text: staticPrefix(args.domain), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: task },
  ];
  try {
    const v = await runVerdictOneHop(system as any, `MOTION: ${args.motion}\n\nFULL TRANSCRIPT:\n${transcript}`, 'battlefield');
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
