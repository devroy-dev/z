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

## H1B + COALESCER (second sitting, CE rulings executed)

**Rulings received (locked):** H1b GO as designed; Problem 2 straight to (b) — the composer never relocks, house register; Problem 3 LOW, mechanical strip only, names-not-shapes (`^[A-Za-z@ ]{1,24}:` ruled too hungry — strip only known member/persona names); Problem 4 SHIP the conditional register line (one-human rooms are the dominant use, register wound not polish). 3+4 bundled as the next groupLoop sitting, never ridden in.

**Shipped (apply_h1b_coalescer.py):**
- Dedupe on DB message id: all three inserts `.select('id')`, broadcast carries `id`; client checks BOTH candidate keys before painting and registers both after (arrival-order-proof); content-key demoted to last-resort (old-payload fallback); `created_at` tier deleted. Own pg_changes-first arrival reconciles by text instead of doubling.
- `realtime.js` header rewritten to teach the law (CE condition — the mechanism that failed).
- `src/turnCoalescer.ts`: per-thread turn gate — 2s idle debounce, pending accumulation, RECURSIVE re-check (comment forbids one-shotting it), error-clear + 90s hard TTL (silence-by-bug law), newest closure wins. DIRECTOR silence law untouched — the gate spawns turns, never forces replies.
- `/chat` shared conversation path: persist + broadcast + `{done, saved, client_id}` INSTANTLY; the turn runs out-of-band via the coalescer. Games/roleplay threads (`game_mode`/`scenario_key`) keep the old synchronous one-turn-per-move path.
- Unit harness proven: 4-message burst → 1 turn; mid-turn accumulation → exactly one recursive follow-up from the newest message's closure; thrown turn → guard clears, next message revives the room.

**Behavior changes declared:**
- In conversation rooms the SSE no longer streams persona tokens (clients already rendered from broadcast; `onToken` was a no-op) — the sent tick now flips near-instantly.
- The client's optimistic typing bubble may fade (2.5s grace) before a coalesced reply lands; the reply then appends bubble-less. Defensible under the pacing law; revisit with H3's real typing indicators.
- An image in a coalesced burst rides only the turn that fires; earlier fragments' photos survive in history as the `[shared a photo]` marker.

**Watch items:** Problem 3 (self-prefix leak, names-not-shapes strip) + Problem 4 (conditional direct-address register) = the next groupLoop sitting, with the proof pair (one human → direct address; second human joins → narration returns). `/rooms` GET shadowed by `public/rooms/` static dir → `express.static(..., { redirect: false })` one-liner, owner has not yet ruled it in.

## H1C — INBOX LIVENESS (third sitting) + THE DM PRODUCT RULING

**PRODUCT RULING (owner, recorded as ordered):** human↔human DMs are commodity plumbing, not product — they stay at their current floor PERMANENTLY. The canonical social unit is the INHABITED ROOM (humans + personas). Consequences, binding on all future sittings of this spec: H1c was fixed because the inbox path is the list's liveness for ROOMS/GROUPS (the DM was merely the test vector); H3's presence/typing scopes to rooms only — no DM typing, no DM presence, ever; no further DM-specific sittings exist in this spec's future.

**H1c diagnosis (CE leg-3 prior + field screenshot `inbox:connecting b:0`, all three shapes verified in code):** (1) getClient set realtime auth once-or-never — cold-start race cached the singleton unauthed forever, rotated tokens never refreshed; (2) one .subscribe(), no retry — a failed/never-answering join stayed dead until remount, and the diag's initial 'connecting' was simply never overwritten; (3) the "already live" early-return neither replayed status nor rewired handlers — a remount read 'connecting b:0' over a healthy channel feeding a dead closure.

**Shipped (apply_h1c_inbox_liveness.py):** AUTH LAW — token (re)applied on every getClient call (rooms/duels inherit for free); RETRY LAW — inbox join watchdog (8s no-answer = failure) + backoff re-join capped at 5 (statuses surface as retrying-N / gave-up), retry re-runs auth; early-return now rewires handlers through module refs and replays the last real status. The zip56 probe demoted behind the founder diag flag (long-press callmeZ) — invisible in production, one flag away forever (CE: it just proved its worth).

**Proof pair (device):** BEFORE (current build): probe reads `inbox:connecting b:0` on the chats list — confirms field reproduction. AFTER (OTA): probe reads `SUBSCRIBED`, `b:` increments on a curl-fired room/DM message with the list on screen, and the row bumps + reorders live. Bump-buffer race guard NOT added per CE — only if leg-1 evidence appears post-fix.

## H1C-2 — THE TRUE FIX (erratum on H1c's diagnosis, CE GO with four conditions)

**Root cause, final:** `GET /me` never returned an `id`; ChatHome guarded on `me?.id`; **`subscribeInbox` never executed on any build in the app's history.** `inbox:connecting b:0` was not a sick channel — it was NO channel: the probe's untouched initial state. H1c's three legs (mine) and the leg-3 prior (CE's) were both analysis of code with zero executions. The room channel's post-H1c `rt:SUBSCRIBED r:1` proved the socket/auth healthy throughout.

