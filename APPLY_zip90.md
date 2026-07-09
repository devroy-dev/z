# zip90 · trip /build goes async — kills the 24s timeout fragility

The Sri Lanka build came back at `HTTP 200, 24.3s` — and a synchronous 24s request is timeout-fragile no matter how fast we trim it (that's what threw the garbage body mid-test). Fix: `/build` no longer holds the request open.

- **`POST /wanderer/trips/:id/build`** now flips the trip to **`status:'planning'` and returns immediately**; the Haiku+search plan runs in the **background** (Railway is a persistent process, same as the ping scheduler).
- **The room polls** the trips list every 4s until the trip leaves `planning` (→ `planned`), showing a "she's building your plan…" state meanwhile.
- **`web_search` 3 → 2** — trims the background build a few seconds; the plans were already well-grounded on 2.
- **Stuck-`planning` recovery** — a build orphaned by a process restart is released back to `dreaming` on read after 3 min. A build that produces nothing also resets `planning → dreaming` (never stuck).

Files: `src/wanderer.ts`, `src/index.ts` (route), `app/TravelDesk.js` (poll + planning state). No migration.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
git pull --rebase
unzip -o zip90.zip -d .
python3 patch.py            # expect 3 ✓ lines (idempotent)
npx tsc --noEmit            # clean
cd app && npx tsc --noEmit ; cd ..
git status --short          # src/wanderer.ts src/index.ts app/TravelDesk.js
```

## SHIP
```
git add -A && git commit -m "trip /build async: instant return + background build + poll; web_search 3->2 (zip90)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip90 async trip build" --non-interactive ; cd ..
```

## VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
T=efc5fec1-0f26-40b7-adad-a3f9694e31f5   # the Sri Lanka trip (or file a fresh dreaming one)
# reset it to dreaming first so we watch the full cycle:
#   Supabase SQL: update z.trip_files set status='dreaming', itinerary=null, checklist=null where id='efc5fec1-0f26-40b7-adad-a3f9694e31f5';
```
**1 · build returns instantly now (was 24s):**
```
curl -s -w "\n---%{time_total}s---\n" -X POST https://z-production-c79a.up.railway.app/wanderer/trips/efc5fec1-0f26-40b7-adad-a3f9694e31f5/build -H "authorization: Bearer $TOKEN" | jq '.trip | {status, building}'
```
Expect `{"status":"planning","building":true}` and a sub-second `---…s---`.

**2 · poll until it lands (run a few times over ~20s):**
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[] | select(.id=="efc5fec1-0f26-40b7-adad-a3f9694e31f5") | {status, days:(.itinerary|length)}'
```
First calls show `status:"planning"`; within ~20s it flips to `status:"planned"` with a real `days` count. That's the async build proven.

**On device:** Travel Desk → expand a dreaming trip → **build the plan** → the card shows a spinner + "she's building your plan…" → ~20s later it fills in on its own (no frozen tap, no timeout).

## NOTE
- `src/index.ts` is shared with the other track — the edit is the `/build` route body + one import line, additive. `--3way`; reconcile if dirty.
- Background build relies on Railway's persistent process (same basis as the ping scheduler + desk-note scheduler) — safe here; would need a queue only on serverless.
- Still open from Phase 2: the flagged **T-1 live-weather** fire-time hook (separate, your call).
- Next: **Phase 3 — Host brief + tags + marquee swap (§2) + migration 0058.**
