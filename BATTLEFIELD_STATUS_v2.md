
# THE BATTLEFIELD — Build Status v2 (resume doc)

*Supersedes `BATTLEFIELD_STATUS.md`. Reference the original for the pre-backend history (the two minds + the shells). This doc = the CURRENT state after the backend + live-streaming build.*

**Last updated:** session 2026-07-13 (BATTLEFIELD_SPEC phase 1 — the LITE adjudicator).
**Origin HEAD at write:** `c8eb834`.
**One-line:** practice-vs-house proven; human-vs-human start/join, crowd votes (0043), voice-turn + LiveKit, and the motion bank (0046) shipped owner-led since v2 was first cut. THIS sitting shipped the LITE adjudicator (spec §2.2): one-hop forced verdict with the refusal moved INTO the schema, ephemeral-cached corpus prefix, commentary as a tier (OFF for practice). The phone→browser live-watch re-test (§2A below) REMAINS the standing device task — phase 0 of the spec, owner-run.

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
- **LITE adjudicator variant** — **SHIPPED 2026-07-13** (spec §2.2, phase 1; see the dated section below). All three levers landed.

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

**Deploy workflow:** unzip at `/workspaces/z` → `npm run build` (server gate) → `git add -A && commit && push` (Railway auto-builds). Native OTA: `cd app && CI=1 npx eas-cli@latest update --branch preview -m "..."` (MUST run from `app/`; `--non-interactive` is REJECTED by current eas-cli and silently falls into the Metro dev bundler — standing correction). **Native fixes need BOTH the OTA and the git push** — OTA updates the app, git push updates the repo the next build is based on.


---

## 5 · PHASE 1 — THE LITE ADJUDICATOR (shipped 2026-07-13, spec §2.2)

**Contract:** `BATTLEFIELD_SPEC.md` governs this and following sittings; BUILD_PROTOCOL + the CE amendment (sessionLoop chassis) stand.

**Rulings recorded (owner + CE, this sitting):**
- **Fork #1 — RIDE the pattern, not the code (i):** the Battlefield inherits sessionLoop's *formats-as-authored-versioned-data* discipline (phases as data, boot-loaded); the **deterministic hard floor stays in the duel adapter** — a debate advances by law, a sitting advances by the moderator's judgment; the two floors are opposite by product nature. `sessionLoop.ts` is never touched in phases 0–2; any future shared-loader extraction re-runs the Session's ROOMS_STATUS proofs as its gate.
- **The reserved migration block:** **0064 challenges · 0065 HOLE (votes shipped early as `0043_battlefield_votes`, pre-reservation, verified non-collision) · 0066 record · 0067 ratings.** Holes are law.

**Shipped (server-only, no migration, no OTA — `apply_battlefield_lite.py`):**
1. **One-hop verdict, refusal in the schema (CE condition 1 — the trap defused).** `tool_choice` now FORCES `submit_verdict` on hop 1 — which removes the model's ability to refuse by not calling the tool. So the refusal moved INTO the schema: `winner` enum gains `ADJUDICATION_FAILED` + a `failure_reason` field; the prompt draws the line (impossible-to-judge transcripts refuse; amateur-but-genuine still gets a real verdict, NORMAL bedside manner intact); the loop maps the refusal onto the exact `adjudication_failed` throw loop-exhaustion used to reach — `battlefieldDuel.adjudicate()` and every route untouched. The old up-to-6-hop `read_section` retrieval loop (each hop resending transcript+corpus — the ~94% line item) is gone; hard cap 3 hops, the only extra hop being the pre-existing max_tokens truncation re-submit.
2. **Deterministic section pre-injection (CE condition 2).** `pickSections(domain, motion)` — pure keyword scoring, NO model call, zero hops: section 8 (fact-check notes) always + the top-2 sections by motion-keyword occurrence in section BODIES (the index titles are structurally uniform across the ten codexes — title matching is blind; body scoring verified discriminating: §4 the-factual-record tops every bank motion tested). ~7–8k chars of prepared material ride the dynamic block. Proven deterministic on compiled dist (3 motions × repeated calls, byte-identical).
3. **Cached corpus prefix (CE condition 3).** Both `runningNote` and `finalVerdict` split `system` into blocks mirroring `loop.ts:335`: `[{staticPrefix(domain), cache_control: ephemeral}, {task+overlay}]`. The prefix (soul + CORE + domain index, ~56k chars) is byte-identical across a duel's every adjudicator call — notes through verdict — **proven at runtime post-change** (4 domains × 5 calls, identical). Pre-injected sections deliberately ride the dynamic block so the prefix stays shared. `llm.ts` passes `cache_control` through untouched on Anthropic (strips only for other providers) — verified.
4. **Commentary as a tier (CE condition 4, default approved).** `BFState.notesOn`; `/battlefield/practice/start` creates with notes **OFF** (opt back in via `{commentary: true}`); `/battlefield/duel/start` (spectated/shared) explicitly **ON** — the commentary is the spectator product. Old sessions lack the field → treated ON (regression-safe). `test-duel` keeps notes ON so the cost proof measures the full spectated shape.

