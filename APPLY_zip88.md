# zip88 · DESK ROOMS Phase 1 — the Media Manager retention loop (§5.1–5.3 + migration 0056)

Turns the Media Manager from a room you *fill in* into one that *checks on you*. Three shifts:

- **§5.1 the loop closes** — his weekly desk note now emits its one concrete instruction as a tracked task (`mm_tasks`). Next week's note **grades it first** (done / skipped / still open) before issuing the next. A manager who never inspects is just a newsletter.
- **§5.2 the content desk** — ideas he shapes in conversation file themselves via a `[[IDEA: title | format | hook]]` tag into a pipeline (`mm_ideas`, idea → drafted → posted). **Draft this** has him write the hook/caption/script from the brief + the real numbers; **mark posted** closes the loop.
- **§5.3 the note gets eyes** — the desk note runs `web_search` (capped at 2, pinned to Haiku like the newsroom) to ground **one** line in what actually moved in the client's niche this week. Never invents a trend.

Server-verifiable first; the room surface (checkable instruction under the desk note + the pipeline board) rides OTA.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
unzip -o zip88.zip -d .
python3 patch.py            # expect 6 ✓ lines (idempotent; re-run is a no-op)
npx tsc --noEmit            # expect clean (server)
cd app && npx tsc --noEmit ; cd ..   # app parse gate
git status --short          # expect: src/mmDesk.ts src/loop.ts src/index.ts app/api.js app/MediaRoom.js + new migrations/0056_mm_loop.sql
```

## MIGRATION (Supabase → SQL editor, run once)
Paste all of `migrations/0056_mm_loop.sql` and run. It creates `z.mm_tasks` and `z.mm_ideas` (both RLS-on, FK-free, self-contained). Safe to re-run (`create table if not exists`). The ladder jumps 0053 → 0056; 0054/0055 land with their own later phases.

## SHIP
```
git add -A && git commit -m "MM retention loop: weekly instruction→task w/ grading, content pipeline, web-search eyes (zip88, DESK ROOMS phase 1)"
git push                                                   # Railway auto-builds the engine
npx eas-cli@latest update --branch preview --environment preview -m "zip88 MM loop room surface" --non-interactive
```
Native (MediaRoom.js) needs **both** the push and the `eas update` — OTA ≠ committed.
Device: **You → check for updates.** `git pull --rebase` first if the other track has uncommitted `index.ts`/`loop.ts`.

## VERIFY (curl — engine before device)
```
BASE=https://z-production-c79a.up.railway.app
U=d91a137e-46d4-4d85-91e4-6092007e8501
# $TA = your bearer JWT (terminal only) · $DEV_KEY = founder key
```

**1 · the loop (§5.1 + §5.3) — force this week's note, watch the task fall out:**
```
curl -s -X POST $BASE/dev/mm/desknote -H "x-dev-key: $DEV_KEY" \
  -H "content-type: application/json" -d "{\"user_id\":\"$U\"}" | jq
```
Expect `{ wrote:true, note:{ note:"…60-120 words, one web-grounded line…" }, task:{ instruction:"…", week_of:"YYYY-MM-DD", status:"open" } }`.
**Run it a second time** → the new `note` should *open by grading* the still-open instruction (that's the loop closing, not a newsletter).

**2 · the instruction is tickable (§5.1):**
```
curl -s $BASE/mm/tasks -H "authorization: Bearer $TA" | jq '.tasks[0]'
TID=$(curl -s $BASE/mm/tasks -H "authorization: Bearer $TA" | jq -r '.tasks[0].id')
curl -s -X POST $BASE/mm/tasks/$TID -H "authorization: Bearer $TA" | jq '.task.status'   # "done"
curl -s -X POST $BASE/mm/tasks/$TID -H "authorization: Bearer $TA" | jq '.task.status'   # "open" (toggles)
```

**3 · the content pipeline (§5.2):** file an idea by *talking to the Media Manager in-app* — e.g. "let's do a reel comparing my top two posts this month." He files it silently via the `[[IDEA]]` tag. Then:
```
curl -s $BASE/mm/ideas -H "authorization: Bearer $TA" | jq '.ideas[0]'                    # status:"idea"
IID=$(curl -s $BASE/mm/ideas -H "authorization: Bearer $TA" | jq -r '.ideas[0].id')
curl -s -X POST $BASE/mm/ideas/$IID/draft  -H "authorization: Bearer $TA" | jq '.idea | {status, draft}'   # "drafted" + the written draft
curl -s -X POST $BASE/mm/ideas/$IID/posted -H "authorization: Bearer $TA" | jq '.idea.status'              # "posted"
```

**On device:** open the Media Manager → the desk note now has a **this week** checkbox row under it (tap = done, strike-through) → scroll to **the pipeline** → filed ideas show with **draft this** → tap → his draft appears → **mark posted ✓**.

## NOTE
- ⚠ **`src/index.ts` + `src/loop.ts` are shared** with the Battlefield/rooms track. My edits are purely additive (one import line, the `/mm/*` route block, two `loop.ts` insertions). `patch.py` uses `git apply --3way`, so minor drift self-merges — but if either file is dirty in another session, reconcile before `git push`.
- **§5.2 "draft this" is a server-side generator** (`POST /mm/ideas/:id/draft`, coach pattern — curl-provable, flips status) rather than a chat deep-link opener. If you wanted the in-thread opener flavor instead, say so and I'll swap it in a follow-up.
- **Added `POST /mm/ideas/:id/posted`** — beyond the literal §5.2 text, but it completes the idea → drafted → **posted** ladder that 0056's own SQL defines (no dead-end cards). Pull it if you'd rather keep Phase 1 to the letter.
- **Added `POST /dev/mm/desknote`** — founder-gated (`x-dev-key`), verification-only, not user-facing. Without it the note path is only reachable via the hourly scheduler behind a 6-day guard, so the loop couldn't be curl-proven on demand.
- Guardrails held: Haiku throughout, `web_search` capped at 2 + `__pin:'anthropic'`, `logUsage` on both generators (`mm_desknote`, `mm_draft`), tags emit-on-change and are stripped before persist, `mmBlock` rides the uncached dynamic suffix (cache prefix untouched).
- **Next sitting:** Phase 2 — Trip v2 (migration **0055**), per the build order.
