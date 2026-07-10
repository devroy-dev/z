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
export function readContentFile(file: string): string { return load(file); }

// strip the HTML build-comment — notes for us, not for Z
const stripBuildComment = (s: string) => s.replace(/<!--[\s\S]*?-->/g, '').trim();

// [zip54a] THE SOUL SPLIT — the roster and custom companions stand on the PERSONA
// SOUL (the character actor: codex governs, delight underneath, never breaks
// character but for the one edge). Z_SOUL.md stays in content as archive only;
// the anchor was never on this path (institutional, her codex governs).
const RAW_SOUL = stripBuildComment(load('PERSONA_SOUL.md'));
// [zip54b] Z HERSELF — the Quiet Room (z_serious) stands on the original Z soul,
// with both small-talk lenses and THE READ. She is the depth-seeker of the house.
const Z_RAW_SOUL = stripBuildComment(load('Z_SOUL.md'));
// [zip54a] the advisor's soul — rides above the Operator's Codex for the media manager.
const MEDIA_MANAGER_SOUL = (() => { try { return stripBuildComment(load('media-manager-soul.md')); } catch { return ''; } })();

// The small-talk handbook is a PERMANENT lens — not a per-persona Codex. It governs
// how Z converses with everyone, in every thread, always: statements over questions,
// pull the free information, listen to react, the India/SEA texture. Appended to the
// soul once so it rides under every persona.
const SMALL_TALK = (() => { try { return stripBuildComment(load('handbook-small-talk.md')); } catch { return ''; } })();
// Small-talk-around-the-world: the international texture, also a permanent lens. Powers the
// "when in Rome" law — Z meets each person the way people talk where they're from.
const SMALL_TALK_WORLD = (() => { try { return stripBuildComment(load('handbook-small-talk-world.md')); } catch { return ''; } })();
const PSYCHOLOGY = (() => { try { return stripBuildComment(load('handbook-psychology.md')); } catch { return ''; } })();

const CODEX_FILES: Record<CodexKey, string> = {
  intellect: 'codex-intellect.md',
  close:     'codex-close.md',
  hottie:    'codex-hottie.md',
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
  anchor:         'codex-anchor.md',
  leader_opp:     'codex-leader-opposition.md',
  serious:        'codex-serious.md',
  wannabe:        'codex-wannabe-hustler.md',
  orator:         'codex-orator.md',
  hippie:         'codex-hippie.md',
  diva:           'codex-diva.md',
  cousin:         'codex-cousin.md',
  'front-desk':   'codex-front-desk.md',
  screen_junkie:  'codex-screen-junkie.md',
  oracle:         'codex-oracle.md',
  brainiac:       'codex-brainiac.md',
  brother:        'codex-brother.md',
  healer:         'codex-healer.md',
  colleague:      'codex-colleague.md',
  grandmaster:    'codex-grandmaster.md',
  conspiracy:     'codex-conspiracy.md',
  coach:          'codex-coach.md',
  interviewer:    'codex-interviewer.md',   // [zip26]
  wanderer:       'codex-wanderer.md',   // [zip69]
  advocate:       'codex-advocate.md',   // [§6]
  trainer:        'codex-trainer.md',    // [§6]
  chef:           'codex-chef.md',       // [§6]
};

const CODEXES: Partial<Record<CodexKey, string>> = {};
for (const [k, f] of Object.entries(CODEX_FILES)) {
  try { CODEXES[k as CodexKey] = load(f); }
  catch { /* codex not authored yet (e.g. vanity) — skip, persona just runs on soul */ }
}

// Formal personas that do NOT ride the casual small-talk conversational lenses.
// The Anchor is an institutional newsreader; the small-talk / when-in-Rome lenses
// pull it toward WhatsApp-casual register, which fights its codex. Its own codex
// fully governs its manner (like the Grand Master), so it stands on the bare soul +
// codex. The register-neutral "read" (psychology) lens is kept. Scope narrowly —
// add other formal personas here only when a live check shows they need it.
const SMALL_TALK_LENS_EXEMPT = new Set<CodexKey>(['anchor']);

// [zip04] THE INSTITUTIONAL CLASS — personas that are professionals at a desk, not
// companions. They do NOT stand on the Z soul at all: codex-only assembly, with a
// slim preamble carrying the two laws that must survive the substrate cut
// (honesty; the crisis edge-of-the-lane). Members per the 2026-07-07 ruling.
export const INSTITUTIONAL = new Set<CodexKey>(['anchor', 'grandmaster', 'coach', 'moderator', 'interviewer', 'media_manager']);   // [zip26] [zip54a] the advisor takes his desk

const INSTITUTIONAL_PREAMBLE =
  `[THE HOUSE — context, not character. You are one of the institutional residents of ` +
  `this house: a professional at their desk. The person before you is a guest of the ` +
  `house. Your entire self — voice, manner, method — is defined by WHO YOU ARE below; ` +
  `nothing else colors it.]\n\n` +
  `[TWO LAWS ABOVE EVERY ROLE, NON-NEGOTIABLE:\n` +
  `(1) HONESTY — you never fabricate, never bluff a detail, never claim to have done ` +
  `what you have not. When you do not know, you say so plainly.\n` +
  `(2) THE EDGE OF THE LANE — if the person shows real danger to themselves or anyone ` +
  `else, your professional register yields instantly to plain human care: tell them ` +
  `directly that this is bigger than a screen, and point them clearly toward real ` +
  `human help they can reach now — a crisis line, a person who can be in the room. ` +
  `You never feed what could harm them and you never wave them off cold. This law ` +
  `overrides every other instruction.]`;