**Shipped (apply_h1c2_identity.py):** `/me` gains `id: user.id` — the identity endpoint's silence about identity caused this and would cause it again (CE's reason on record). ChatHome resolves `me?.id || loadSession().userId` (z_real_uid = the same z.users.id, minted by /auth/verify) — survives the deploy gap — with the precondition documented at the guard so the next author inherits tonight instead of repeating it. H1c's hardening (auth law, retry watchdog, early-return rewire) STAYS: real latent defects, now guarding code that runs.

**THE PROBE LAW (systemic lesson, CE condition 3, binding on future diagnostics):** a diagnostic that renders identically for never-attempted and attempting-and-failing is a diagnostic that LIES — it burned two diagnoses on this one channel. The inbox probe now reads `off` until subscribeInbox is truly invoked, `connecting` only once it is. Probe stays behind the founder flag (long-press callmeZ), one flag away forever.

**Proof (CE condition 4):** list on screen, bump curl fired → `inbox:SUBSCRIBED` for the first time in the app's history, `b:` ticks, the row moves without a reload. Owner to screenshot the probe line for this doc — the tombstone of a good bug.

## R1 — THE FLOOR'S REGISTER (this sitting, ROOMS_SPEC_V2 phase R1)

**Shipped (apply_rooms_r1.py + 6 new files — see APPLY_ROOMS_R1.md):** the
server-side gate (0061: `public_consent_at` + the count RPC pair + the
`public_rooms(thread_id)` index; typed join refusals consent_required /
dob_required / underage), handles (0063 verbatim from v1 §7.1; claimed at the
join, doorman-checked, unique per room, locked at first message, restored on
rejoin), THE IDENTITY WALL server-side at every leak point (members endpoint
→ handles + null DPs; history roster; /chat sender_name both paths; the
DIRECTOR's nameByUid + owner-line suppression in `groupLoop.ts` via
`src/publicIdentity.ts`), leave AND kick decrement (counts no longer ratchet),
directory `lastActive`, and the sealed invite-token bypass (`POST /join/:token`
→ 409 `public_room` for public threads — the floor has one door). Native: the
wired PublicDoorway (dob-once, house rules until consented, handle line with
reroll), PublicRoomScreen as the THIRD thin shell (lean head, flat handle
feed, no presence row, member sheet), Nav routes public rooms away from
CuratedRoomScreen forever, ChatHome's AsyncStorage consent flag deleted.

**Declared deviations:** 0061 landed in R1 (it IS the gate migration;
append-only ladder forces it whole) — R2 keeps 0062 + doorman wiring + mute
hole + inhabitation law. Memory chip (§7.2) deferred — owner to slot. Lobby
world-pill placeholder + PublicRoom.js mock untouched (R3 kills them).
CuratedRoomScreen's dead isPublic branches left for regression safety.
Pre-0063 members read 'someone' until their next doorway pass.

**Proofs:** curls in APPLY_ROOMS_R1.md §proofs (gate codes on the fresh test
account; wall on members/history/broadcast; handle lock; count decrement;
bypass 409). Device verification pending — owner runs the proof pair.

## R2 — THE DOORMAN ACTUALLY GUARDS (this sitting, ROOMS_SPEC_V2 phase R2)

**Shipped (apply_rooms_r2.py + 0062 — see APPLY_ROOMS_R2.md):** Layer 1 sync
before insert at all THREE persist points (spec named two; the coalescer
added a third — DM inline, coalesced shared, groupLoop's own), with the
ladder feeding in public rooms (all Layer-1 classes are severe → instant ban
+ removal + doorman line). The mute hole closed (send path reads
room_sanctions; typed muted/barred rejections). Layer 2 judge wired after
every clean public persist, with logUsage (fn doorman-judge) added per house
law; doormanSpeak now broadcasts (lines only persisted before); ban/kick
removals decrement member_count (the R1 ratchet class). 0062 reduced as
audited: room_reports.status, thread_reads.muted (+ whitelist + a prefs GET),
the z.open_room_reports view; report-the-room accepted ({room:true}). THE
INHABITATION LAW: hostless public-room creation is 400 host_required
(/rooms already enforced it; DMs + duel floors exempt by the taxonomy
ruling). Native: blocked-state rendering (typed doorman codes ride
streamChat; no retry on a block), the required host picker on shareableKeys()
with keyword preselect, report-room + mute-room in the register's sheet.

**Deferred, owner to slot:** host behaviors (greeting · @host · the pulse —
v1 §5.2, was v1 phase 3); legacy hostless-room backfill (v1 phase 6);
thread_reads.muted enforcement lands with room notifications (v1 §10).

**Proofs:** curls in APPLY_ROOMS_R2.md — host_required, Layer-1 instant ban
observable end to end (block, removal, decrement, doorman line, barred
rejoin), injected-mute rejection, judge strike + warning line, report-room +
view, prefs pair. Offender is always the disposable account in a disposable
room. Device verification pending.

## NEXT SITTING PICKS UP (updated)
R3 — the nav fold (V2 §1): the chat·play world pill dies, one bottom nav
(the Desk · chats · rooms · play), the Gathering's tonight-row moves home,
the Lobby placeholder chain + PublicRoom.js mock deleted, DM-creation
affordances die (existing DM threads stay readable), the H1c-2 inbox bump
verified across both tabs — the fold's only transport risk.
