# THE BATTLEFIELD — Build Status & Resume Plan
*Ref: `the_duel_vision.md` (the flagship vision). This doc = what's DONE vs. what's LEFT, mapped to that vision, so tomorrow's session picks up clean.*

**Last updated:** end of session 2026-07-04.
**One-line:** the two *minds* of the Battlefield (Adjudicator + Grand Master) are BUILT & PROVEN; the three *surfaces* (duel room, gallery, watch page) are built as SHELLS (mocked); the *live backend* is NOT wired yet — that's tomorrow.

---

## 0 · DEPLOY STATE — VERIFY THIS FIRST TOMORROW

Origin HEAD at last check = **zip53** (`a224578`). The following zips were **built but push status UNCONFIRMED** — first action tomorrow is `git log --oneline` to see what actually landed, and re-deploy any that didn't:

- **zip54** — analogy bank folded into Grand Master's *cached* prefix (cost fix). Engine-only.
- **zip55** — Duel Room + Gallery shells (native). OTA.
- **zip56** — ungated PWA watch page (`public/watch.html`). Engine (static file).
- **zip57** — slowed all three streams to Z's word-by-word rhythm. Engine (watch.html) + OTA (Gallery, DuelRoom).

**Also OPEN (from zip54):** confirm the analogy-cache fold actually saves money — fire the Grand Master curl **twice within 5 min** and check turn-2 usage shows `cacheRead > 0`. Last observed `in: 9598, cacheRead: 0, cacheWrite: 25090` — the high `in` is the per-question retrieval prep riding uncached (expanded gm-codices make sliced sections chunky). If cost matters, the lever is retrieving tighter/smaller sections (optimization, not correctness). Two Anthropic network errors hit during the last push — re-verify.

---

## 1 · THE ADJUDICATOR — ✅ DONE & PROVEN (the load-bearing wall)

*Vision §4: "The Adjudicator IS the product. Everything rests on it."*

