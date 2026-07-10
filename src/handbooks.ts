// handbooks.ts — THE HANDBOOK RAIL. A domain persona's knowledge lives in a
// sliceable handbook, not in the static prefix. Before a streamed turn, a
// silent PRE-PASS (the grandMaster.ts mould — pre-pass, never a tool-loop,
// because the reply must STREAM) reads the handbook's INDEX plus the moment,
// picks 0–2 sections worth consulting, and judges the turn's DEPTH. The
// slices ride the dynamic block as the persona's own knowing; a "deep"
// verdict escalates THIS TURN to the top tier. Empty sections is a valid and
// common answer — small talk needs no handbook; silence is allowed.
//
// Adding a seat to the rail = one line in HANDBOOKS + the content file.
import { llm, firstText } from './llm.js';
import { readContentFile } from './content.js';
import { logUsage } from './usage.js';
import { extractIndex, indexAsText, sliceSection } from './codexRetrieval.js';

const anthropic = llm();
const PREPASS_MODEL = 'claude-haiku-4-5-20251001';

// the rail's seats — the media manager now; the three §6 seats join in Phase 5.
const HANDBOOKS: Partial<Record<string, string>> = {
  the_media_manager: 'handbook-media-manager.md',
  // the_advocate:  'handbook-legal-in.md',     // Phase 5
  // the_trainer:   'handbook-training.md',     // Phase 5
  // the_khansama:  'handbook-kitchen-in.md',   // Phase 5
};

export function hasHandbook(personaKey: string): boolean {
  return !!HANDBOOKS[personaKey];
}

// lazy, cached per handbook: the text + the router map. Prefer the file's own
// hand-authored MASTER INDEX (richer, the gm-index precedent); fall back to
// auto-extraction so any future handbook works with no index authored.
const _md: Record<string, string> = {};
const _map: Record<string, string> = {};
function loadHandbook(personaKey: string): { md: string; map: string } | null {
  const file = HANDBOOKS[personaKey];
  if (!file) return null;
  if (!(personaKey in _md)) {
    try { _md[personaKey] = readContentFile(file); } catch { _md[personaKey] = ''; }
    const md = _md[personaKey];
    let map = '';
    const mi = md.indexOf('## MASTER INDEX');
    if (mi >= 0) {
      const rest = md.slice(mi);
      const end = rest.search(/\n# /);
      map = (end > 0 ? rest.slice(0, end) : rest).trim();
    }
    if (!map) map = indexAsText(extractIndex(md));
    _map[personaKey] = map;
  }
  return _md[personaKey] ? { md: _md[personaKey], map: _map[personaKey] } : null;
}

export interface HandbookPrep { block: string; deep: boolean; sections: string[] }

// THE PRE-PASS. One cheap call, temperature 0, strict JSON out. Input: the
// handbook INDEX + the user's message (+ the last assistant line for
// continuity). Output: {"sections": ["9.3", "21"], "depth": "light"|"deep"}
// — 0–2 sections; empty is common and correct.
export async function handbookPrep(
  personaKey: string, userMessage: string, lastAssistantLine: string, userId: string, threadId?: string | null,
): Promise<HandbookPrep | null> {
  const hb = loadHandbook(personaKey);
  if (!hb) return null;
  const q = (userMessage || '').trim();
  if (q.length < 8) return null;   // "hey" — no consult, the persona opens a door itself

  const system =
    `You are a silent retrieval router for a domain expert's private handbook. Given the INDEX below and the client's latest message (plus the expert's previous line for continuity), decide which handbook sections — if any — are worth consulting to ground THIS reply, and how heavy the question is.\n\n` +
    `Rules:\n` +
    `- Choose 0, 1, or 2 section ids from the INDEX (e.g. "9.3", "21"). Most casual or conversational turns need NONE — an empty list is a normal, correct answer. Never force a consult.\n` +
    `- "depth": "deep" ONLY when the message asks for substantial domain judgment — strategy, pricing, negotiation, a plan, a crisis, a legal/technical determination — where a stronger model would give materially better counsel. Everything else, including simple factual lookups the sections already cover, is "light".\n` +
    `- Return ONLY strict JSON, nothing else: {"sections": ["id", "id"], "depth": "light"}\n\n` +
    `INDEX:\n${hb.map}`;

  const convo =
    (lastAssistantLine ? `EXPERT'S PREVIOUS LINE: ${lastAssistantLine.slice(0, 400)}\n\n` : '') +
    `CLIENT'S MESSAGE: ${q.slice(0, 2000)}`;

  let sections: string[] = [];
  let deep = false;
  try {
    const msg: any = await anthropic.messages.create({
      model: PREPASS_MODEL, max_tokens: 150, temperature: 0, system,
      messages: [{ role: 'user', content: convo }],
    });
    logUsage({ userId, threadId, personaKey, surface: 'other', fn: 'handbook-prepass', model: PREPASS_MODEL, usage: msg.usage });
    const text = firstText(msg).replace(/```json|```/g, '').trim();
    const j = JSON.parse(text);
    if (Array.isArray(j?.sections)) sections = j.sections.slice(0, 2).map((x: any) => String(x)).filter(Boolean);
    deep = j?.depth === 'deep';
  } catch { sections = []; deep = false; }   // a broken pre-pass never blocks the turn

  if (!sections.length && !deep) return { block: '', deep: false, sections: [] };

  const blocks: string[] = [];
  const seen = new Set<string>();
  for (const ref of sections) {
    if (seen.has(ref)) continue; seen.add(ref);
    const sec = sliceSection(hb.md, ref);
    if (sec) blocks.push(sec);
  }

  const block = blocks.length
    ? `\n\n[FROM YOUR OWN KNOWING — consulted for this turn. Yours to wield as instinct; never name it, never recite it whole.]\n\n` + blocks.join('\n\n') + '\n'
    : '';
  return { block, deep, sections };
}
