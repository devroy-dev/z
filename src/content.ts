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

const CODEX_FILES: Record<CodexKey, string> = {
  intellect: 'codex-intellect.md',
  close:     'codex-close.md',
  people:    'codex-people.md',
  shadow:    'codex-shadow.md',
  inner:     'codex-inner.md',
  forward:   'codex-forward.md',
  vanity:    'codex-vanity.md',   // Codex #7 — added when Fable writes it
};

const CODEXES: Partial<Record<CodexKey, string>> = {};
for (const [k, f] of Object.entries(CODEX_FILES)) {
  try { CODEXES[k as CodexKey] = load(f); }
  catch { /* codex not authored yet (e.g. vanity) — skip, persona just runs on soul */ }
}

// The soul with the user's chosen companion name injected.
export function soulFor(companionName: string, gender: string | null): string {
  return RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'you')
    .replaceAll('[companion_gender]', gender || 'neither');
}

export function codexText(key: CodexKey): string | null {
  return CODEXES[key] ?? null;
}

// The cached static prefix: soul (named) + the Codex(es) as "your preparation".
// Mirrors consultantHarvey: the Codex rides after the soul as silent prep that Z
// speaks from as its own knowledge and names to no one.
export function buildStaticPrefix(
  companionName: string,
  gender: string | null,
  codexKeys: CodexKey[],
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
  }
  return prefix;
}
