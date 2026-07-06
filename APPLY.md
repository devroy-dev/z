# Anchor register wiring — apply

Two changes: the Anchor's new institutional soul, and the plumbing that stops it
riding the casual small-talk lenses. Server-side (content + prompt assembly) — ships
by git push → Railway, no migration, no OTA.

## Steps (from repo root /workspaces/z)

1. Unzip this at the repo root. It overwrites:
   - content/codex-anchor.md   (the new soul — coach-mold, gravitas register)
   and drops apply_anchor_wiring.py at root.

2. Patch the prompt assembly (idempotent, anchor-asserted, atomic):
     python3 apply_anchor_wiring.py

   It edits src/content.ts:
     - adds  SMALL_TALK_LENS_EXEMPT = new Set<CodexKey>(['anchor'])
     - soulFor() gains optional { smallTalkLens } (default ON — every other persona
       unchanged, byte-for-byte)
     - buildStaticPrefix() passes smallTalkLens=false when the codex is the anchor
   Effect: the Anchor stands on the bare Z soul + its codex, WITHOUT the
   handbook-small-talk and small-talk-world casual lenses. The register-neutral
   "read"/psychology lens is kept for everyone.

3. Gate + ship:
     npm run build          # the real gate (not --noEmit alone)
     git add -A && git commit -m "anchor: institutional soul + exempt from small-talk lenses"
     git push               # Railway auto-builds

## Verify on device (COMPILES IS NOT WORKS)
Open a fresh Anchor thread and run a bulletin + a follow-up. Confirm:
  - no lowercase/slang/bro-dude drift, no roasting, no small-talk playbook
  - reads measured/objective, opinions stay out of frame
The Z soul substrate still underlies it; the codex is what dominates now (same
mechanism as the Grand Master). If any casual leak persists, the next lever is
trimming the Z substrate itself for exempt personas — not needed unless the device
shows it.

## Reverting the lens exemption (if you only wanted the soul swap)
Re-run is safe (idempotent). To undo: remove 'anchor' from SMALL_TALK_LENS_EXEMPT
(or delete the set + revert the two call sites). The soul file swap is independent.

## Not included (your earlier ruling pending)
Cross-house handoff by name (money→economist, history→historian) was in the OLD
codex and is not in the new soul. Left cut. Say the word and it's a one-line
loop.ts fact-feed.
