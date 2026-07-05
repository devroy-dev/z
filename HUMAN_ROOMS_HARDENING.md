# Human Rooms — Hardening Pass (spec for later polish)

*Authored 2026-07-05. A deliberate design pass for the human↔human / shared-room surface,
which is currently the weakest link in the app. This is a plan to decide against, not a
build order to execute blindly — scope is Dev's ruling.*

---

## The honest assessment

DMs and rooms were bolted onto a surface built for human↔AI chat. A DM is literally
"a room with zero personas" (`room.personas === []`), and `RoomChat.js` is one component
straining to be three things at once: group persona rooms, 1:1 human DMs, and a game host.
It currently branches on `isDM` in ~9 places.

That's why the recent run of fixes were patches on patches — the peer DP wasn't wired, the
header buttons weren't there, delete had no restart path, the keyboard wasn't handled. Each
was a real bug, but they're all symptoms of the same root cause: **the human-social layer
never got the deliberate design pass the AI-chat layer did.**

**Strategic framing (important):** the differentiator is NOT human↔human chat — WhatsApp /
iMessage / Discord own that, and we can't out-build them on table stakes. The moat is
*humans + AI + memory in a shared room*. So the goal here is not "match WhatsApp." It's
**"make the human layer good enough to not embarrass the AI magic sitting next to it."**
Right now it's below that bar, and a janky DM undercuts trust in the whole product — which
is why this is a launch-credibility problem, not a future feature.

---

## Concrete gaps (grounded in the current code)

### 1. Realtime reliability & feel
- **No optimistic send.** The sender's bubble waits on the round trip. Should render
  instantly with a client-generated id + a pending tick, then dedupe the echo by id.
  (`broadcast.ts` is now REST + fire-and-forget, so the transport is fast, but the *client*
  still isn't optimistic.)
- **No delivery / read state.** No "sent / delivered / read" — no `delivered_at` / `read_at`
  on messages, no receipts. In a 1:1 this absence is felt immediately.
- **No human typing indicator.** The typing bubble exists only for persona replies
  (`pendingRef` / `who:'them' typing`). Human-to-human has none.
- **No presence.** No "online / last seen." `HumanPresence` shows a face but not real status.
- **Gap-repair is implicit only.** Reconnect relies on the `postgres_changes` fallback in
  `realtime.js` deduping a missed broadcast; there's no explicit "fetch messages since
  cursor" on reconnect. Good enough today, fragile at scale.

### 2. Lifecycle plumbing is thin
- Create / find / delete / restart a DM was half-wired — the delete-then-stranded bug was
  hit live (fixed by making Settings friends tappable → `openDM`). That it was reachable at
  all shows the lifecycle wasn't designed end-to-end.
- **No block / mute / report on a DM or member.** Kick exists for rooms (owner-only);
  there's no user-level block, no mute-thread, no report-to-us.
- **No unread counts / ordering** that reflect human activity distinctly.

### 3. One component doing too much
- `RoomChat.js` branches on `isDM` in ~9 places and also hosts games (`liveSession`). Every
  new requirement forks the branch and generates the next edge-case bug.
- **Refactor:** extract the shared pieces into real components — `MessageList`, `Composer`,
  `ChatHeader` — used by both `Chat.js` (persona 1:1) and `RoomChat.js`. Then a human DM can
  be its own thin screen composed from those, instead of a room pretending to be a DM.
  This is the highest-leverage structural fix; it stops the patch-on-patch cycle.

### 4. Moderation at stranger scale (previously flagged, lands hardest here)
- `deterministicCheck` (doorman) is wired to room **name** creation (`index.ts:310`), NOT to
  room **messages**. Stranger rooms + 18+ means message-level content moderation (text now,
  images later) must be in the room message pipeline before public rooms go wide. This is a
  platform-survival item, not a nicety.

---

## Recommended hardening pass (ordered by impact)

1. **Optimistic send + delivery/read state.** Instant sender bubble (client id + pending →
   sent → delivered → read); dedupe echoes by id. Biggest felt-quality jump.
2. **Extract shared chat components** (`MessageList` / `Composer` / `ChatHeader`) and make
   the human DM a thin screen. Stops the recurring edge-case bugs; everything after is easier.
3. **Presence + human typing indicator.** "online / last seen" + a typing bubble for humans.
4. **Lifecycle completeness.** Block / mute / report at the user level; robust delete↔restart;
   unread counts that reflect human activity.
5. **Message-level moderation in the room pipeline.** Wire the doorman/text-moderation to
   room messages (then image moderation) before public stranger rooms scale.
6. **Explicit gap-repair on reconnect.** Fetch-since-cursor from Postgres, beyond the current
   pg_changes fallback.

---

## Sequencing recommendation

This probably belongs **above group memory (#4)** in priority, because it's a live
credibility problem rather than a future feature — but it is *not* an attempt to beat
WhatsApp. Do the minimum that clears the "doesn't embarrass the AI layer" bar: items 1–3 are
the core of that; 4–6 can trail. Treat 1–5 as pre-launch, 6 as fast-follow.

Rough size: items 1 + 3 are mostly client (OTA); item 2 is a client refactor (bigger, but
pays for itself); items 4–5 are server + client; item 6 is client + a small server endpoint.

---

## Open questions for Dev (rulings needed before building)

- **DM as its own screen vs. shared components only?** Extract components and keep one
  screen, or give human DMs a dedicated screen built from those components?
- **How far on receipts?** Sent/delivered only, or full read receipts (with the privacy
  toggle that implies)?
- **Presence privacy.** "Last seen" is a privacy surface — on by default, or opt-in?
- **Moderation depth at launch.** Given F&F usage is gathering data first, does message-level
  moderation ship for launch, or gate only when public stranger rooms open?
- **Priority call.** Does this pass slot above group memory (#4), or run in parallel as the
  "human track" while AI-differentiator work continues?

---

*Not building any of this now — logged for a focused pass once Dev rules on scope + priority.*
