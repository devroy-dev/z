# CHAT & PERSONA SPEC — STATUS

Spec: CHAT_PERSONA_SPEC.md (v1). Build order §9. One phase per sitting.

## Phase ledger
| Phase | Scope | Status |
|---|---|---|
| 1 | P0 bug fixes (§1) | **BUILT — this sitting.** Patcher `apply_p0_chat_persona.py`, doc `APPLY_P0_CHAT_PERSONA.md`. Awaiting device verify. |
| 2 | Roster manifest backend + `app/roster.js` + delete 4 local registries (§2) | not started |
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

## Next sitting picks up
Phase 2 — the manifest. Read first: `src/manifest.ts` (capabilities manifest —
decide extend vs sibling `rosterManifest`), `src/personas.ts` (display fields go
here), `src/index.ts` route registration pattern, `app/ChatHome.js` `z_home_cache`
pattern for the client cache. Owner question queued for Phase 2: `shareable:false`
on romance seats — confirm before wiring (§2.1 says confirm with owner).

## Open asset dependency (Phase 5, flag early)
Three face images needed at `callmez.app/faces/{the_advocate,the_trainer,the_khansama}.jpg`
— monogram fallback covers the gap meanwhile.
