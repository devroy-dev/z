// grandMaster.ts — THE GRAND MASTER's corpus. He teaches from the ten domain codexes
// the way Victor consults his field, but across all ten. A silent RETRIEVAL PRE-PASS
// (Option A) decides which domain sections a question touches, slices them, and hands
// them to his streamed teaching turn as his own prepared material — never named.
//
// Why a pre-pass and not an agentic tool-loop: his teaching must STREAM (the unfurling
// of a lesson is his voice). Client-side retrieval tools can't ride the streaming path,
// so we retrieve first (fast, non-streamed), inject, then stream normally.
import Anthropic from '@anthropic-ai/sdk';
import { readContentFile } from './content.js';
import { logUsage } from './usage.js';
import { extractIndex, indexAsText, sliceSection } from './codexRetrieval.js';

const anthropic = new Anthropic({ fetch: globalThis.fetch as any });
const MODEL = 'claude-haiku-4-5-20251001';

const DOMAINS: { key: string; label: string; file: string }[] = [
  { key: 'history', label: "History's Turning Points", file: 'debate-domain-history.md' },
  { key: 'economy', label: 'The Global Economy', file: 'debate-domain-economy.md' },
  { key: 'geopolitics', label: 'Geopolitics & World Order', file: 'debate-domain-geopolitics.md' },
  { key: 'law', label: 'Law, Justice & Rights', file: 'debate-domain-law.md' },
  { key: 'democracy', label: 'Democracy & Governance', file: 'debate-domain-democracy.md' },
  { key: 'philosophy', label: 'Political Philosophy & Ethics', file: 'debate-domain-philosophy.md' },
  { key: 'war', label: 'War, Security & Just War', file: 'debate-domain-war.md' },
  { key: 'technology', label: 'Technology Governance', file: 'debate-domain-technology.md' },
  { key: 'religion', label: 'Religion, Secularism & the State', file: 'debate-domain-religion.md' },
  { key: 'environment', label: 'Environment & Climate Policy', file: 'debate-domain-environment.md' },
];
const _codexCache: Record<string, string> = {};
function loadDomain(key: string): string {
  if (_codexCache[key] !== undefined) return _codexCache[key];
  const d = DOMAINS.find((x) => x.key === key);
  if (!d) { _codexCache[key] = ''; return ''; }
  try { _codexCache[key] = readContentFile(d.file); } catch { _codexCache[key] = ''; }
  return _codexCache[key];
}

// combined index of the whole corpus — every domain + its sections. The pre-pass reasons
// over this to choose what to pull.
let _corpusIndex = '';
export function corpusIndex(): string {
  if (_corpusIndex) return _corpusIndex;
  const parts: string[] = [];
  for (const d of DOMAINS) {
    const md = loadDomain(d.key);
    if (!md) continue;
    parts.push(`[${d.key}] ${d.label}\n${indexAsText(extractIndex(md))}`);
  }
  _corpusIndex = parts.join('\n\n');
  return _corpusIndex;
}

// THE PRE-PASS: given the user's latest message, decide which {domain, section} pairs are
// worth consulting (0-4). Returns the sliced material, ready to inject. Fast, non-streamed,
// temperature 0. If nothing is relevant (small talk, an opener), returns '' and he teaches
// from his own soul + knowledge alone.
export async function retrievePrep(userMessage: string, userId: string): Promise<string> {
  const q = (userMessage || '').trim();
  if (q.length < 8) return ''; // "hey", openers — no retrieval, let him open a door himself

  const system =
    `You are a retrieval router for a master teacher's library. Given the student's message and the INDEX below, choose the sections most worth consulting to ground a rigorous lesson — the competing schools, the record, the central debates, the strongest counters. Choose 0 to 4 sections. Prefer the philosophy domain for questions about meaning, ethics, human nature, or how to live. If nothing in the library is relevant (pure small talk, greetings), return an empty list.\n\nReturn ONLY a JSON array of {"domain","section"} objects, nothing else. Example: [{"domain":"philosophy","section":"3"},{"domain":"law","section":"5"}]\n\nINDEX:\n${corpusIndex()}`;

  let picks: { domain: string; section: string }[] = [];
  try {
    const msg: any = await anthropic.messages.create({
      model: MODEL, max_tokens: 200, temperature: 0, system,
      messages: [{ role: 'user', content: q.slice(0, 2000) }],
    });
    logUsage({ userId, surface: 'other', model: MODEL, usage: msg.usage });
    const text = (msg.content?.[0]?.text ?? '').replace(/```json|```/g, '').trim();
    const arr = JSON.parse(text);
    if (Array.isArray(arr)) picks = arr.slice(0, 4).filter((p: any) => p && p.domain && p.section);
  } catch { picks = []; }

  if (!picks.length) return '';

  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const p of picks) {
    const key = `${p.domain}:${p.section}`;
    if (seen.has(key)) continue; seen.add(key);
    const md = loadDomain(String(p.domain));
    if (!md) continue;
    const sec = sliceSection(md, String(p.section));
    if (sec) {
      const label = DOMAINS.find((d) => d.key === p.domain)?.label ?? p.domain;
      blocks.push(`— from ${label} —\n${sec}`);
    }
  }
  if (!blocks.length) return '';

  return (
    `\n\n[THE MATERIAL YOU PREPARED for this — studied cold, yours to command. It lays out every side at its strongest, because you know each position better than the men who hold it. This is your armoury, not your indecision. You do NOT mirror its balance back as "some say this, others say that" — that is the fence-sitting you despise. You wield it: hold both blades, and strike with whichever one the student has neglected. Argue the position they have not yet earned the right to dismiss. Draw on this as your own knowledge; never name it, never call it a reference or a codex — a master does not show his sources. There is only you and what you know.]\n\n` +
    blocks.join('\n\n') + '\n'
  );
}

export function grandMasterReady(): { domains: number; sections: number } {
  let sections = 0;
  for (const d of DOMAINS) { const md = loadDomain(d.key); if (md) sections += extractIndex(md).length; }
  return { domains: DOMAINS.filter((d) => loadDomain(d.key).length > 0).length, sections };
}
