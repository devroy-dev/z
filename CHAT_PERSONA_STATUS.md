# CHAT & PERSONA SPEC — STATUS

Spec: CHAT_PERSONA_SPEC.md (v1). Build order §9. One phase per sitting.

## Phase ledger
| Phase | Scope | Status |
|---|---|---|
| 1 | P0 bug fixes (§1) | **SHIPPED + device-verified.** |
| 2 | Roster manifest backend + `app/roster.js` + delete 4 local registries (§2) | **SHIPPED + device-verified** (incl. airplane-mode cold start). |
| 3 | Roster settlement: folds, renames, regroup, wannabe move (§3) + guru absorb + hottie/crush law rewrites (§4) + riders (fallback generator, ChatHome repoint) | **BUILT — sitting 3.** `APPLY_ROSTER_SETTLEMENT.md`, ROSTER_VERSION 2. Awaiting curls + device. |
| 4 | Handbook rail: MM 98KB→10KB split + pre-pass + escalation (§5) | not started |
| 5 | Three new seats: advocate / trainer / khansama (§6) | not started |
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

## Next sitting picks up
Phase 4 — the handbook rail (§5): MM codex 98KB→~10KB split (LIFE heading
sacred), handbook-media-manager.md in §N slicer format, pre-pass wiring in
loop.ts (Haiku temp-0 JSON, empty sections valid), Sonnet escalation via
modelForTier('top') scoped to handbook personas, logUsage fn tags
('handbook-prepass', escalation). Read first: src/codexRetrieval.ts,
src/grandMaster.ts (~L6 streaming rationale), src/loop.ts static-prefix
assembly + models.ts. Curl-prove the pre-pass BEFORE the split ships (§9).

## Open asset dependency (Phase 5, flag early)
Three face images needed at `callmez.app/faces/{the_advocate,the_trainer,the_khansama}.jpg`
— monogram fallback covers the gap meanwhile.
