# DESK ROOMS — FIXES SPEC · STATUS
### §0 recovered (by the owner's push). Fixes-2 sitting: BUG-1..5 shipped + PHASE 6 built. Curls are yours.

Spec: `DESK_ROOMS_FIXES_SPEC.md` + `DESK_ROOMS_HANDOVER_2.md`. Protocol: `BUILD_PROTOCOL.md`.
This sitting audited at `12ef8c5`; origin moved mid-sitting to `6cec67f` (the recovered
fixes-B native + DESK COMES ALIVE) — everything below re-verified and rebased onto it.

## §0 — THE UNPUSHED NATIVE WORK · RECOVERED ✓ (not rebuilt)
The lost tree surfaced and was pushed from the owner's side as `9f43d1f`/`93b99d5`/
`6cec67f` — the diffs carry the original `[fixes-B M3/MM-A/MM-B/T4/T5/S4]` markers.
The repo reproduces the device again. A parallel from-spec rebuild was completed in
this sitting and **dropped in favour of the recovered originals** (recovery beats
rebuild; byte-true to the device).
**S4 ruling — RECORDED: (a), the ✕ on the OutfitCard** (confirm-tap, "delete?"),
as shipped in the recovered tree and as this doc leaned. The S1 sheet stays about
seeing the look.
Note: T4/T5 as recovered ticks the **before-you-go rows + packing generics** (the
spec's letter); the owned packing rows (with thumbnails) are display-only. Declared,
not changed.

## SHIPPED — FIXES-2 (zip: desk_rooms_fixes_2, base `6cec67f`)
- **BUG-1 · the raw machine tags** — persist-strip verified sound in code (every
  tag replace precedes the assistant insert, loop.ts). The leak was the LIVE
  stream, fixed at the SERVER seam: `makeTagGate()` in `llm.ts`, composed after
  the provider gate in BOTH `loop.ts` and `groupLoop.ts` (+ a flush after
  finalMessage). Line-buffered: swallows `[[NAME: …]]` spans (multi-line bodies
  held to their `]]`), adjacent `---` separators, collapses blank runs; FAILS
  OPEN past an 800-char hold. Proven by a 12-case harness across chunkings from
  1 char to whole-message: bracketed prose (`array[0]`, `[[links]]`) untouched;
  a mid-line tag never eats following prose. *Your reload-diagnostic still comes
  first on device — see the APPLY.*
- **BUG-2 · the lying kicker** — computed from `week_of`: this week / last week /
  the date (ISO-Monday weeks, IST). Garbage/absent `week_of` → "on the file".
- **BUG-3 · gap re-runs** — bought + dismissed gaps (last 40) feed the audit
  prompt as ALREADY CLOSED; near-equivalents banned in the instruction.
- **BUG-4 · cross-source duplicate tasks** — the note-writer's instruction law
  extended: it may not emit a `[[TASK]]` substantively matching a still-OPEN
  commitment; it points back to the open one instead.
- **BUG-5 · the lying DELETEs** — `/mm/analytics/:id` + `/stylist/outfits/:id`
  now `delete({ count: 'exact' })` → **404 on zero rows**. B-native had NOT fixed
  this (verified at both `12ef8c5` and `6cec67f`).

## SHIPPED — PHASE 6 · THE MORNING LINE (§2.2E + §6.4)
`src/deskMorningLine.ts`: hourly tick + per-user IST-hour gate + one-per-IST-day
idempotency (a `scheduled_pings` row, kind `morning_line`) + 90s boot tick.
Composer rides `assembleDeskBrief` (the same house state as the marquee), Haiku,
`logUsage` fn `morning_line`. **Empty brief → no ping.** Delivery: one
`scheduled_pings` row, persona `the_front_desk`, the existing sweeper.
Server: `PATCH /me/morning-brief { on, hour(6–11) }`; `GET /me` now returns
`morningBrief` + `morningBriefHour`; `POST /dev/morning-line` (DEV_KEY, forced —
hour gate skipped, same-day idempotency holds). Native: a quiet toggle + 6–11am
chips at the foot of the Desk's "your list" panel (`app/Desk.js`), her register.

### DRIFT DECLARED (owner may re-rule)
1. **An OLD morning brief (#23, `morningBrief.ts`, 7 IST, default-on for active
   users) was already live** — unmentioned in the handover. One-knock resolved
   without regression: the old brief now SKIPS users with `morning_brief=true`;
   the new line serves only them (disjoint sets), plus a same-day `ping_log`
   'brief' guard in the composer. Nobody's current behaviour changed (the flag
   defaults false). If you'd rather retire #23 outright, it's a two-line cut.
2. **§6.4's newsroom morning-edition opt-in was never built** (no flag exists
   anywhere). Nothing to fold FROM; the day's lead already rides the brief as an
   item, so it folds into the line naturally when it ranks. Declared, not built.
3. **The weekly-read pointer clause skipped**: `journal_weekly` does not exist —
   per the handover's own "do not build ahead".

## THE PROOF LEDGER — yours to run (curls in `APPLY_DESK_ROOMS_FIXES_2.md`)
Open from handover-2 §2: (1) MM-B success path + week-grading · (2) S4 round-trip
with a real `[[OUTFIT]]` fixture · (3) pack-flag toggle · (4) hands-law eyeball.
New this sitting: (5) BUG-5 negative DELETEs → 404 · (6) morning-line opt-in →
forced tick → ping row → the line in the Host thread · (7) empty-brief user → no
row · (8) BUG-1 device eyeball (a chat turn that files a [[TASK]]: nothing paints).

## STILL KNOWN-OPEN
- The four handover-2 §2 proofs + this sitting's proofs above (device + curls).
- BUG-1's reload diagnostic on the original MM thread (expected: tags gone —
  persist was verified clean in code; if they persist, report before OTA).
- Root `DeskPane.js` + `patch_desk_alive.py` are committed at repo root — the
  gitignore misses them (`patch_desk_alive.py` isn't `apply_*`/`patch.py`).
  Housekeeping, owner's call.
