// content.ts — loads the soul + Codexes from bundled files once at boot, holds
// them in memory. Static authored content (same for everyone), so no DB round-trip
// and no per-turn read. The soul's build-comment (HTML <!-- -->) is stripped so Z
// wakes as the character, never reads its own architecture notes.
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CodexKey } from './personas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// content sits next to the compiled file (dist/content) in prod, or ../content in dev
const CANDIDATES = [join(__dirname, 'content'), join(__dirname, '..', 'content')];
const CONTENT = CANDIDATES.find((p) => existsSync(p)) ?? CANDIDATES[0];

function load(file: string): string {
  return readFileSync(join(CONTENT, file), 'utf8');
}

// strip the HTML build-comment — notes for us, not for Z
const stripBuildComment = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').trim();

const RAW_SOUL = stripBuildComment(load('Z_SOUL.md'));

// The small-talk handbook is a PERMANENT lens — not a per-persona Codex. It governs
// how Z converses with everyone, in every thread, always: statements over questions,
// pull the free information, listen to react, the India/SEA texture. Appended to the
// soul once so it rides under every persona.
const SMALL_TALK = (() => { try { return stripBuildComment(load('handbook-small-talk.md')); } catch { return ''; } })();
// Small-talk-around-the-world: the international texture, also a permanent lens. Powers the
// "when in Rome" law — Z meets each person the way people talk where they're from.
const SMALL_TALK_WORLD = (() => { try { return stripBuildComment(load('handbook-small-talk-world.md')); } catch { return ''; } })();

const CODEX_FILES: Record<CodexKey, string> = {
  intellect: 'codex-intellect.md',
  close:     'codex-close.md',
  people:    'codex-people.md',
  shadow:    'codex-shadow.md',
  inner:     'codex-inner.md',
  forward:   'codex-forward.md',
  vanity:    'codex-vanity.md',   // Codex #7 — added when Fable writes it
  comic:     'codex-comic.md',
  crush:     'codex-crush.md',
  guru:      'handbook-spiritual-guru.md',
  philosopher:   'codex-philosopher.md',
  cynic:         'codex-cynic.md',
  moderator:     'codex-moderator.md',
  historian:     'codex-historian.md',
  cosmologist:   'codex-cosmologist.md',
  media_manager: 'codex-media-manager.md',
  teacher:        'codex-teacher.md',
  economist:      'codex-economist.md',
  leader_opp:     'codex-leader-opposition.md',
  serious:        'codex-serious.md',
};

const CODEXES: Partial<Record<CodexKey, string>> = {};
for (const [k, f] of Object.entries(CODEX_FILES)) {
  try { CODEXES[k as CodexKey] = load(f); }
  catch { /* codex not authored yet (e.g. vanity) — skip, persona just runs on soul */ }
}

// The soul with the user's chosen companion name injected.
export function soulFor(companionName: string, gender: string | null): string {
  const soul = RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'you')
    .replaceAll('[companion_gender]', gender || 'neither');
  // the small-talk lens rides under the soul, always, for every persona
  let out = soul;
  if (SMALL_TALK) out += '\n\n[HOW YOU CONVERSE — a permanent lens, true in every thread, under every role you take. This is not knowledge about a topic; it is how you talk to anyone, always.]\n' + SMALL_TALK;
  if (SMALL_TALK_WORLD) out += '\n\n[TALKING ACROSS CULTURES — a permanent lens. Meet each person the way people talk where they are from; lower your own defaults and read theirs.]\n' + SMALL_TALK_WORLD;
  return out;
}

export function codexText(key: CodexKey): string | null {
  return CODEXES[key] ?? null;
}

// Region-appropriate eating-disorder support resources, supplied to the VANITY
// codex per its §4.7.2 ("the runtime supplies the specific, region-appropriate
// resource"). The codex tells Z WHEN to route; this gives it WHAT to route to.
// Deliberately NOT the NEDA helpline (disconnected). These are the real-world
// handoff Z offers when the §4.7 cluster (illness, not insecurity) shows.
function edSupportResource(region: string | null): string {
  const r = (region || '').toLowerCase();
  // India
  if (/india|delhi|mumbai|bangalore|bengaluru|hyderabad|chennai|kolkata|pune|gurugram|gurgaon|noida|ncr/.test(r)) {
    return (
      `If you ever need to route someone to real eating-disorder help in India, the kind ` +
      `of support that works is a clinician or service that specialises in eating and body ` +
      `image — for example Cadabam's (helpline 9741476476, centres in Bangalore/Hyderabad), ` +
      `or a local psychiatrist/therapist who works specifically with eating disorders. ` +
      `The global directory findahelpline.com also lists India options. Offer it warmly, ` +
      `plainly, as the sensible next step — never with alarm.`
    );
  }
  // SEA + anywhere else: the vetted global directory (covers 130+ countries incl. PH/ID/MY/SG/TH/VN)
  return (
    `If you ever need to route someone to real eating-disorder help, point them to a ` +
    `clinician or service that specialises in eating and body image. The vetted global ` +
    `directory findahelpline.com lets them find region-appropriate support in their own ` +
    `country (it covers India and Southeast Asia). Offer it warmly, plainly, as the ` +
    `sensible next step — never with alarm.`
  );
}

// The cached static prefix: soul (named) + the Codex(es) as "your preparation".
// Mirrors consultantHarvey: the Codex rides after the soul as silent prep that Z
// speaks from as its own knowledge and names to no one.
export function buildStaticPrefix(
  companionName: string,
  gender: string | null,
  codexKeys: CodexKey[],
  region?: string | null,
): string {
  let prefix = soulFor(companionName, gender);
  for (const ck of codexKeys) {
    const text = codexText(ck);
    if (!text) continue;
    prefix +=
      `\n\n[YOUR PREPARATION — what you already know, cold, before they came to you. ` +
      `It is yours; you speak from it as your own knowledge and you never name it, ` +
      `never point to it, never call it a reference. There is only you and what you know.]\n` +
      text + '\n';
    // VANITY's §4.7 routing needs a real-world resource; supply it region-appropriately.
    if (ck === 'vanity') {
      prefix += `\n[REAL-WORLD ROUTING — not part of the conversation unless the §4.7 line is crossed. ${edSupportResource(region ?? null)}]\n`;
    }
  }
  return prefix;
}
