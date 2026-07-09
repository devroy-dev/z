# DESK ROOMS — FIXES SPEC · STATUS
### Sitting A shipped. Sitting B split at the curl gate: SERVER shipped, NATIVE pending an owner call.

Spec: `DESK_ROOMS_FIXES_SPEC.md`. Protocol: `BUILD_PROTOCOL.md`.
Audited at `20f80c8`; Sitting A committed (origin now `25b6499`). Re-verified
against live code before each edit.

## SHIPPED — SITTING A (zip: desk_rooms_fixes_A) — on the EAS build
X1 refresh · X2 visible-failure · X3 full-view · X4 extractable (expo-clipboard) ·
X5 keyboard, across the four rooms. Native only. Device-verification in progress
on your build. See `APPLY_desk_rooms_fixes_A.md`.

## SHIPPED — SITTING B · SERVER (zip: desk_rooms_fixes_B_server)
R1 `[[TASK]]` verb + hands law + week-grading (loop.ts + mmDesk.ts) · MM-A
analytics correct/delete · MM-B desk-note refresh (once/IST-day) · T4/T5 checklist
tick · S4 delete outfit. Server only; **no migration**; ladder stays `0058`.
**Proven here:** `npm run build` clean on current HEAD; 5 routes in compiled
output; patcher byte-identical + idempotent + drift-refusing. **Yours:** the
curls in `APPLY_desk_rooms_fixes_B_server.md`, then the native pass.

### Design decisions this sitting (mine to make, per spec — noted for the record)
- **MM-A correction = UPDATE route**, not delete+reinsert. The ledger's
  `created_at` ordering is meaningful (rate card + desk note read direction
  across filings); a correction must not jump a row to "now". `PATCH
  /mm/analytics/:id` updates the fields in place.
- **T4/T5 match** = exact item text (+ optional `pack` flag) or `index`, writing
  the same `checklist` jsonb `[[CHECK]]` writes — zero divergence between the
  chat tag and the button.
- **MM-B gate** lives in `refreshDeskNote()` in mmDesk.ts (with `istDate`, its
  home), not in the route — the cost guard belongs with the generator.

## BLOCKING THE NATIVE PASS — ONE OWNER CALL (S4)
Spec S4: "x on OutfitCard (the PieceTile pattern) — **or** inside the S1 detail
sheet, **owner's call**; one of the two must exist." The S1 detail sheet already
shipped in Sitting A. So:
- **(a) x on the OutfitCard** — delete from the horizontal looks strip, matches
  the wardrobe-tile / trip-card delete pattern (confirm-tap).
- **(b) x inside the S1 sheet** — a "remove this look" at the bottom of the
  detail sheet, next to "talk about this look ->".
My lean: **(a)** — deletion belongs where the collection is scanned, and it
matches the app's existing tile-delete muscle memory; the sheet stays about
*seeing* the look, not managing it. One word and I build it.

## NEXT — SITTING B · NATIVE (after server curls green + S4 ruled)
- **M3** MediaRoom L233: render ALL open tasks + this-week's done (struck), with
  the empty state; folds in R1's visibility and fixes the nothing-tappable-
  before-first-note state.
- **MM-A UI** x (confirm-tap) + tap-to-edit prefilling the manual form as a
  correction -> `PATCH /mm/analytics/:id`.
- **MM-B UI** refresh by "the desk note" (Bulletin header pattern) -> `POST
  /mm/desknote/refresh`; render the 429 line honestly.
- **T4/T5 UI** the "before you go" + packing generics become Pressables,
  optimistic, reconcile on failure -> `PATCH /wanderer/trips/:id/check`.
- **S4 UI** per the ruling above -> `DELETE /stylist/outfits/:id`.
- Ships BOTH `eas update` + `git push` (OTA != committed). No native dep here —
  pure OTA once your Sitting-A build is the installed binary.

## STILL KNOWN-OPEN (unchanged)
Phase 6 — the Host's morning line (`§2.2E`/`§6.4`) stays unbuilt, last by design.