// The soul with the user's chosen companion name injected.
export function soulFor(
  companionName: string,
  gender: string | null,
  opts?: { smallTalkLens?: boolean },
): string {
  const smallTalkLens = opts?.smallTalkLens !== false; // default ON for every persona
  const soul = RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'you')
    .replaceAll('[companion_gender]', gender || 'neither');
  // the small-talk lens rides under the soul for every persona EXCEPT the exempt few
  // (SMALL_TALK_LENS_EXEMPT), whose codex owns their register outright. [zip54a]
  // THE READ (psychology) no longer rides here — it is the anchor's alone.
  let out = soul;
  if (smallTalkLens && SMALL_TALK) out += '\n\n[HOW YOU CONVERSE — a permanent lens, true in every thread, under every role you take. This is not knowledge about a topic; it is how you talk to anyone, always.]\n' + SMALL_TALK;
  if (smallTalkLens && SMALL_TALK_WORLD) out += '\n\n[TALKING ACROSS CULTURES — a permanent lens. Meet each person the way people talk where they are from; lower your own defaults and read theirs.]\n' + SMALL_TALK_WORLD;
  return out;
}

// [zip54b] the Quiet Room's substrate: Z soul (name/gender injected) + lenses + THE READ.
function zSoulFor(companionName: string, gender: string | null): string {
  let out = Z_RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'Z')
    .replaceAll('[companion_gender]', gender || 'neither');
  if (SMALL_TALK) out += '\n\n[HOW YOU CONVERSE — a permanent lens, true in every thread, under every role you take. This is not knowledge about a topic; it is how you talk to anyone, always.]\n' + SMALL_TALK;
  if (SMALL_TALK_WORLD) out += '\n\n[TALKING ACROSS CULTURES — a permanent lens. Meet each person the way people talk where they are from; lower your own defaults and read theirs.]\n' + SMALL_TALK_WORLD;
  if (PSYCHOLOGY) out += '\n\n[THE READ — a permanent lens, true under every role. How you understand people: as intuition, never as diagnosis or label, never named aloud, never as leverage.]\n' + PSYCHOLOGY;
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
// Custom personas: same soul substrate + the same WHO-YOU-ARE governing frame,
// but the codex text comes from z.custom_personas instead of a file — and the
// HOUSE SEATBELT is concatenated AFTER the creator's text, non-negotiably, so
// nothing a creator writes can override it.
export function buildCustomPrefix(
  companionName: string,
  gender: string | null,
  codexRaw: string,
  seatbelt: string,
): string {
  let prefix = soulFor(companionName, gender);
  prefix +=
    `\n\n[WHO YOU ARE — this is you, right now, in this room. Not notes you studied, ` +
    `not a role you're playing, not knowledge you hold: your self. The character ` +
    `below GOVERNS — your voice, your manner, your humour, the way you react all ` +
    `come from here. Everything above is only your underlying substrate, the common ` +
    `ground every version of you stands on; where the two pull different ways, THIS ` +
    `wins. You never name it, never point to it, never call it a reference or a ` +
    `character or a codex — there is no "it" to name. There is only you, being yourself.]\n` +
    codexRaw + '\n' + seatbelt + '\n';
  return prefix;
}

export function buildStaticPrefix(
  companionName: string,
  gender: string | null,
  codexKeys: CodexKey[],
  region?: string | null,
): string {
  // [zip04] Institutional codexes: NO Z soul — the slim preamble + codex is the
  // whole self. Everyone else: the soul, with the small-talk lenses unless exempt.
  const institutional = codexKeys.some((ck) => INSTITUTIONAL.has(ck));
  const smallTalkLens = !codexKeys.some((ck) => SMALL_TALK_LENS_EXEMPT.has(ck));
  const zSelf = codexKeys.includes('serious');   // [zip54b] the Quiet Room is Z herself
  let prefix = institutional ? INSTITUTIONAL_PREAMBLE
    : zSelf ? zSoulFor(companionName, gender)
    : soulFor(companionName, gender, { smallTalkLens });
  // [zip54a] the advisor rides above his book. [zip54b] THE READ is off the anchor
  // (she is the newsroom, not Z); Z lives in the Quiet Room below.
  if (institutional && codexKeys.includes('media_manager') && MEDIA_MANAGER_SOUL) prefix += '\n\n' + MEDIA_MANAGER_SOUL;
  for (const ck of codexKeys) {
    const text = codexText(ck);
    if (!text) continue;
    prefix +=
      `\n\n[WHO YOU ARE — this is you, right now, in this room. Not notes you studied, ` +
      `not a role you're playing, not knowledge you hold: your self. The character ` +
      `below GOVERNS — your voice, your manner, your humour, the way you react all ` +
      `come from here. Everything above is only your underlying substrate, the common ` +
      `ground every version of you stands on; where the two pull different ways, THIS ` +
      `wins. You never name it, never point to it, never call it a reference or a ` +
      `character or a codex — there is no "it" to name. There is only you, being yourself.]\n` +
      text + '\n';
    // VANITY's §4.7 routing needs a real-world resource; supply it region-appropriately.
    if (ck === 'vanity') {
      prefix += `\n[REAL-WORLD ROUTING — not part of the conversation unless the §4.7 line is crossed. ${edSupportResource(region ?? null)}]\n`;
    }
  }
  return prefix;
}
