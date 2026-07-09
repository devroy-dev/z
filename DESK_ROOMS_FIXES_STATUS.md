# DESK ROOMS — FIXES SPEC · STATUS
### Live state of the bug/UX contract. Sitting A shipped; Sitting B is next.

Spec: `DESK_ROOMS_FIXES_SPEC.md`. Protocol: `BUILD_PROTOCOL.md`.
Audited against commit `20f80c8` (post-zip97). Re-verified against live code
before editing; drift from the spec's line numbers is noted below.

## SHIPPED — SITTING A (zip: desk_rooms_fixes_A)
X1 pull-to-refresh · X2 visible-failure · X3 full-view · X4 extractable ·
X5 keyboard — across MediaRoom · TravelDesk · StylistRoom · Bulletin.
Native only; no server, no migration, no TS. See `APPLY_desk_rooms_fixes_A.md`
for the per-item breakdown and the build-ordering note.

**Proven:** babel/JSX parse clean on all four; patcher byte-identical +
idempotent + drift-refusing. **Not proven (owner's gates):** `expo export`,
device.

## OWNER RULINGS THIS SITTING
- **X4 uses `expo-clipboard` (true clipboard), not Share.** Owner accepted the
  EAS build. It's a native dep → ships on the build, not a bare OTA (ordering
  in the APPLY). Verb reads **copy ✂ / copy the verdict**.

## DRIFT FROM SPEC (code was truth; followed the code)
- **No migration anywhere in the fixes spec.** Every Sitting-B route rides an
  existing table (`mm_tasks`, `mm_analytics`, `trip_files.checklist` jsonb,
  `outfits`). **Ladder stays at `0058`** — do not reserve `0059` for these.
- Line numbers had drifted a little (audit vs live): MediaRoom null-render was
  L223/L237/L285 (not L226/238); the fixes landed on the live lines regardless.
- Spec X4 assumed clipboard-in-deps or RN-core `Clipboard`. Neither exists
  (grep clean; RN core dropped Clipboard by SDK 57). Resolved by owner ruling
  above (expo-clipboard + build).
- X1: rooms mount as **conditional overlays** (`Nav.js`) that unmount on close
  and remount fresh on open, re-running mount-`load()`. So X1 needed **only**
  RefreshControl — no AppState listeners (spec's "verify before adding" → not
  needed).
- X5: applied `keyboardShouldPersistTaps="handled"` (the mandated half). KAV
  was left to owner's device check per the spec's "only if actually covered."

## NEXT — SITTING B (zip 2, after A is device-proven)
Server → curl → native, per BUILD_PROTOCOL §5. Verified live facts for the build:
- **R1** `[[TASK]]` for the Media Manager — loop.ts MM block sits beside
  `[[IDEA]]` (src/loop.ts ~L226 emit; post-stream parse ~L527). Insert
  `z.mm_tasks` (`week_of=istDate()`, `status='open'`), same shape the desk note
  writes. Add the **hands law** to the MM block. gradeLaw: `writeDeskNote`
  (src/mmDesk.ts L156) reads `mm_tasks` `.limit(1)` today — change to this-week/open set.
- **M3** MediaRoom L233 renders `tasks[0]` → render all open + this-week done
  (struck), with the empty state; folds in R1's visibility.
- **MM-A** `DELETE /mm/analytics/:id` (+ edit = delete+reinsert or update).
  Table is `z.mm_analytics` (cols: id, user_id, platform, followers, reach,
  growth, top_content, period, created_at). Existing routes: POST `/mm/analytics`,
  POST `/mm/analytics/manual`, GET `/mm/analytics`, GET `/mm/ratecard`.
- **MM-B** `POST /mm/desknote/refresh` (user-authed) → `writeDeskNote(caller)`,
  once-per-IST-day gate (check latest `mm_desk_notes.created_at`), `logUsage`'d.
- **T4/T5** `PATCH /wanderer/trips/:id/check` — toggle `done` in `trip_files`
  .checklist jsonb (item text or index; whole-array write is fine). Optimistic
  UI; same field `[[CHECK]]` writes.
- **S4** `DELETE /stylist/outfits/:id` (user-scoped). ✕ on the OutfitCard or in
  the S1 sheet.

## STILL KNOWN-OPEN (unchanged)
Phase 6 — the Host's morning line (`§2.2E`/`§6.4`) stays unbuilt, last by design.