- **Built:** `src/battlefieldAdjudicator.ts` — runs on callmeZ's own engine. Soul = Tyrion Lannister voice (`content/debate-adjudicator-soul.md`), "reward truth over confidence," Matter/Manner, corpus-silence iron rule, floor-only guardrail (never brings in a fact neither side raised).
- **Corpus:** 10 debate-domain codices (`content/debate-domain-*.md`) + adjudication core, via **index + `read_section` retrieval** (not whole-dump — plumbing supports the brain).
- **Structured verdict:** `submit_verdict` tool with `winner` ENUM (killed the verdict-flip defect), temperature 0, no silent fallback (throws loudly, never fabricates a winner).
- **NO web search** (removed — was broken Brave impl; judge is codex+floor only, deterministic).
- **Diagnostic endpoints:** `GET /battlefield/ready`, `POST /battlefield/test-verdict {domain,motion,transcript[]}`.
- **PRESSURE-TESTED — ALL 3 GATES PASSED** (vision §4's three tests, run via curl):
  1. **Consistency** — same transcript ×3 → same winner + reasoning. ✅
  2. **Mirror-fairness** — swap seats → winner follows the *argument*, not the seat. ✅
  3. **Fabrication / corpus-silence** — fake 73% stat → marked "unverified, weigh on logic alone," did NOT hallucinate a fact-check, did NOT wrongly strike. ✅
  - Plus **philosophy** (value-laden, no factual anchor): judged the *debating* not the *position*, consistent, no value-leakage. ✅

**LEFT on the adjudicator:** nothing for v1. (v2 vision: institutions feed their own corpus; morality motions once trusted.)

---

## 2 · THE GRAND MASTER — ✅ DONE & PROVEN (the teacher; NOT in the Battlefield — lives in CHAT)

*Not in the original duel vision — emerged this session. The teaching-face to the adjudicator's judging-face. Two Lannisters: Tyrion judges (Battlefield), Tywin teaches (chat surface). Teaching stays in chat; the Battlefield is debates-only.*

- **Built:** persona `the_grandmaster` (`src/personas.ts`, webEnabled), soul `content/codex-grandmaster.md` (Tywin voice, philosophy & human behaviour as master key, the Deconstruction method + 3 worked scenarios, **Two-Handed Blade** = conviction without fence-sitting, **Never Bluff**, "a master does not show his sources").
- **Corpus — DECOUPLED superset** (his own `gm-*` namespace; adjudicator untouched on `debate-domain-*`): 10 *expanded* codices + `gm-analogy-bank.md` (anchors+frictions, ammunition) + hand-authored `gm-index.md`.
- **Retrieval:** `src/grandMaster.ts` — silent pre-pass (Option A) picks {domain,section}, slices, injects; he teaches STREAMED from it as his own mastery. Analogy bank folded into his CACHED prefix (zip54, cost).
- **Web:** ON (teaching is world-aware, unlike judging).
- **Endpoint:** `GET /grandmaster/ready` (expect `{"domains":10,"sections":80}`).
- **PROVEN via curl** (thread `06758f2a-fc3d-49a0-9199-7411ff775da3`): opened "No.", read the person, held the Two-Handed Blade (defended the state against a market-certain student), analogies fired (antibiotics-in-plague, water-in-drought), decisive not fence-sitting, grounded but never named.

**LEFT on the Grand Master:** face image (`callmez.app/faces/the_grandmaster.jpg` 404s → fallback); confirm cache-fold saves money (see §0).

---

## 3 · THE SURFACES — 🟡 SHELLS BUILT (mocked, tunable); LIVE DATA = tomorrow

All three are **UI shells with SCRIPTED content** — they preview the *feel* so we tune before wiring. Step B swaps scripted data for the live engine.

### 3a · Duel Room (debater surface) — `app/DuelRoom.js`
*Vision §2 (format), §3 (media).* Entry: Battlefield → "Try a practice duel."
- ✅ Motion banner, phase rail (Opening→Rebuttal→Closing), PRO/CON assignment, turn-locking states (your-turn / their-turn / watching), transcript bubbles, **TEXT + VOICE toggle** (voice = premium performance dock, mic orb, transcribed-after), verdict card (Matter/Manner + winner) + crowd-gap.
- ✅ Opponent "composing" streams word-by-word (zip57).
- 🟡 ALL MOCKED — scripted `SCRIPT` array, hardcoded `VERDICT`. No engine.

### 3b · Gallery (in-app spectator) — `app/Gallery.js`
*Vision §5 (spectator layer).* Entry: Battlefield → "Watch a live duel."
- ✅ One scrolling surface: LIVE badge + watch count, motion, named debaters (Aarav/Meera), the stream auto-plays word-by-word, **vote** (spectators only vote), **Green Room** (registered-user reactions, "debaters can't see this"), **two results** (adjudicator vs crowd) + gap line, register nudge.
- 🟡 MOCKED — scripted stream + chat + verdict.

### 3c · Watch Page (ungated PWA funnel) — `public/watch.html`
*Vision §5: "the single best growth decision." Ungated watch-link.* URL: `callmez.app/watch.html`.
- ✅ **Phone + OTP ONLY** gate (REAL flow — `/auth/otp`, `/auth/verify`; no PIN, no name, no profile — the ungated path). Crimson arena on PWA serif stack.
- ✅ After OTP → watch (word-by-word stream) + vote + two results.
- ✅ **Conversion ladder shown** (vision §5): green room LOCKED → "Create an account to join the conversation"; end CTA → "step onto the Battlefield yourself." watch+vote free · chat = register · debate = register.
- 🟡 Duel content MOCKED; OTP gate is REAL.
- 🟡 **Per-duel routing LEFT:** currently one hardcoded duel at `/watch.html`. Real version needs `/watch/<duelId>` so each live duel gets its own shareable link (for X/Reddit sharing). Small addition, comes with live engine.

---

## 4 · THE BACKEND — ❌ NOT WIRED (this is tomorrow's main job)

*Vision §9 build sequence. The surfaces are the "slots"; the backend fills them with live data.*

**Architecture learned this session (build on it, don't reinvent):**
- Arena has a **sessions layer** with an **adapter interface**: `create / move / ai / view / isOver / toActSeat`. Registered in `GAME_ENGINES` in `src/index.ts` (~line 1838).
- Sessions persist in `game_sessions` table (state + version, concurrency-fenced). Routes: `POST /games/session` (create), `/games/session/:id` (get), `/claim`, `POST /games/session/:id/move` (~line 1977 — applies move, then `advanceAI` drives persona seats).
- `src/games/debateDuel.ts` = the arena's LIGHT debate (momentum math, moderator scores each exchange, simple verdict). **KEEP AS-IS** — the Battlefield is the SERIOUS adjudicated version, a separate adapter.
- Finished duels write to `arena_matches` ledger (both duellists).

**The backend layers, in build order (smallest real thing first — do NOT do all at once):**

1. **`src/games/battlefieldDuel.ts`** — the duel state machine. Structured phases Opening→Rebuttal→Closing (not free momentum), assigned PRO/CON, turn-locking, server-side transcript. Rides the sessions adapter interface. Register in `GAME_ENGINES` as `battlefield_duel`.
2. **The house opponent** — a debater persona that, on its (AI) seat's turn, generates a real argument for its assigned side (via `.ai()`). Practice-vs-house is the on-ramp (vision: practice-vs-AI is the on-ramp; tournaments are human-v-human).
3. **Hook the PROVEN adjudicator** — on `isOver`, call `finalVerdict` from `battlefieldAdjudicator.ts` on the REAL transcript → real verdict. (Adjudicator already works — just needs calling. Vision §4 notch-up: also a "live running read" after each phase = the commentary track, optional.)
4. **Wire the Duel Room UI to the live session** — replace `SCRIPT`/`VERDICT` mocks with session create + move + poll/subscribe. **CURL-PROVE THE LOOP BEFORE DEVICE** (does a real practice duel produce a real adjudicated verdict? — vision §9 step 1-2).
5. **Live keystroke streaming** (own build — see §5 below) — throttled full-state broadcast to opponent + spectators, both platforms.
6. **Spectator/vote/green-room backend** — vote tally, hidden chat, in a public room (reuses public-room realtime + moderation). Wire Gallery + watch.html to it. (Vision §5.)
7. **Tournaments/brackets** + **law-college first host** (vision §6, §7). Later.

**RESUME POINT FOR TOMORROW:** start at **layer 1 + 2 + 3 + 4** — make practice-vs-house TEXT duel actually work end-to-end (real args, real adjudicator verdict), curl-proven, then wire the Duel Room to it. Live streaming (5) and spectators (6) are separate builds after the core loop proves.

---

## 5 · LOCKED DESIGN DECISIONS (don't relitigate)

- **True keystroke streaming** (vision §3, decided this session): the debater's live composition streams to **opponent AND all spectators, native + PWA** — every pause, backspace, false start visible (the raw "watch them write it" drama, exposure accepted).
  - *Engineering reality:* NOT literal per-keystroke (hundreds of events × every viewer × every duel = cost-prohibitive). Use **throttled full-textbox-state broadcast** (~150–250ms tick, broadcast current state). Pauses = no change, deletes = text shrinks, bursts = big jump. Same drama, ~4–6 events/sec. (How live-collab editors work.)
  - *Constraints:* only the active debater broadcasts (turn-lock holds); within their turn window; on turn-end text locks to transcript, floor passes. Both platforms subscribe to the same public-room realtime channel.
  - *Moderation:* the live-typing surface is itself a moderation surface (a debater could type abuse the room sees even if deleted) — doorman must watch the debater's live stream, not only spectator chat.
- **Stream rhythm** = Z's word-by-word reveal, punctuation-paced (420ms after `.?!`, 200ms after `,;—`, 55ms/word). Tunable knobs in each file. (The mocks preview this; live streaming feeds it real throttled data.)
- **Media:** v1 = TEXT (keystroke-stream) + VOICE (audience hears live human voice; Sarvam transcribes AFTER turn → feeds adjudicator's text). Video = v2 parked.
- **Two results:** adjudicator verdict (official) + crowd vote (people's choice), shown SEPARATELY, the GAP featured — never combined.
- **Spectators ONLY vote**; comments are registered-only (green room, hidden from debaters) = the conversion hook.
- **Fact-based motions first** (knowable evidentiary direction); morality motions v2.
- **Prizes = tokens/app-money/unlocks, NEVER cash** (app-store-safe, sidesteps India RMG law).
- **GTM wedge:** Dev's law college hosts first (moot court); inter-college prestige = viral fuel.

---

## 6 · FOUNDER / NON-BUILD TASKS (parked)

- Grand Master face image (`the_grandmaster.jpg`), Tywin register.
- Consult DP + rename "Expert Consultation" → "The Consultant" (parked).
- Twilio recharge day-before reviewers (shared Verify = only test acct can OTP now).
- Sarvam voice-data consent/privacy (DPDP) IF debate audio becomes training data — must be disclosed + consented, lawyer-reviewed (vision §8).
- Moderation of ungated spectators + hot topics + the debater live-stream (vision §5, §5-locked above).

---

## 7 · STORE-PREP STATUS (added end of session 2026-07-04)

**Sequencing (agreed):** Battlefield backend FIRST tomorrow, THEN store-prep incl. policy pages.

### Legal / policy — SETTLED
- **Lawyer review DONE, colleague green-lit** the approach. ✅
- Repo → **private tomorrow** (founder). ✅
- **Twilio:** reviewers use the test number + OTP (not a blocker); founder recharges anyway. ✅
- **Sarvam data-consent disclosure — DEFERRED (correct).** Don't disclose a data deal that doesn't exist. Trigger: IF a Sarvam training-data deal happens → disclose → publish → notify → get consent, BEFORE any audio is used that way. Nothing to write now.
- **Account deletion — CONFIRMED working:** soft-delete (deactivate immediately) → 30 days recoverable via help@callmez.app → permanent purge. Authored `ACCOUNT_DELETION.md` + privacy policy already describe exactly this. ✅
- **Payments — CHANGED:** launch with **Google Play Billing + Apple StoreKit (IAP) ONLY. NO web/PWA payments, NO Razorpay at launch.** → simplify the terms' Razorpay `[CONFIRM]` line to "handled by Apple/Google." One fewer processor to disclose. Add web payments later w/ disclose-before-use.

### Policy pages — AUTHORED but NOT LIVE (the remaining task)
- Authored in `docs/store/`: `PRIVACY_POLICY.md`, `TERMS_OF_SERVICE.md`, `ACCOUNT_DELETION.md`, `COMMUNITY_GUIDELINES.md` + `STORE_SUBMISSION_PACK.md` (console-transcribe, not hosted). Substantively complete & DPDP-aware.
- **TWO gaps before live:**
  1. **Founder fill-values needed** (only Dev has these): legal entity name + registered address · Grievance Officer name/role (DPDP requires) · governing-law jurisdiction (e.g. Gautam Budh Nagar) · liability cap figure (e.g. INR 5,000 / USD 100) · launch date. Payments line → stores-only (Razorpay removed). Strip all "Founder note (delete before publishing)" blocks + resolve Anthropic/cross-border `[CONFIRM]` notes.
  2. **Convert .md → served HTML in `public/`** so they're live at `callmez.app/privacy`, `/terms`, `/delete-account`, `/community` (Claude builds; ~30 min once fill-values in hand; wire cross-reference URLs between them).
- **Division:** Dev supplies fill-values → Claude produces the 4 live HTML pages (callmeZ aesthetic, like watch.html), founder-notes removed, cross-links wired.

### Remaining pre-launch (founder)
- Pull the temp auth-diagnostic before launch.
- Fill `STORE_SUBMISSION_PACK.md` `[CONFIRM]`s at console-submission time (data-safety declarations, IAP declaration, no medical/wellness claims, etc.).
