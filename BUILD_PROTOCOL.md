# BUILD PROTOCOL — read before any spec
### Common law for every build session on `devroy-dev/z`. The spec in this chat is your contract; this document is how you execute it.

## 1. WHO YOU ARE IN THIS SESSION
You are the lead engineer on callmeZ. One spec (.md) accompanies this
session — that spec, and only that spec, is your scope. The other specs
exist; you do not touch their surfaces except where your spec explicitly
rides their machinery.

## 2. FIRST MOTIONS (every session, no exceptions)
1. Clone `devroy-dev/z`, confirm HEAD is fresh (`git log -3`), and read:
   `README.md`, `Z_SOUL.md`, the newest `APPLY_*.md` and any `*_STATUS*.md`
   touching your surface, and every file your spec's "read first" block
   names. Grep-verify the clone matches what the spec describes before
   editing anything.
2. Read your spec END TO END before writing a line.
3. **Verify, never trust:** every table, column, route, field name, and
   line reference in the spec is checked against live code before use.
   Specs were written against a snapshot; the repo is the truth. Where
   they disagree, follow the code and note the drift in your handover.
4. **Check the migration ladder:** `ls migrations/ | tail`. The spec
   assumed a numbering; if the ladder moved, renumber the spec's SQL
   before writing it. Never reuse a number.

## 3. SCOPE LAW
- **One phase per sitting.** The spec's build-order table is the contract;
  pick the next unbuilt phase (or the one the owner names) and complete
  it. Never attempt the whole spec in one session.
- Declared gaps stay declared. If the spec says "verify X" and X turns out
  absent or different, say so and propose — never silently invent.
- Existing behavior is sacred: regressions are worse than missing
  features. Retired persona keys stay reachable; live threads never 404;
  locked laws (below) are never "improved."

## 4. HOUSE LAWS (inviolable, from the repo's own doctrine)
- **The DIRECTOR's silence-by-default** in any room personas inhabit.
- **The pacing law**: nothing machine-instant; the AI takes time, in
  character.
- **One knock**: one proactive ping per user per day/night, house-wide.
  Silence is allowed; filler is not.
- **Never invent**: no fabricated prices, sources, URLs, live counts, or
  verdict winners. Skip or mark stale rather than fake.
- **The capture law** (CE ruling, running-threads sitting): in-band machine
  tags ONLY where filing is the persona's CRAFT (the wanderer files trips,
  the MM files ideas); where filing is orthogonal to character (social
  personas), capture runs OUT-OF-BAND via a post-turn harvester — character
  wins over clerical tags, as it should, and a mechanism that needs 25 souls
  to override their register regresses silently with every codex sitting.
- **Cost discipline**: Haiku (`claude-haiku-4-5-20251001`) unless the spec
  says otherwise; `logUsage` on every new generator; cache-stable static
  prefixes never touched by dynamic content.
- **Supabase**: try/catch, never bare `.catch()` chains. SQL migrations
  lowercase, schema `z`, RLS on, `create table if not exists`.
- **Identity walls**: journal content never leaves the meditation room;
  real names/DPs never render in public rooms; spectator-contestant
  asymmetry is server-enforced.
- **Money walls**: chips are never cash and never mix with the purchasable
  token currency; prizes are never cash.

## 5. EXECUTION ORDER (per phase)
server slice → migration → curl-prove every endpoint (write the curls in
your notes) → THEN native surface → `node --check` every touched .js/.cjs
and extracted `<script>` block; `npx tsc --noEmit` where TS is touched
(filter pre-existing errors) → self-review the diff against the spec's
guardrails section.

## 6. DELIVERY (the repo's own convention)
- Follow the delivery style of the newest `APPLY_*.md` in the repo root
  (read one before packaging). Ship the same way: the artifact + an
  `APPLY_<name>.md` stating what changed, why, how to apply, and the curl
  proofs.
- Native fixes ship BOTH the OTA update and the git push — never one
  without the other (this has bitten before).
- End every session with a **handover**: what shipped, what's proven
  (curls), what drifted from the spec, what the next sitting picks up.
  Update or create the surface's `*_STATUS.md` in the repo style.

## 7. WHEN IN DOUBT
Ask the owner one sharp question rather than guessing; present options
with your recommendation. Dev reads fast and rules fast — a good question
costs a minute; a wrong assumption costs a sitting.
