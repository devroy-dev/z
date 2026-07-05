
# THE BATTLEFIELD — Build Status v2 (resume doc)

*Supersedes `BATTLEFIELD_STATUS.md`. Reference the original for the pre-backend history (the two minds + the shells). This doc = the CURRENT state after the backend + live-streaming build.*

**Last updated:** session 2026-07-05 (post zip69).
**Origin HEAD at write:** `9135963` (zip69).
**One-line:** the practice-vs-house duel works end-to-end (real args + real adjudicated verdict, curl-proven twice). Keystroke streaming + the spectator watch page are BUILT and deployed; the live phone→browser watch is NOT yet confirmed working on device (last blocked by two watch.html bugs now fixed in zip69 — needs a re-test).

**Strategic frame (locked this session, per Bhaskar):** LAUNCH happens AFTER the moat (the Battlefield) is real, not before. The Battlefield is the viral content generator + flagship. So Battlefield layers 5–7 are the PRE-launch build. The "moat works" bar: *a stranger taps a shared link, watches a real live duel, votes, feels the pull to sign up* = layers 5+6 proven. Layer 7 (human-v-human + tournaments) is the accelerant.

---

## 0 · DEPLOY STATE — the commit ladder (all on origin)

```
9135963 zip69  watch.html syntax + phone-country-code fix; cost-diag tsc fix
7ab3ea5 cost-diag 02 fix (auth guard on /diagnostics/costs)   [Dev]
ad34ff3 cost-diag 02 (fn tags, chat log, whisper echo, dashboard)  [Dev]
c6e8d21 zip68  watch.html wired to live duel + /watch/:id route
509b800 zip67  restore keystroke broadcasting (was OTA-only, now in repo)
03ec1e8 zip66  running-note truncation fix + full transcript in verdict
bb715c9 zip65  keystroke transport + spectator endpoint + DuelWatch
a438482 cost-diag 01 (battlefield cost tap)   [Dev]
4d09063 zip64  Duel Room wired to live engine (practice-vs-house)
c708681 zip63  verdict truncation fix (matter/manner never empty)
f10a836 zip62  test-duel accepts pinned motion+domain
26d832f zip61  battlefield duel engine (state machine + house + adjudicator)
```

**Boot log healthy** (2026-07-05): engine on :8080, sim floor open, ff league synced. Server is up and ready for the device re-test.

---

## 1 · WHAT'S BUILT & PROVEN ✅

