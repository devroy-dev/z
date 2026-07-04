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

// The always-on static prefix — his soul + his judging discipline, identical every
// call within a debate, so it caches. The domain rides here too (constant per debate).
function staticPrefix(domain: DebateDomain): string {
  const dLabel = DOMAIN_LABELS[domain];
  return (
    SOUL +
    '\n\n[YOUR DISCIPLINE — the method of adjudication itself, always open to you. You judge through it constantly and draw on it as your own mastery; you never name it, never call it a codex or a reference. There is only you and what the floor gives you.]\n' +
    CORE +
    `\n\n[YOUR PREPARATION for this motion — the field is ${dLabel}. This is the knowledge you carry into the room, cold, before the debaters speak. Use it to catch fabrication, tell a real line from a cliché, and reward engagement with the strongest counter. You never penalise a debater for an argument NOT in it, and — the iron rule — you never invent a fact-check: flag a fabrication only when this record positively contradicts the claim; when it is silent, you say so and weigh the point on its logic alone.]\n` +
    domainCodex(domain) + '\n'
  );
}

// ── after each completed exchange: one live diagnostic line (the commentary track) ──
export async function runningNote(args: {
  domain: DebateDomain; motion: string;
  seatA_role: string; seatB_role: string;
  lastExchange: { seat: 0 | 1; role: string; text: string }[];
  momentumA: number;
}): Promise<{ swing: number; note: string }> {
  const transcript = args.lastExchange
    .map((s) => `${s.seat === 0 ? 'PRO' : 'CON'} (${s.role}): ${s.text}`).join('\n\n');
  const system = staticPrefix(args.domain) +
    `\n\n[TASK: You have just heard ONE completed exchange. Drop your single-sentence live adjudicator note in your own forensic voice — name what landed and what was dropped, per your commentary-track discipline. Then give the momentum swing.\nOutput EXACTLY two lines, nothing else:\nSWING: <integer -15..15, positive favours PRO, negative favours CON — on MERIT, never on the side>\nNOTE: <one razor line, under 22 words, your live read of this exchange>]`;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 120, system,
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
    `\n\n[TASK: The debate has concluded. Deliver your FINAL ADJUDICATION in your voice, mobile-legible (no drawn boxes). Judge the debating, not the position; identical standard for PRO and CON regardless of assigned side. Use Matter (50%: logic, evidence, factual accuracy — apply the iron fact-check rule) and Manner (50%: delivery, structure, control).\nOutput EXACTLY these labelled lines, nothing else:\nWINNER: <PRO or CON>\nSUMMARY: <2-3 sentences — the core clash and where it was decided>\nMATTER: <2-3 sentences — the substance/fact audit; name any fabrication struck or any claim left unverified>\nMANNER: <2-3 sentences — the delivery audit for both sides>\nVERDICT: <one line — who wins on Matter and why>\nCLOSING: <one sharp closing line>]`;
  try {
    const msg = await anthropic.messages.create({
      model: MODEL, max_tokens: 1100, system,
      messages: [{ role: 'user', content: `MOTION: ${args.motion}\n\nFULL TRANSCRIPT:\n${transcript}` }],
    });
    logUsage({ userId: 'battlefield', surface: 'other', model: MODEL, usage: (msg as any).usage });
    const text = ((msg.content?.[0] as any)?.text ?? '');
    const grab = (label: string) => (new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|$)`).exec(text)?.[1] ?? '').trim();
    const w = grab('WINNER').toUpperCase().includes('PRO') ? 'PRO' : 'CON';
    return {
      winner: w as 'PRO' | 'CON',
      summary: grab('SUMMARY').slice(0, 1200),
      matter: grab('MATTER').slice(0, 1200),
      manner: grab('MANNER').slice(0, 1200),
      adjVerdict: grab('VERDICT').slice(0, 600),
      closing: grab('CLOSING').slice(0, 400),
      raw: text.slice(0, 4000),
    };
  } catch {
    return { winner: 'PRO', summary: 'The adjudicator retires to chambers.', matter: '', manner: '', adjVerdict: '', closing: 'The floor is cleared.', raw: '' };
  }
}

// health/diagnostic: confirm the always-on pieces actually loaded
export function adjudicatorReady(): { soul: boolean; core: boolean; domains: number } {
  const domains = (Object.keys(DOMAIN_FILES) as DebateDomain[]).filter((d) => domainCodex(d).length > 0).length;
  return { soul: SOUL.length > 0, core: CORE.length > 0, domains };
}
