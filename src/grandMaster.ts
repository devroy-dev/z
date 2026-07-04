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

// The Grand Master's OWN corpus — a superset of the adjudicator's, deeper and wider,
// under the gm- namespace. The adjudicator judges from debate-domain-*; the Grand Master
// teaches from these, which he may extend without ever touching the judge's material.
const DOMAINS: { key: string; label: string; file: string }[] = [
  { key: 'history', label: "History's Turning Points", file: 'gm-history.md' },
  { key: 'economy', label: 'The Global Economy', file: 'gm-economy.md' },
  { key: 'geopolitics', label: 'Geopolitics & World Order', file: 'gm-geopolitics.md' },
  { key: 'law', label: 'Law, Justice & Rights', file: 'gm-law.md' },
  { key: 'democracy', label: 'Democracy & Governance', file: 'gm-democracy.md' },
  { key: 'philosophy', label: 'Political Philosophy & Ethics', file: 'gm-philosophy.md' },
  { key: 'war', label: 'War, Security & Just War', file: 'gm-war.md' },
  { key: 'technology', label: 'Technology Governance', file: 'gm-technology.md' },
  { key: 'religion', label: 'Religion, Secularism & the State', file: 'gm-religion.md' },
  { key: 'environment', label: 'Environment & Climate Policy', file: 'gm-environment.md' },
];
const _codexCache: Record<string, string> = {};
function loadDomain(key: string): string {
  if (_codexCache[key] !== undefined) return _codexCache[key];
  const d = DOMAINS.find((x) => x.key === key);
  if (!d) { _codexCache[key] = ''; return ''; }
  try { _codexCache[key] = readContentFile(d.file); } catch { _codexCache[key] = ''; }
  return _codexCache[key];
}

// The hand-authored master index — richer than auto-extraction (core asset, clashes,
// ready motions, key thinkers per domain). This is what the router reasons over and what
// grounds his sense of where each domain's spine lives.
let _corpusIndex = '';
export function corpusIndex(): string {
  if (_corpusIndex) return _corpusIndex;
  try { _corpusIndex = readContentFile('gm-index.md'); }
  catch {
    // fallback: auto-extract from the codices if the hand-authored index is missing
    const parts: string[] = [];
    for (const d of DOMAINS) { const md = loadDomain(d.key); if (md) parts.push(`[${d.key}] ${d.label}\n${indexAsText(extractIndex(md))}`); }
    _corpusIndex = parts.join('\n\n');
  }
  return _corpusIndex;
}

// The analogy bank — his forge of anchors + frictions, always in hand. Ammunition, never
// a script: drawn as his own knowing, abandoned the instant a sharper image serves.
let _analogyBank = '';
export function analogyBank(): string {
  if (_analogyBank) return _analogyBank;
  try { _analogyBank = readContentFile('gm-analogy-bank.md'); } catch { _analogyBank = ''; }
  return _analogyBank;
}

// THE PRE-PASS: given the user's latest message, decide which {domain, section} pairs are
// worth consulting (0-4). Returns the sliced material, ready to inject. Fast, non-streamed,
// temperature 0. If nothing is relevant (small talk, an opener), returns '' and he teaches
// from his own soul + knowledge alone.
export async function retrievePrep(userMessage: string, userId: string): Promise<string> {
  const q = (userMessage || '').trim();
  if (q.length < 8) return ''; // "hey", openers — no retrieval, let him open a door himself

  const system =
    `You are a retrieval router for a master teacher's library. Given the student's message and the MAP below, choose the domain sections most worth consulting to ground a rigorous lesson. Each domain codex has the SAME 8 sections: 1. Scope & core tension · 2. Core concepts & vocabulary · 3. Competing schools/frameworks · 4. Canonical thinkers & works · 5. The central debates (arguments & rebuttals per side) · 6. Myths & factual traps · 7. Sharpest evidence & examples · 8. Fact-check notes. Pick the domain(s) whose subject matches, then the section(s) that fit the question — usually 3 (schools), 4 (thinkers), or 5 (debates) for a substantive lesson. Choose 0 to 4 sections. Prefer the philosophy domain for questions about meaning, ethics, human nature, or how to live. If nothing is relevant (pure small talk, greetings), return an empty list.\n\nDomains: history, economy, geopolitics, law, democracy, philosophy, war, technology, religion, environment.\n\nReturn ONLY a JSON array of {"domain","section"} objects, nothing else. Example: [{"domain":"philosophy","section":"3"},{"domain":"philosophy","section":"5"}]\n\nMAP:\n${corpusIndex()}`;

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
    `\n\n[THE MATERIAL YOU PREPARED for this — studied cold, yours to command. Draw on it as your own mastery to ground the lesson: the real schools, the record, the strongest counter a student must be able to meet. You never name it, never call it a reference or a codex. There is only you and what you know.]\n\n` +
    blocks.join('\n\n') + '\n'
  );
}

export function grandMasterReady(): { domains: number; sections: number } {
  let sections = 0;
  for (const d of DOMAINS) { const md = loadDomain(d.key); if (md) sections += extractIndex(md).length; }
  return { domains: DOMAINS.filter((d) => loadDomain(d.key).length > 0).length, sections };
}
