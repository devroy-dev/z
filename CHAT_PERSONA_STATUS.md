# CHAT & PERSONA SPEC — STATUS

Spec: CHAT_PERSONA_SPEC.md (v1). Build order §9. One phase per sitting.

## Phase ledger
| Phase | Scope | Status |
|---|---|---|
| 1 | P0 bug fixes (§1) | **SHIPPED + device-verified.** |
| 2 | Roster manifest backend + `app/roster.js` + delete 4 local registries (§2) | **BUILT — sitting 2.** `APPLY_ROSTER_MANIFEST.md`; server curls must pass before OTA. Awaiting device verify. |
| 3 | Roster settlement: folds, renames, regroup, wannabe move (§3) + guru absorb + hottie/crush law rewrites (§4) | not started |
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

## Next sitting picks up
Phase 3 — roster settlement (data edits only now: folds oracle→anchor +
hippie→guru incl. guru codex absorb section, renames mentor-line/sponsor,
§3.4 regroup as ROSTER_GROUPS + group-field edits, wannabe off-shelf/unseatable)
+ §4 hottie/crush codex law rewrites. Every roster edit = personas.ts +
ROSTER_VERSION bump. Remember: folds move RETIRED entries and delete PERSONAS
entries — keys stay reachable via personaByKey forever.

## Open asset dependency (Phase 5, flag early)
Three face images needed at `callmez.app/faces/{the_advocate,the_trainer,the_khansama}.jpg`
— monogram fallback covers the gap meanwhile.
