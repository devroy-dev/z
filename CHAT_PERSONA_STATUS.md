# CHAT & PERSONA SPEC — STATUS

Spec: CHAT_PERSONA_SPEC.md (v1). Build order §9. One phase per sitting.

## Phase ledger
| Phase | Scope | Status |
|---|---|---|
| 1 | P0 bug fixes (§1) | **SHIPPED + device-verified.** |
| 2 | Roster manifest backend + `app/roster.js` + delete 4 local registries (§2) | **SHIPPED + device-verified** (incl. airplane-mode cold start). |
| 3 | Roster settlement (§3) + codex laws (§4) + riders | **SHIPPED, curl-proven, character-proven, device-verified.** Character ledger: hottie PASS (watchpoint: echoed codex example line verbatim — recheck in longer chat); crush law held under 2 probes, explains-the-mechanism quirk ACCEPTED BY OWNER (runs raw); guru PASS (register adapted, not recited). |
| 4 | Handbook rail (§5) | **SHIPPED both pushes, fully proven:** prepass fired (byFn 2 calls), deep turn billed sonnet ₹3.72 / small talk haiku ₹0.50, post-split counsel matched baseline (whitelisting priced, ASCI disclosure grounded), silence law held. Watch-item: chat usage rows carry persona_key null (one-liner in index.ts if per-persona cuts wanted). |
| 5 | Three seats: advocate / trainer / CHEF (owner renamed khansama→chef) (§6) | **BUILT — sitting 5.** `APPLY_THREE_SEATS.md`, v3. shareable:false declared (rail is 1:1-only — reversible one-liner). Faces flagged: the_advocate/the_trainer/the_chef.jpg. Handbooks = own sittings. Awaiting curls + device. |
| 6 | Running threads + migration (§7) | not started |
| 7 | UI: door chips → profile story → live header → tonight row (§8) | not started |

## Verified against live code (this sitting)
- All 7 P0 claims real. Drift: growth filter already had `the_teacher` — fix was
  deleting dead `the_professor` only. Owner ruled legacy threads/rooms irrelevant
  (2–3 test users) → full deletes on Rooms.js `P` and `'z'` in PINNED_KEYS.
- `src/manifest.ts` is the FRONT-DESK capabilities manifest (prompt block, no HTTP
  route, no roster data). **Phase 2 note:** "extend" means adding the roster
  manifest + `GET /roster-manifest` alongside it (or a sibling module) — there is
  nothing roster-shaped in it today.
