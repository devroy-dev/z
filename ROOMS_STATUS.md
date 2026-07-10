# ROOMS SPEC · STATUS
### The public-rooms rebuild (`ROOMS_SPEC.md`). H1 shipped this sitting. Verify-list findings + rulings recorded here so no future sitting re-litigates or re-discovers.

Protocol: `BUILD_PROTOCOL.md`. Hardening floor: `HUMAN_ROOMS_HARDENING.md` items 1–3, then spec phases 1–6. Audited at `ff6bae4`.

---

## RULINGS (owner, this sitting — locked)

1. **Migration 0060 stays reserved** — advisory z-side, parked with the lane (Erratum 2), wakes at the payments sitting. The hole is deliberate; 0061–0063 hold exactly as the spec wrote them. Written into BUILD_PROTOCOL §2.4: reserved numbers are law, never fill a hole, never renumber around one.
2. **Receipts: pending/sent/failed only.** Delivered/read is REFUSED now and gated as a *product* decision later, not an engineering follow-up: (a) needs per-member read-cursor infra that belongs with presence work; (b) read semantics are incoherent in persona chats — faking a persona's "read" is a lie, exposing engine timing is worse; (c) in public rooms, read receipts on handle-anonymous strangers are anti-privacy and create exactly the social pressure the house's unhurried register exists to refuse. If read receipts ever ship: human-DMs-only, opt-in, its own ruling. **H1's contract: the sender always knows pending / sent / failed-with-retry — failure visible, never silent (X2 law).**
3. **ChatHeader extraction: skipped, conditionally.** The R0 dismantle killed the forked surface, so the bug class the extraction targeted is dead; extracting a one-consumer component is ceremony. **THE INVARIANT (recorded, binding):** one header implementation across all chat surfaces — §7.2's public head will be built as a variant of the surviving surface (props/branches on the thin screens' topbar pattern), never a new header. The moment any future sitting needs to FORK a header to build something, this extraction debt returns due immediately, at that sitting's cost.

**MessageList / Composer unification status (stated explicitly per ruling 3):**
UNIFIED across all room-shaped surfaces. `DMScreen` and `CuratedRoomScreen` both compose from `useRoomFeed` + `MessageList` + `Composer` + `Presences`; the coming `PublicRoomScreen` (spec phase 1) composes from the same parts — the same invariant applies: a fork of MessageList or Composer for the public register is a spec violation (spec §12 "compose, don't fork"). `Chat.js` (persona 1:1) deliberately does NOT share these — it is its own register (Z's italic serif, its own bubbles, by its own comment) and stays outside the invariant.

---

## VERIFY-LIST FINDINGS (spec §12, run at `ff6bae4` — the spec's snapshot vs the repo)

| item | finding |
|---|---|
| strikes table | **EXISTS** — `z.room_strikes` + `z.room_sanctions` in 0029. Full ladder implemented in `doorman.ts`. 0062's "if absent" clause is moot. |
| room message send route | No room route exists — everything is `POST /chat` (index.ts ~3758). Two persist points behind one wall: DM branch inline; shared branch `groupLoop.ts:214`. **Layer 1 goes before both** (phase 2). Also found: nothing in the send path reads `room_sanctions` — the doorman's mutes are written but never enforced on send. Bigger hole than the spec knew; fixes with §6.1 wiring. |
| `setThreadPrefs` | Exists (`POST /thread/prefs`), whitelist pinned/favourite/archived → `thread_reads`. No mute — needs a `thread_reads.muted` column + whitelist entry (§6.2, phase 2). |
| `eveningProgramme.ts` | Exists but is the DESK's per-user 19:30 card note, not a room scheduler. §8's house slate is a **new build beside it** (reuse the pattern + MOTIONS + wire.ts), not an extension. Declared drift. |
| RPC `increment_public_room_count` | **NOT in any migration** — join falls back to the racy read-modify-write. Worse: `POST /rooms/:id/leave` never decrements `member_count` → counts ratchet up on every leave/rejoin. Both fix in 0061 (increment + decrement + leave route patch). |
| admin review tooling | None. `room_reports` rows land and sit. A SQL view ships with phase 2 (acceptable floor per spec). |

**Other drift declared:**
- `RoomChat.js` is dead (R0 dismantle, zip49) — every "find RoomChat" reference in the spec resolves to the useRoomFeed component family. **H2 declared satisfied by R0** (ruling 3).
- §6.2 partly shipped in `0048_reports_blocks.sql`: `room_reports` + `user_blocks` live with routes; DM block wall enforced in /chat. **The spec's 0062 SQL must not ship verbatim** — its `user_blocks(user_id,…)` conflicts with live `(blocker_id,…)`. Remaining for 0062: `room_reports.status`, `thread_reads.muted`, report-the-room client affordance, admin view.
- P0 #5 (personaMeta drift) already fixed — ChatHome rides `roster.js`; `shareableKeys()` is ready for the phase-3 host picker.
- P0 #4 softened: server always seats `the_moderator`, so rooms are doorman-only rather than empty; the host-centerpiece fix (phase 3) stands.
- Migration ladder tops at 0059. 0060 reserved (ruling 1). Rooms spec = 0061–0063 as written.

---

## H-TRACK LEDGER

| item | status |
|---|---|
| **H1 — optimistic send** | **SHIPPED this sitting** (see APPLY_H1_OPTIMISTIC_SEND.md). Pre-existing: instant you-line. Added: client id end-to-end (`clientId` → broadcast `client_id`, transport-only, no migration), pending → sent → failed-with-tap-to-retry, id-based echo dedupe (kills the silent identical-message drop), composer unlocked during in-flight sends, other-device own-echo now renders (was silently dropped). Receipts refused per ruling 2. Device-verify pending — curls in the APPLY. |
| **H2 — component extraction** | **SATISFIED by R0's dismantle** (ruling 3, invariant recorded above). No further build. |
| **H3 — presence + typing** | NOT BUILT. Next hardening sitting. Transport proven (duel keystream = client→client channels; zip48 inbox = per-user channels). Open ruling from the hardening doc still needed: last-seen privacy — on by default or opt-in. |

## NEXT SITTING PICKS UP
H3 (presence + human typing), or spec phase 1 (P0 fixes + gate §3 + doorway §4) if the owner reorders. Phase 1 note: `/public-rooms` directory returns no last-active — the doorway's "last active" line needs a threads join added to that route.