### The engine — layers 1–3 (CURL-PROVEN, twice, on live server)
- **`src/games/battlefieldDuel.ts`** — the serious adjudicated duel adapter. Structured phases **Opening → Rebuttal → Closing**, assigned PRO/CON, turn-locked, server-side transcript. Rides the sessions adapter interface (`create/move/ai/view/isOver/toActSeat`), registered in `GAME_ENGINES` as `battlefield_duel`.
  - **Phase/turn order proven correct:** Opening PRO→CON, Rebuttal CON→PRO (side-under-attack answers first), Closing PRO→CON, 6 turns → verdict.
  - **House opponent** (`HOUSE_SOUL`, `houseTurn()`): generates real, phase-aware arguments for its assigned side. Proven strong — on the sanctions motion it built a real case (forex/tech/patronage, South Africa, Iran, North Korea) and exploited an off-motion opening.
  - **House turn runs INSIDE async `move()`** (advanceAI is sync, can't await) — passes `s.seats` as the 4th arg to `engine.move`. Zero shared-infra change.
  - **Proven adjudicator hooked:** on the final turn calls `finalVerdict` from `battlefieldAdjudicator.ts`. Never fabricates a winner (sets `error='adjudication_failed'`).
  - **Commentary track:** `runningNote` after each completed phase = the live adjudicator read.
- **Two clean curl proofs** via `POST /battlefield/test-duel`:
  1. Off-motion mismatch → house + adjudicator both correctly punished the off-topic opening.
  2. Matched sanctions motion (pinned) → a fair fight; adjudicator ruled PRO on the merits with a sharp, correct read ("CON's own evidence undermines its position… the IRGC consolidated power = entrenchment, not weakening"); corpus-silence discipline held ("neither fabricated evidence").

### Layer 4 — the Duel Room, wired to the live engine
- **`POST /battlefield/practice/start`** — creates a real, persisted practice-vs-house session (seat 0 = you/PRO, seat 1 = the house/CON) in a private solo thread. Rides the existing `/games/session/:id` GET + `/move` routes.
- **`app/games/battlefield/DuelLive.js`** — the live Duel Room, driven by `useLiveSession`. You type → the house replies + adjudicator rules inside the move call → the real Matter/Manner verdict lands. Crimson aesthetic ported from the mocked DuelRoom.

### Layer 5 — keystroke streaming (BUILT, deployed; device-unconfirmed)
- **`app/realtime.js`** — a keystroke transport SEPARATE from the chat channel singleton: `subscribeDuelKeys` / `openDuelSender` / `broadcastDuelKeys` / `closeDuelSender`. Client→client over a `duel-<threadId>` Supabase broadcast channel. The active debater holds a send-channel open for their turn and broadcasts throttled full-textbox-state (~180ms tick, ~5 events/sec). Pauses/deletes/bursts all show.
- **`DuelLive.js` broadcasts** the human's composition while it's their turn; `done` frame + closes on submit; 🔗 share-to-watch link.

### Layer 6 — the spectator watch (BUILT, deployed; device-unconfirmed)
- **`GET /battlefield/watch/:sessionId`** — read-only spectator view of a duel (no seat required). Returns motion/phase/turns/notes/verdict — the ungated audience path.
- **`GET /watch/:sessionId`** — serves watch.html for the per-duel share link (express.static alone couldn't match the extra path segment).
- **`app/games/battlefield/DuelWatch.js`** — native spectator component: subscribes to live keystrokes (renders the composing bubble), polls the committed transcript + verdict, vote control.
- **`public/watch.html`** — the ungated PWA watch page, wired to a REAL duel: reads sessionId from `/watch/<id>`, OTP-gates, polls `/battlefield/watch/<id>`, subscribes to `duel-<threadId>` via supabase-js (CDN) for live keystrokes, renders the real verdict. Falls back to the demo mock when no sessionId.

### Key design decision (yours, this session)
**Keystroke streaming is a property of the HUMAN side.** The audience view works on human-vs-AI duels too — the human's keystrokes are the thing watched; the AI's turns arrive as delivered speeches. This dissolved the 5↔6↔7 dependency knot: 5+6 attach to the existing practice duel, no human-vs-human needed to prove them. They ship as ONE testable slice (a broadcast needs a receiver to prove it).

---

## 2 · OPEN BUGS / UNCONFIRMED 🔧

### A. Live watch — NOT yet confirmed on device (the immediate open item)
The phone→browser keystroke proof has not succeeded yet. Two watch.html bugs blocked the last attempt; both are fixed in zip69 but **need a re-test**:
- **(fixed, zip69) Dead script:** a syntax error in watch.html's inline JS (an orphaned `openLine` body — the `function openLine(t){` header was deleted, body kept) broke the ENTIRE `<script>` block → every button dead, no fetch, nothing logged. Now restored + `node --check`'d clean.
- **(fixed, zip69) Phone format:** `/auth/otp` requires E.164 (`+91…`); the watch page sent the bare number → 400. Added `normalizePhone()` (bare 10-digit → `+91…`).

**→ RESUME HERE: re-test the live watch.** On phone: Battlefield → practice duel → type → tap 🔗 for the `callmez.app/watch/<sessionId>` link (NOT bare /watch.html, or it shows the demo mock). In a browser: open that link → type `8757788550` (auto-becomes +91) → OTP `123456` → watch. **Does the typing stream live into the browser?**
- Works → layers 5+6 proven.
- Committed turns + verdict show but keystrokes DON'T → the realtime broadcast subscription isn't landing (anon-client auth on the `duel-` channel). Likely fix: the browser's supabase client may need the auth token set before subscribing, or the broadcast channel RLS. Quick fix once observed.
- Errors → browser console first (the discipline: web console before blind patches).

### B. Process/regression risks that bit us (now controlled)
- **OTA ≠ committed:** zip67 went out via OTA but wasn't committed → the repo's DuelLive lost keystroke broadcasting → the NEXT build (zip66-based) silently regressed it. Fixed by committing. **Rule: native fixes need `git push` alongside `eas update`, always.**
- **Stale clone:** must `git fetch --force && git reset --hard origin/main` AND grep-verify the actual file before editing — an earlier fetch can be stale (repeatedly showed the wrong HEAD this session).
- **Inline browser JS ≠ server tsc:** the dead-script bug shipped because only the server was syntax-checked. **Rule: `node --check` the extracted `<script>` block for any watch.html/PWA edit.**
- **cost-diag 02 tsc error:** shipped with a `string | null` type error at the `/diagnostics/costs` route; fixed (auth guard). If the build gate runs tsc, verify cost-diag deploys pass.

### C. Known minor (fixed this session, keep an eye)
- **(fixed zip63)** verdict matter/manner occasionally empty — was max_tokens truncation on the verdict tool call (long summary ate the budget). Raised to 2000 + re-submit guard.
- **(fixed zip66)** running-note cut mid-sentence — max_tokens 120 too tight for the SWING+NOTE two-line output. Raised to 220.
- **(fixed zip66)** house's Closing appeared skipped → jumped to verdict. NOT an engine bug (the Closing IS in the transcript); the verdict VIEW discarded the transcript. Fix: verdict view now replays the full transcript + notes above the verdict card.

---

## 3 · WHAT'S LEFT TO BUILD

### Layer 6 completion (once the live watch is confirmed)
- **Green-room chat** — the hidden, registered-only live chat spectators talk in (debaters can't see it). The "sports-bar" social layer + conversion hook. Not built.
- **Vote tally (real)** — the spectator vote is currently local-only (per-viewer). Needs server-side aggregation → the two-result design (adjudicator verdict vs crowd vote, shown separately, the GAP featured).
- **Per-duel discovery / directory** — a browsable "live now" surface. Right now a duel is only reachable via its shared link. Needs a directory tab (live duels + headcount).

### Layer 7 — human-vs-human + tournaments (the competitive product + GTM)
- **Human-vs-human duels** — two humans, assigned PRO/CON, matched via a shared room + seat-claim (reuse the arena's proven `claimGameSeat` pattern). The keystroke primitive already built just works for both sides.
- **Tournaments / brackets** — a public room + a bracket on top. Tier-gated enrollment (drives subscriptions). Prizes = tokens/unlocks, NEVER cash (app-store-safe, sidesteps India RMG law).
- **Law-college first host** — Dev's own college hosts a moot/debate tournament. Warm founding cohort, inter-college prestige = viral fuel.

### v2 (deepen the moat, after the above)
- **Voice tier** (Sarvam) — audience hears the live human voice; Sarvam transcribes AFTER each turn → feeds the adjudicator's text. The premium prime-time experience.
- **Morality motions** — once the adjudicator is trusted (v1 is fact-based motions only, which have a knowable evidentiary direction).
- **Cross-fire phase** — rapid short back-and-forth, added once the base format is proven.
- **Institutional corpus-feeding** — a law college feeds its own moot problem + authorities; the adjudicator judges against THAT. The institutional product.
- **LITE adjudicator variant** (cost lever) — from the cost-diag finding: the adjudicator is ~94% of a duel's cost (notes + verdict ≈ ₹9.41 of ₹9.97). Options: force the verdict into 1 tool-hop instead of 3 (each hop resends the full transcript+corpus), cache the running-note corpus prefix, make the commentary track optional.

### Then: LAUNCH (after the moat is real)
- Policy pages live (Dev supplies fill-values → 4 HTML pages at /privacy, /terms, /delete-account, /community).
- Pull the temp auth diagnostics + battlefield test endpoints before launch.
- Store submission (Apple/Google IAP only, no Razorpay at launch). Repo → private. Twilio recharge for reviewers.

---

## 4 · KEY FILES & ENDPOINTS (quick reference)

**Engine (server):**
- `src/games/battlefieldDuel.ts` — the duel state machine + house opponent
- `src/battlefieldAdjudicator.ts` — the proven Tyrion adjudicator (verdict max_tokens 2000, running-note 220)
- `src/grandMaster.ts` + `content/gm-*.md` — the Grand Master (chat teacher; = the Battlefield debate COACH per this session, NOT the judge)

**Native (app/):**
- `app/games/battlefield/DuelLive.js` — the debater's live Duel Room (+ keystroke broadcast, share link)
- `app/games/battlefield/DuelWatch.js` — the native spectator view
- `app/realtime.js` — keystroke transport (subscribeDuelKeys/openDuelSender/broadcastDuelKeys/closeDuelSender)
- `app/api.js` — startBattlefieldPractice, watchBattlefieldDuel

**PWA:**
- `public/watch.html` — the ungated spectator watch page (wired to live duels)

**Endpoints:**
- `POST /battlefield/practice/start` — start a real practice-vs-house session
- `POST /battlefield/test-duel {mySpeeches[3], motion?, domain?}` — diagnostic full-loop (no auth)
- `POST /battlefield/test-verdict {domain, motion, transcript[]}` — diagnostic verdict-only
- `GET /battlefield/watch/:sessionId` — read-only spectator data
- `GET /watch/:sessionId` — serves watch.html for the share link
- `GET /battlefield/ready`, `GET /grandmaster/ready` — health

**Test creds:** phone `+918757788550` (or bare `8757788550` on the watch page now), OTP `123456`. GM test thread `06758f2a-fc3d-49a0-9199-7411ff775da3`.

**Infra:** engine on Railway (`https://z-production-c79a.up.railway.app`, :8080), Supabase Mumbai (schema `z`), Expo app in `app/`, Haiku `claude-haiku-4-5-20251001`. Repo `github.com/devroy-dev/z`, Codespace `/workspaces/z`.

**Deploy workflow:** unzip at `/workspaces/z` → `npm run build` (server gate) → `git add -A && commit && push` (Railway auto-builds). Native OTA: `cd app && eas update --branch preview --environment preview -m "..." --non-interactive` (MUST run from `app/`). **Native fixes need BOTH the OTA and the git push** — OTA updates the app, git push updates the repo the next build is based on.
