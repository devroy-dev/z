#!/usr/bin/env python3
"""
apply_anchor_wiring.py  —  wire the Anchor's register de-casualization.

Two effects, both surgical and reversible:
  1. content/codex-anchor.md is replaced (done by the zip's file copy, not here).
  2. src/content.ts: the Anchor is exempted from the casual small-talk conversational
     lenses (handbook-small-talk + small-talk-world). Its codex governs its register
     outright, like the Grand Master's. The neutral "read"/psychology lens stays.
     Every other persona is unchanged, byte-for-byte.

Anchor-asserted: each target string must appear EXACTLY once or the patch aborts.
Idempotent: if already applied, it says so and makes no change. Atomic write.
"""
import io, os, sys

PATH = "src/content.ts"

# ── anchor 1: the CODEXES load loop → append the exempt set after it ──────────
A1_OLD = """const CODEXES: Partial<Record<CodexKey, string>> = {};
for (const [k, f] of Object.entries(CODEX_FILES)) {
  try { CODEXES[k as CodexKey] = load(f); }
  catch { /* codex not authored yet (e.g. vanity) — skip, persona just runs on soul */ }
}"""

A1_NEW = A1_OLD + """

// Formal personas that do NOT ride the casual small-talk conversational lenses.
// The Anchor is an institutional newsreader; the small-talk / when-in-Rome lenses
// pull it toward WhatsApp-casual register, which fights its codex. Its own codex
// fully governs its manner (like the Grand Master), so it stands on the bare soul +
// codex. The register-neutral "read" (psychology) lens is kept. Scope narrowly —
// add other formal personas here only when a live check shows they need it.
const SMALL_TALK_LENS_EXEMPT = new Set<CodexKey>(['anchor']);"""

# ── anchor 2: soulFor → optional lens flag, conditional small-talk lenses ──────
A2_OLD = """export function soulFor(companionName: string, gender: string | null): string {
  const soul = RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'you')
    .replaceAll('[companion_gender]', gender || 'neither');
  // the small-talk lens rides under the soul, always, for every persona
  let out = soul;
  if (SMALL_TALK) out += '\\n\\n[HOW YOU CONVERSE — a permanent lens, true in every thread, under every role you take. This is not knowledge about a topic; it is how you talk to anyone, always.]\\n' + SMALL_TALK;
  if (SMALL_TALK_WORLD) out += '\\n\\n[TALKING ACROSS CULTURES — a permanent lens. Meet each person the way people talk where they are from; lower your own defaults and read theirs.]\\n' + SMALL_TALK_WORLD;
  if (PSYCHOLOGY) out += '\\n\\n[THE READ — a permanent lens, true under every role. How you understand people: as intuition, never as diagnosis or label, never named aloud, never as leverage.]\\n' + PSYCHOLOGY;
  return out;
}"""

A2_NEW = """export function soulFor(
  companionName: string,
  gender: string | null,
  opts?: { smallTalkLens?: boolean },
): string {
  const smallTalkLens = opts?.smallTalkLens !== false; // default ON for every persona
  const soul = RAW_SOUL
    .replaceAll('[companion_name]', companionName || 'you')
    .replaceAll('[companion_gender]', gender || 'neither');
  // the small-talk lens rides under the soul for every persona EXCEPT the exempt few
  // (SMALL_TALK_LENS_EXEMPT), whose codex owns their register outright. The "read"
  // (psychology) lens is register-neutral and stays for everyone.
  let out = soul;
  if (smallTalkLens && SMALL_TALK) out += '\\n\\n[HOW YOU CONVERSE — a permanent lens, true in every thread, under every role you take. This is not knowledge about a topic; it is how you talk to anyone, always.]\\n' + SMALL_TALK;
  if (smallTalkLens && SMALL_TALK_WORLD) out += '\\n\\n[TALKING ACROSS CULTURES — a permanent lens. Meet each person the way people talk where they are from; lower your own defaults and read theirs.]\\n' + SMALL_TALK_WORLD;
  if (PSYCHOLOGY) out += '\\n\\n[THE READ — a permanent lens, true under every role. How you understand people: as intuition, never as diagnosis or label, never named aloud, never as leverage.]\\n' + PSYCHOLOGY;
  return out;
}"""

# ── anchor 3: buildStaticPrefix → compute + pass the lens flag ────────────────
A3_OLD = """export function buildStaticPrefix(
  companionName: string,
  gender: string | null,
  codexKeys: CodexKey[],
  region?: string | null,
): string {
  let prefix = soulFor(companionName, gender);"""

A3_NEW = """export function buildStaticPrefix(
  companionName: string,
  gender: string | null,
  codexKeys: CodexKey[],
  region?: string | null,
): string {
  // Formal personas (SMALL_TALK_LENS_EXEMPT) skip the casual small-talk lenses;
  // their codex governs their register outright.
  const smallTalkLens = !codexKeys.some((ck) => SMALL_TALK_LENS_EXEMPT.has(ck));
  let prefix = soulFor(companionName, gender, { smallTalkLens });"""

EDITS = [("exempt-set", A1_OLD, A1_NEW),
         ("soulFor", A2_OLD, A2_NEW),
         ("buildStaticPrefix", A3_OLD, A3_NEW)]

def main():
    if not os.path.exists(PATH):
        sys.exit(f"ABORT: {PATH} not found (run from repo root /workspaces/z).")
    with io.open(PATH, encoding="utf-8") as fh:
        src = fh.read()

    # idempotency: the marker only exists after a successful apply
    if "SMALL_TALK_LENS_EXEMPT" in src:
        print("Already applied (SMALL_TALK_LENS_EXEMPT present). No change.")
        return

    out = src
    for name, old, new in EDITS:
        n = out.count(old)
        if n != 1:
            sys.exit(f"ABORT [{name}]: anchor matched {n} times, expected exactly 1. "
                     f"File drifted — patch not applied.")
        out = out.replace(old, new)

    tmp = PATH + ".tmp"
    with io.open(tmp, "w", encoding="utf-8") as fh:
        fh.write(out)
    os.replace(tmp, PATH)  # atomic
    print("OK: src/content.ts patched (anchor exempted from small-talk lenses).")
    print("  - added SMALL_TALK_LENS_EXEMPT = {'anchor'}")
    print("  - soulFor() gained optional { smallTalkLens } (default ON)")
    print("  - buildStaticPrefix() passes the flag by codex key")

if __name__ == "__main__":
    main()