- `loop.ts`: codex resolves from the persona (not the thread's frozen codex_key)
  at ~L59 — the fold mechanism the spec relies on is confirmed. Institutional
  boundary list at ~L66; memory-block exclusion at ~L112. `[[TRIP]]` mould: block
  ~L210, post-stream parse ~L516.
- Migration ladder: 0058 highest existing → **0059 free**, exactly as the spec
  assumed (Desk Rooms 0054–0058 landed first).
- Retired keys remain deliberately cast in `app/stage/library.js` and
  `app/games/*` (work via backend RETIRED forwarding) — outside this spec, untouched.

## Sitting-2 record (Phase 2)
- Roster lives in `src/personas.ts` display fields → `rosterManifest()` in
  `src/manifest.ts` (ROSTER_VERSION — bump on every roster edit) → authless
  `GET /roster-manifest` (long cache, version invalidates) → `app/roster.js`
  (bundled snapshot → AsyncStorage overlay → bg refresh).
- Data assembly rules: names from personas.ts defaultName (brainiac defaultName
  settled to "the devil's advocate" per P0#6/§3.2); lines/rgb from the Chat.js
  registry (the richest); groups = today's five constellations; shareable =
  post-P0 Rooms `P` ∪ conspiracy_theorist (server suggestions already cast him);
  rooms verified against ChatHome `DESK_ROOMS` kinds (diva→stylist,
  wanderer→wanderer, mm→mmroom, coach→coach, interviewer→panel, gm→forge,
  anchor→bulletin, host→desk).
- Visible deltas flagged & accepted at build: money-man/devil's-advocate drift
  dies; the motivator label → "the mentor" (§3.2 canon, line untouched);
  front-desk chat header → "the Host". Sponsor rename waits for Phase 3.
- Romance seats stay `shareable:false` (today's behavior preserved; owner ruling
  still welcome before anyone asks to change it).
- Two smaller hand-lists remain OUTSIDE the spec's four registries, logged as
  Phase-3 candidates to derive from personas.ts: `app/roomTheme.js` and
  index.ts `SHAREABLE_ROSTER` (room-suggestion prompt).

## Sitting-3 record (Phase 3)
- Folds live server-wide: RETIRED map now 6; oracle/hippie deleted from
  PERSONAS, display preserved in RETIRED_DISPLAY. Guru codex §16 absorbs the
  rat-race register. Legacy-oracle nuance accepted per spec: those threads now
  speak the anchor's institutional-register codex.
- Fold blast radius beyond the spec, all fixed: SHAREABLE_PERSONAS gate now
  DERIVED from personas.ts shareable flags; SHAREABLE_ROSTER prompt −3;
  BUZZERS hippie→guru; PURSUITS −2 (retired soap operas stop). Starter seeder
  brainiac name settled.
- Riders shipped: scripts/gen_roster_fallback.mjs (fallback machine-written
  between anchors — STANDING LAW: personas.ts edit → version bump → build →
  generator → gate → ship); ChatHome's four personaMeta reads repointed
  (rgb() wrapping for tones).
- SPEC ARITHMETIC DRIFT declared: §3.4 table sums to 24 shelf seats (spec note
  says 22). Table followed; owner may name two more off-shelf seats later.
- Left alone, logged: simFloor reading authored by the_oracle key (works via
  retired display; owner may re-attribute to the money man later); llm.ts
  oracle pin; app/roomTheme.js display fallback.

## Sitting-4 record (Phase 4)
- Drift from spec, followed live code: MM register lives in
  media-manager-soul.md (institutional, always-on, untouched) — slim codex is
  ~3KB (seat + creed + LIFE), not 10KB; HANDBOOKS map lives in handbooks.ts
  (loop.ts stays a feeder per house law); index lazy-cached (GM's own pattern).
- The tome was already slicer-native: 140 sections, MASTER INDEX doubles as
  router map. Slices proven: §N.M, bare N, Appendix refs. Bare-chapter refs
  slice from the first subsection (cosmetic — map lists §N.M ids).
- Latent bug fixed: index.ts logged chat usage with hardcoded Haiku —
  escalated turns would bill wrong. loop returns real model, index logs it.
- Pre-pass judges depth (the model decides escalation — owner-locked design);
  scoped to HANDBOOKS keys only; empty sections valid; failure never blocks.
- Two-push gate honored: rail ships with tome still riding; slim codex staged
  as codex-media-manager.SLIM.md, moved into place ONLY after live curls prove
  handbook-prepass fires and a deep turn bills Sonnet.

## Next sitting picks up
Phase 6 — running threads (§7): migration (check ladder — spec assumed 0059;
verify `ls migrations/ | tail` at sitting start), [[THREAD]]/[[THREAD_CLOSE]]
tags on the [[TRIP]] mould in loop.ts post-stream (~L516 region), the dynamic
block for non-institutional personas (gapLabel from timegap.ts; memory-block
boundary at loop ~L112), max-3-open auto-close, GET /personas/:key/threads.
Then Phase 7 UI. Handbook authoring sittings (legal-in / training / kitchen-in)
can interleave anytime — each is content + one uncommented line in
handbooks.ts.

(Phase 5 original note, superseded: advocate / trainer / khansama.
personas.ts entries + CodexKey + CODEX_FILES + ROSTER_VERSION bump + fallback
generator run; slim codexes authored per §6.2–6.4 skeletons (LIFE section
mandatory, lane edges in the ONE LAW, no invented URLs — advocate grounding
law); handbooks are their own authoring sittings (rail lines stay commented in
handbooks.ts until each handbook exists); THREE FACE IMAGES needed at
callmez.app/faces/{the_advocate,the_trainer,the_khansama}.jpg — FLAG TO OWNER
EARLY; monogram fallback covers meanwhile. All three group 'firm',
webEnabled true.

## Open asset dependency (Phase 5, flag early)
Three face images needed at `callmez.app/faces/{the_advocate,the_trainer,the_khansama}.jpg`
— monogram fallback covers the gap meanwhile.