**Gates (owner-run curls in `APPLY_BATTLEFIELD_LITE.md` — the phase is NOT closed until pasted back):**
- **The refusal proof (GATES the phase):** two-line garbage transcript via `/battlefield/test-verdict` → `adjudication_failed` via the schema, never a fabricated winner.
- **Real-verdict regression:** pinned sanctions transcript → real winner, non-empty matter/manner, `byFn.bf_verdict.calls = 1`.
- **The cost gate:** pinned `test-duel` before/after; projected 8-speech AP adjudication ≤ today's 1v1 (₹9.97 recorded baseline); numbers into the APPLY.

**Not touched:** `sessionLoop.ts`, migrations, native, `debateDuel.ts` (the arena's light duel keeps its own judge).

**GATES RUN & PASSED (owner, 2026-07-13, live server — phase 1 CLOSED):**
- P1 refusal: same garbage transcript that the OLD code adjudicated into a fabricated
  CON-by-forfeit (baseline captured live, pre-patch) now returns `adjudication_failed
  (adjudicator refusal)` with a plain reason, no winner. The before/after pair is on record.
- P2 regression: real verdict, audits intact, `bf_verdict.calls` 3 → 1.
- P3 cost (same-transcript before → after): verdict ₹1.2809 → ₹0.6686 (−48%); notes
  ₹0.8808 → ₹0.3862 (−56%); adjudicator ₹2.1617 → ₹1.0548 (−51%); duel ₹2.5381 → ₹1.3861.
  **AP projection ₹1.58** (0.6686×1.6 + 0.3862×4/3) — under the strict ₹9.41 bar ~6×,
  and under the like-for-like old 1v1 adjudication. Team-format prerequisite MET.
- P4 tier: practice creates `notesOn: false`; duel/start stays on.

---

## 6 · PHASE 2 — SETTLE IT · THE CLOCK · THE RECORD (built 2026-07-13, gates pending)

**Ruling executed:** the verdict card SPLIT — phase 2 ships the card's SUBSTANCE
(record + permanent share route + the data shape); **phase 2b is the design sitting**
(typeset visual, share-PNG, owner's eyes — no card visual ships without it).

**Shipped (server + migrations + one PWA page — no native this sitting; the clock's
native render + challenge UI ride a later native sitting):**

1. **SETTLE IT — migration `0064_battlefield_challenges.sql`** (+ `timed` column
   beyond the spec's shape). `POST /battlefield/challenge/create` — `evaluateMotion`
   fronts every user-authored motion (spec guardrail); a failing motion returns 422
   WITH the assessment + nearest judgeable rewrite (the consent step — the client
   re-submits the rewrite, never a silent rewrite, never a bypass). `GET
   /battlefield/challenge/:id` public read, LAZY 7-day expiry. `POST …/:id/claim` —
   the accept IS the duel start: both seats fill at claim (the challenge carried the
   stance; no open-seat wait), same thread/room/session shape as `duel/start`, zero
   parallel machinery; refusals in register (410 expired, 400 own-challenge, 409
   already-accepted, races fenced open→accepted). `GET /fight/:id` serves
   `public/fight.html` (lean crimson landing: motion, stance on offer, OTP, one
   ACCEPT — script `node --check`'d).
2. **THE CLOCK (§5) — timers are FORMAT-MODULE DATA** (ruling): `content/battlefield/
   formats/duel.json` in the spec §3.1 `BattleFormat` shape (6 slots; Opening/Rebuttal
   120s, Closing 90s; `adjModule` field authored, unread until phase 3), boot-loaded
   on sessionLoop's exact discipline. Phase 2 reads ONLY per-slot `seconds`
   (slot = phaseIndex×2 + in-phase turn count); phase 3 flips the floor itself to the
   order array. State: `timed` (opt-in at create — practice + casual untimed per
   ruling; ranked-per-module arrives with the ladder), `timeScale` (1|0.5),
   `slotStartedAt`/`slotSeconds` (camelCase per state conventions; the ruling's
   snake_case read as conceptual). The clock stamps only on a LIVE floor: practice at
   create (house always seated), duel/start at JOIN — both join paths stamp inside
   the same version-fenced update (the generic claim route's stamp is
   battlefield-guarded; every other game byte-untouched). `move()` rejects past
   bell+grace(10s) in register; the SWEEPER (60s tick, pings pattern, non-overlapping)
   force-advances dead slots with the on-record turn `(time — the slot lapsed
   unspoken)` → `lapsed: true`, house turns follow, a ripe floor adjudicates — never
   a hang, never a model deciding leniency. **The refusal discipline extends to the
   unspoken:** lapsed turns render to the adjudicator ONLY as `[SLOT FORFEITED — time
   expired, no speech was delivered]`; the verdict task (dynamic block — the cached
   prefix untouched) orders the forfeit weighed honestly, content never invented, and
   an all-forfeit floor ruled `ADJUDICATION_FAILED`.
3. **THE RECORD — migration `0066_battlefield_record.sql`** (spec shape). Row at
   CREATION (LIVE NOW needs live rows): practice `private` (feeds the GM's record
   line, never the directory), duel/start `public`, challenges `link` (a settled
   argument is the parties' to share — flip if wrong). Verdict finalizes on BOTH
   over-paths (move route + voice-turn route — the over-block is duplicated there,
   found and hooked in both); `adjudication_failed` stores `{failed}`, never
   laundered into a verdict shape. Abandonment: sweeper marks records whose session
   sits unfinished past **48h** (declared default) — sessions untouched; a late real
   completion still finalizes done. `GET /battlefield/directory` — LIVE NOW + RECENT
   VERDICTS, public rows only, engagement = the real vote tally (**no headcount is
   invented** — house law). `GET /battlefield/verdict/:sessionId` — the card's
   substance: public/link rows, read-only, logged-out; private NEVER serves; live →
   409 with the watch pointer; abandoned/failed → 410 honest.

**Module:** `src/battlefieldArena.ts` (installer + sweeper, the simFloor pattern);
`index.ts` carries only the wiring + seven anchored hooks. `sessionLoop.ts`
untouched. Reserved-block law held: 0064 · 0065 HOLE · 0066 · 0067 (ratings awaits
the ladder).

**DRIFT FLAGS (found this sitting — rulings needed, nothing silently changed):**
- **Identity:** the live watch endpoint (owner-led) resolves REAL display names;
  spec guardrail says public-duel identity = handle by default, real-name opt-in.
  Record/share/challenge read routes mirror the watch's resolution for consistency.
  **RULING NEEDED** before launch: handles or names on public floors.
- **Motion vetting:** `duel/start` and `practice/start` accept user-authored motions
  UNVETTED (owner-led); the guardrail says `evaluateMotion` fronts every
  user-authored motion. The challenge path vets per spec. **RULING NEEDED:** extend
  the vet to both start routes, or scope the guardrail to challenges.
- **Voice audio:** rides a PUBLIC `duel-audio` bucket via `getPublicUrl`; spec §7
  says private bucket + signed URLs + 30-day retention. Phase 5's audit item.

**Gates (owner-run, in APPLY_BATTLEFIELD_PHASE2.md — the sitting is NOT closed
until pasted back):** challenge minted → claimed by a second account → duel runs →
verdict lands on the record → share route serves logged-out · expired challenge
refuses in register (410) · own-challenge refuses (400) · a lapsed timed slot
auto-advances with the "time" note and the verdict weighs the forfeit without
invented content · record rows: practice=private, duel=public, challenge=link;
abandoned never carries a verdict.

**GATE-1 FINDING & FIX (2026-07-13):** the first live run proved the loop end to end
(422-with-rewrite, own-claim 400, claim-starts-duel, real verdict) but the share
route answered `still live` — the finalize hook sat BEFORE the session persist and
re-read pre-verdict state, so the record never flipped. Fixed: finalize runs AFTER
the fenced persist on both over-paths, carrying the in-memory state (no re-read);
and the sweeper's job 2 became a RECORD SWEEP that reconciles live records against
their sessions — a missed finalize heals on the next tick, forever. Also logged:
settle-it vets at `normal` difficulty (borderline passes by design — a taste motion
judged 'borderline' minted in gate 1a; the hard 'no' 422 was proven with a cleaner
specimen). **RULING #4:** should casual settle-it vet at `normal` (borderline
passes) or `pro` (yes only)?

**GATE-3 FINDING & FIX (2026-07-13):** the bell machinery proved clean on the first
live run (lapse at bell+grace+tick, both forfeits on record, house closed, sweeper
adjudicated, walkover verdict) — but the transcript exposed a SIDE-FLIP: against a
degenerate (meta, contentless) PRO opening, the house's CON rebuttal argued PRO's
case (Card-Krueger), the CON closing then called that speech "my opponent's," and
the adjudicator made the same content-over-label inference — crediting a real
CON-labeled speech to PRO while PRO's slot read [SLOT FORFEITED]. Not an invention
of forfeited content; a misattribution cascade seeded by the house. Fixed on three
surfaces: (1) houseTurn carries a SIDE DISCIPLINE law block — never argue the other
side, never rebut your own speeches, an empty opposing case is named in one line and
the slot spent on the house's OWN case; the house also now sees forfeits as explicit
[SLOT FORFEITED] marks; (2) the verdict task rules SEAT LABELS AUTHORITATIVE — a
side-contradicting speech is the labeled speaker's error to weigh, never grounds to
reassign, and nothing is ever credited to a forfeited turn; (3) the running note
carries the same label line. Gate 3 re-run against the same degenerate opening is
the proof standard.

**GATES RUN & PASSED (owner, 2026-07-13, live server — phase 2 CLOSED):**
- G1 settle-it: 422-with-rewrite (hard-'no' motion) · own-claim 400 · claim by a second
  test account (+919888294440) started the duel with both seats filled · full duel, real
  verdict (PRO on the confound) · share route served the card's whole substance
  logged-out. Two fixes shipped mid-gate: finalize post-persist w/ in-memory state +
  sweeper reconciler (which healed the stuck record on its first tick, as designed).
- G2 expiry: aged row → claim 410 in register, status flipped expired; the second run
  proved idempotence (expired stays expired, same refusal).
- G3 the bell (re-run post side-discipline fix): PRO Rebuttal + Closing forfeited on
  record at bell+grace+tick, house stayed CON through all three speeches (named the
  degenerate opening in one line, built its own case), closing attributed truly, and
  the verdict credited PRO nothing while stating the honest limit: "The two forfeited
  slots mean CON's case was never tested."
- G4 record rules: practice → 404 (private) · challenge duel absent from the directory
  (link) · public duel in LIVE NOW at once · 49h-aged duel → sweeper marked abandoned →
  410 "ended without a verdict", verdict null forever.

---

## 7 · PHASE 3 — THE FORMAT ENGINE (built 2026-07-13, gates pending)

**Fork #1 executed in full:** formats are authored, versioned JSON — phases as data,
boot-loaded by DIRECTORY SCAN (a new format is a new file, zero code, no manifest);
the deterministic HARD floor stays in the duel adapter; `sessionLoop.ts` untouched.

**THE FLOOR LAW:** `slotIndex = turns.length` reading the module's order array —
`toAct = order[turns.length].seat`, over = array spent, the advance pure arithmetic.
**Migration-free by proof:** the legacy duel's turn sequence matches `duel.json`'s
order exactly, so live sessions inherit the new law without a shim; a state without
`formatKey` resolves to duel. `phaseIndex` is redefined as the slot index (the
floor's true counter); `phase` stays the current slot's role for display.

**Format knowledge moved into the modules:** per-slot `job` text (what a PM must
establish; a whip's no-new-matter law; a reply as biased adjudication) and
`noteAfter` flags (where the commentary drops — module-declared exchange points, so
AP's 8 distinct roles don't fire 8 notes). The house reads side/label/job/team
context from the slot; `phaseJob()` deleted. **Modules authored:** duel (6 slots,
jobs + note points added), **pf 2v2** (Constructive A1→B1, Rebuttal A2→B2, Summary
A1→B1, Final Focus A2→B2; 180/150/120/90s), **ap 3v3** (PM→LO→DPM→DLO→GW→OW→Opp
Reply→Gov Reply; 180s substantive, 90s replies; government closes). Declared
deviations: spec §3.1's optional `replies` array is FOLDED into `order` (one floor
law, one array; reply-ness lives in job + seconds); AP replies authored to the 1st
speaker (spec allows 1st/2nd).

**Per-speaker scores (§3.3):** `submit_verdict` schema gains `speakers` (one entry
per rostered seat: 65–85 tab standard, clamped in code — the range is law — one
razor line each) + `best_speaker` (may sit on the losing side; -1 on
ADJUDICATION_FAILED, empty array allowed only there). The verdict task carries THE
FORMAT + THE SPEAKERS roster + team-verdict law (winner is the TEAM; role fouls
punished in Matter). Transcript rendered with speaker tags (PRO 2 (Rebuttal): …).
NORMAL bedside manner applies per speaker. Cached prefix untouched — everything
rides the dynamic block.

**Routes:** `practice/start` + `duel/start` + `test-duel` accept `format` (unknown
keys 400 in register). Practice: the house fills EVERY non-creator seat (§3.1 —
mixed human/AI teams for free; 3v3-with-house IS team practice). Duel: coin-flip the
creator's SIDE, seat them first on it, the rest open for join/claim. Join responses
derive side from the module. The record's `sides` and `format_key` are
module-grouped. Adapter bounds 2–6 seats.

**Local deterministic proofs (dummy env, zero model):** all three formats walked
their full order arrays with the correct seat at every slot; out-of-turn refused at
all 22 slots; verdict reached with `toActSeat=-1` and the loud-failure path intact
(no fabricated winner); PF slot 180s / AP 0.5× → 90s off the modules; legacy
formatKey-less state resolves duel.

**Explicitly NOT in this ruling's scope (spec items awaiting their own sittings):**
§3.2 adjudicator format content modules (`debate-format-*.md` — the `adjModule`
field is authored but unread), §3.4 prep rooms + GM summon, watch-page team
rendering (shows seats 0/1 only — native sitting), challenges stay 1v1 by product.

**Gates (owner-run, live):** PF end-to-end on module definition alone with a mixed
team · out-of-turn refuses on the live route post-generalization · thin-transcript
refusal re-runs on the new schema · per-speaker scores + best speaker land · the
duel format re-runs its full loop (regression).

**GATES RUN & PASSED (owner, 2026-07-13, live server — phase 3 CLOSED):**
- G1+G4: PF 2v2 end-to-end on MODULE DEFINITION ALONE — 8 turns in the order
  array's exact sequence (Constructive 0→2, Rebuttal 1→3, Summary 0→2, Final
  Focus 1→3), mixed team (house as PRO 2 defended the user's constructive), 3
  notes at the module's points, real winner, FOUR §3.3 scores all in 65–85 with
  lines, and bestSpeaker = seat 3 (CON 2) — on the LOSING side, the law's edge
  proven on the first live run. Full 2v2 cost ₹2.9414 (6 house turns + 3 notes
  + 1 verdict) — under the ₹9.41 team bar ~3×.
- G2: out-of-turn refused 409 on the live route post-generalization (two-account
  duel; the CON holder attempted PRO's Opening).
- G3: thin-transcript refusal intact on the extended schema — reasoned
  adjudication_failed, no winner, no fabricated speaker scores.
- G5: duel regression — 6 turns, 2 notes, real winner, 2 speaker scores +
  bestSpeaker now present, bf_verdict 1 hop, ₹1.3739 vs phase 1's ₹1.3861:
  per-speaker scoring landed at ZERO net cost (the cached prefix absorbed the
  roster + instructions; verdict line item ₹0.6154 vs ₹0.6686).

---

## 8 · PHASE 4 — THE ARENA'S FACE (CE-defined 2026-07-13; dedicated UI sitting)

*(appended verbatim per CE ruling)*

PHASE 4 — THE ARENA'S FACE (dedicated UI sitting; lands after phase 3 so the
surface is built once for all three formats). Server contracts all live or
landing in phase 3; this sitting is native-only.

1. Battlefield home rebuilt: LIVE NOW (directory `live`) · recent verdicts
   (`recent`) · three doors — practice / challenge a friend / watch — replacing
   the two-option stub.
2. The challenge composer: motion input; on vet refusal render the `assessment`
   as a teacher not a bouncer — the issues, the note in register, and the
   restructured motion as a one-tap "use this instead"; side pick; timed toggle;
   share sheet carrying `fightPath`.
3. The `/fight/<id>` landing — in-app claim flow (the PWA parity spec's P1 owns
   the browser side of this same link).
4. Duel screen: slot clock when `timed` (client renders, server owns truth) ·
   lapsed markers in the transcript ("time — the slot lapsed unspoken") ·
   format-aware seat/phase display driven by the format module (duel/PF/AP from
   one surface).
5. The verdict screen: full substance in-app (verdict line, matter, manner,
   closing, crowd tally). The typeset share-PNG is explicitly NOT this sitting —
   it is phase 2b, the design sitting, owner-gated.

Gates: every door reachable from the rebuilt home · a challenge minted, shared,
claimed, fought, and its verdict read entirely on glass across two devices · the
vet's refusal flow usable (refuse → adopt restructured → mint) · a timed duel's
clock and lapse markers correct against server truth · eslint no-undef + esbuild
on every touched file · both tracks.

**Corrected ladder:** phase 3 (format engine, server) → phase 4 (this) → 2b
(card visual, owner's eyes) → watch/green-room polish → §7 voice audit →
ladder (0067).

**PHASE 4 BUILT (2026-07-13, gates pending — on-glass, owner-run):**

All five CE items shipped, native-first with ONE declared server touch:
`GET /battlefield/formats` (public, serves the boot-loaded modules) — the duel
screen is module-driven per the CE item and fork #1's single-source law forbids
a bundled client copy; this is the phase-3 contract the CE parenthetical
anticipated ("all live or landing in phase 3").

1. **Home rebuilt** (`Battlefield.js`): LIVE NOW rail off `directory.live`
   (30s breathe, tap → real DuelWatch — the mocked Gallery is no longer the
   live path), three doors (practice picker kept / challenge composer / watch),
   RECENT VERDICTS off `directory.recent` (tap → VerdictScreen), and a
   paste-a-link intake for /fight/<id>. Explainer content kept below the doors.
2. **Challenge composer** (`ChallengeComposer.js`): motion input; the 422
   assessment rendered as a TEACHER — issue chips in plain words, the clerk's
   note verbatim, the restructured motion with one-tap "use this instead" that
   adopts AND mints; side pick; timed toggle (with the forfeit-on-record
   warning); minted state carries the share sheet + selectable link + 7-day
   note. `createBattlefieldChallenge` reads the raw status (authedJSON throws
   away 422 bodies).
3. **/fight/<id> in-app** (`FightClaim.js`): challenge read → stance display →
   one ACCEPT → straight into DuelLive; refusals in register (expired /
   own-challenge / accepted-with-watch-path). Runtime `Linking` intake wired in
   App.js (cold start + foreground URL). **DECLARED LIMIT:** OS-level https
   intent filters need a NATIVE BUILD (manifest changes cannot ride OTA) — the
   handler is the code path a future build feeds; until then the home's
   paste-intake and the fight.html PWA landing carry the link. EAS build
   credits are the owner's call.
4. **Duel screen** (`DuelLive.js`): SlotClock (500ms tick, mm:ss tabular,
   urgent under 15s, "the bell" at zero — client renders, server owns truth);
   lapsed turns render as the on-record time note (a rule line, never a speech
   bubble); format-aware throughout — rail from the module's role sequence,
   speaker tags (PRO 2 · Rebuttal), team-aware assign row and intro, one
   surface for duel/PF/AP. Client format layer (`formats.js`) fetches
   /battlefield/formats once, duel-only fallback for a dead network; helper
   parity vs the engine proven exact on all three real modules
   (rails + tags byte-identical).
5. **Verdict on glass**: DuelLive's verdict view gains the verdict LINE
   (adjVerdict — previously never rendered), THE TAB (per-speaker scores, ★ on
   best speaker, "you" marked), and the crowd tally (watch endpoint, fetched at
   verdict). Standalone `VerdictScreen.js` reads the record's substance for
   RECENT VERDICTS taps + share. The typeset share-PNG remains phase 2b,
   owner-gated.

**Gates run by Claude:** esbuild (jsx) + eslint no-undef on all 8 touched
files, exit-code verified · server build exit-0 · client/engine parity harness.
**Gates owned by the owner (on glass, the sitting is NOT closed without
them):** every door reachable from the rebuilt home · a challenge minted,
shared, claimed, fought, and its verdict read entirely on glass across two
devices · the vet's refusal flow (refuse → adopt restructured → mint) · a timed
duel's clock and lapse markers correct against server truth · both tracks
(git push + eas update).

---

## 9 · PHASE 2b — THE VERDICT CARD (built 2026-07-13; OWNER'S EYES PENDING)

The battlefield's share object, per the split ruling: phase 2 shipped the
substance; this ships the TYPESET VISUAL + share-PNG. **Nothing here is final
until the owner's design review — the aesthetic bar is his.** Review rides the
consolidated end-of-build verification pass per the owner's testing ruling.

**The mechanic:** a deterministic server-rendered **1200×630 PNG** (the
og:image standard) + an unfurling page at **/v/<sessionId>** carrying og/twitter
tags — a verdict link dropped into WhatsApp UNFURLS AS THE CARD. Same bytes for
the same verdict, forever: hand-built SVG (manual line-wrapping, no browser, no
layout engine) → @resvg/resvg-js → PNG, brand fonts bundled (Fraunces +
Figtree, both OFL, committed under content/battlefield/fonts/).

**Shipped:**
- `src/battlefieldCard.ts` — the renderer: crimson ground with a breath
  gradient, hairline frame, swords mark, THE ADJUDICATOR RULED kicker, the
  motion in Fraunces italic (3-line budget), "<WINNER> takes the floor", the
  verdict line, footer strip (PRO/CON names · ★ best speaker · the room's
  tally · date · callmeZ wordmark · SETTLE IT ON THE BATTLEFIELD).
- `GET /battlefield/card/:sessionId.png` — public|link only, private 404s,
  live 409, abandoned/failed 410 (the JSON route's exact law); in-memory
  cache (lid 100) + 24h Cache-Control.
- `GET /v/:sessionId` — the unfurling page: og:image → the card; the body is
  the verdict typeset for a browser (motion, winner, verdict line,
  matter/manner, THE TAB with ★, closing, sides, crowd) + "settle your own
  argument" CTA + replay link. The app's VerdictScreen share now points at
  /v/ (the JSON route stays the data contract).
- **The record now carries THE TAB:** finalize stores `speakers` +
  `best_speaker` (phase 3 added them to the Verdict; the record subset had
  dropped them); the share JSON exposes both. Pre-2b records lack scores —
  cards render without the ★ line; harmless.

**Sample cards rendered from REAL gate data** (the phase-2 settle-it duel and
the phase-3 PF duel) staged for the owner's review: card_duel.png ·
card_pf.png. Known aesthetic judgment calls awaiting his eyes: vertical
rhythm on 1-line motions runs airy; repeated house names render literally
("the House · the House"); footer name budget truncates long display names
at ~26 chars.

**Not in scope:** in-app PNG export via view-shot (the server PNG is the share
asset; a native "save card" button can ride a later polish sitting).

---

## 10 · WATCH / GREEN-ROOM POLISH (built 2026-07-13; gates ride the end pass)

The census found DEFECTS, not just polish:

**D1 — the vote never cast (fixed):** the native watch set LOCAL state only —
`setVote('PRO')` with no server call — so the crowd tally never moved from any
app spectator. Now wired: `castBattlefieldVote` → POST /battlefield/watch/:id/
vote (one verified viewer, one vote, changeable until the gavel); the tally
lands from the response and shows LIVE in the vote dock; a failed cast surfaces
in register and clears the local mark (the probe law — a vote that didn't land
never looks landed).

**D2 — format-blind spectator surface (fixed):** hardcoded PRO=seat0, a
hardcoded 3-phase rail, "the challenger / the house" labels wrong for
human-vs-human AND teams, and LAPSED turns rendered as speech bubbles. Now: the
watch ENDPOINT returns every seat with side+tag from the module (+ formatKey,
timed, slotStartedAt, slotSeconds), and the surface renders the module rail,
real names + tags on bubbles and the live-typing frame, and lapsed slots as the
on-record rule line (DuelLive's exact pattern).

**Also shipped:**
- SpectatorClock — the same truth the debaters see (slotStartedAt/slotSeconds
  off the watch payload; server owns the bell).
- The verdict view completed: verdict LINE, THE TAB (scores + ★), the closing,
  and the final crowd tally with the agree/disagree line ("that gap is the
  whole point").
- **THE GREEN ROOM** — spectators reacting live: an EPHEMERAL broadcast channel
  per session (`bfgreen-<sessionId>`, realtime.js helpers on the duel-channel
  singleton discipline), registered users post under their display name, last
  60 render in a collapsible dock above the vote dock. No table, no
  persistence BY DESIGN — the transcript is the record, the green room is the
  noise around it (declared default; flip to persisted if ruled).
- Vote buttons carry the debaters' NAMES by side.

**Left alone deliberately:** the live-keystroke path (channel names verified
matching app↔browser — `duel-<threadId>` both sides; the old A0 "not visible in
browser" is unproven against current code and rides the end pass — never re-fix
the unproven); watch.html (the PWA parity spec owns the browser side —
browser green room + browser tab/clock land there).

**Claude gates:** esbuild + eslint no-undef on DuelWatch/realtime/api (exit-0)
· server build exit-0. **End-pass gates:** vote cast moves the tally on a
second device · green room messages cross devices live · spectator clock
matches the debater's · lapsed slots render as rule lines in the watch · a PF
watch shows 4 tagged debaters + the module rail.

---

## 11 · §7 VOICE AUDIT (built 2026-07-13; gates ride the end pass)

Drift flag #3 resolved as its own sitting. **The defect:** duel audio rode a
PUBLIC `duel-audio` bucket via `getPublicUrl` — permanent URLs to a debater's
voice, replayable by anyone forever. **The law (spec §7):** private bucket,
signed URLs, 30-day audio retention; the transcript is forever, the voice is
not.

**Shipped:**
- **Migration `0068_battlefield_audio_retention.sql`** — creates the PRIVATE
  `battlefield-audio` bucket (idempotent, no public policy; service role
  signs) + `audio_purged_at` on the record (the sweep-once stamp).
  Reserved-block law held: 0067 stays reserved for ratings.
- **voice-turn route:** uploads to the private bucket; the TURN carries the
  PATH (`<sessionId>/<turnIdx>.<ext>`), never a URL; the response mints an
  hour-lived signed URL for the speaker's own playback. Transcription
  unchanged (Sarvam; the adjudicator never knows it was spoken).
- **Signing at read:** `signTurnAudio` (arena export) — the watch payload maps
  path-borne turns to hour-lived signed URLs; expired/missing audio marks
  `audioExpired` honestly. Legacy full-URL turns pass through untouched until
  retention ages their sessions out.
- **Retention (sweeper job 3):** finished records older than 30 days, not yet
  stamped → purge the session's audio from BOTH buckets (private + legacy
  `duel-audio`), stamp `audio_purged_at`. 10 per tick.

**Scope held:** this is the AUDIT (privacy + retention). The voice TIER's
device work — hold-to-record on the slot, hard-stop at the bell, the play bar
in DuelWatch/DuelLive, the 🎙 "speaking…" frame on the keystroke channel,
Sarvam's language flag — is F2/phase 5's own sitting; no native voice UI
exists yet (grep-confirmed), so nothing client-side needed changing for the
audit itself.

**End-pass gates:** a voice turn stores a PATH on the turn (state inspect) ·
the watch payload's audio URL plays and EXPIRES after the hour · the private
bucket refuses unsigned access · an aged record's audio vanishes from both
buckets on a sweep tick with the stamp set · legacy public URLs still play
until their sessions age out.

---

## 12 · §9 THE LADDER — 0067 (built 2026-07-13; gates ride the end pass)

The last rung before the end pass. The spec ruled the whole design — no owner
fork was needed: **ranked = public + timed + commentary-on, OPT-IN at create;
practice-vs-house and friendly settle-it duels unranked by default; K=32;
per-format Elo from 1200; team deltas vs the opposing team's average.**

**Shipped:**
- **Migration `0067_battlefield_ratings.sql`** — the spec's §9 block VERBATIM
  (ratings table + RLS) plus two declared additions that are the ladder's own
  plumbing: the leaderboard index (format_key, elo desc) and
  `battlefield_challenges.ranked` (0064 predates the ladder; opt-in at create
  must ride the row to the claim). The reserved number is spent as reserved.
- **The Elo engine** (`settleElo`, arena): K=32, per-format, 1200 start; every
  member's delta vs the opposing team's average; wins/losses tallied.
  **Ranked requires every seat human** — the house has no rating; a ranked
  floor that somehow seated the house settles nothing and logs why.
  Arithmetic proven on known cases: equal 1v1 ±16 · favorite +8/−8 · upset
  ±24 · team-vs-average per-member deltas correct.
- **Settle exactly once:** the record finalize became a live→done
  COMPARE-AND-FLIP (`.eq('status','live')` fence) — only the call that
  performs the flip settles Elo. The reconciler healing a missed flip still
  settles; a re-run on a done record never does. (The fence also hardens the
  record itself against double-finalize.)
- **Ranked plumbing:** `duel/start` takes `ranked:true` (forces the clock;
  those floors are already public + commentary-on; seats are human by
  construction). `challenge/create` takes `ranked:true` (forces timed, rides
  the row, response + fight-page GET expose it); at claim the state carries
  `ranked` and the record goes **public** (spec law) instead of link.
  `practice/start` untouched — the house is unranked by law.
- **Read routes:** `GET /battlefield/ladder/:formatKey` (top 50, names only —
  never ids; watch parity) · `GET /battlefield/rating/me` (auth'd, own rows).

**Not in scope (declared):** the native leaderboard surface (one screen off
the ladder route — rides a UI follow-on after the end pass); seasons;
tournaments (spec: a bracket over the record + a public room, tier-gated,
token prizes never cash — its own sitting when the law-college GTM lands).

**End-pass gates:** a ranked settle-it duel end-to-end settles both players
±16 from 1200 (first duel, equal ratings) and the ladder route ranks them ·
an unranked duel settles nothing · re-finalize (reconciler pass on a done
record) does not double-settle · a ranked challenge renders public in the
directory · ratings/me returns the row.
