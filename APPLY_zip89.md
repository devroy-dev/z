# zip89 · DESK ROOMS Phase 2 — Trip v2: a body and a clock (§4.1–4.3 + migration 0055)

The Travel Desk stops being a list of destinations you typed and becomes a trip that plans itself and then counts down to departure.

- **§4.1 trips get a body** — additive columns on `trip_files`: `status` (dreaming → planned → booked → live → done), parsed `start_date`/`end_date`, `itinerary` jsonb, `checklist` jsonb, `budget`, `shop_cards`. The `[[TRIP]]` pipeline keeps writing the original four untouched.
- **§4.2 `POST /wanderer/trips/:id/build`** — the coach pattern for travel: Haiku + `web_search` takes the trip row → writes a real itinerary, seeds a checklist, resolves the free-text dates to a calendar, flips `status='planned'`, and drops her spoken summary into her thread so the plan has a voice.
- **§4.3 the clock** — `syncTripPings`, pure `scheduled_pings`, idempotent per trip (`payload->>'trip_id'`): T-30 (paperwork), T-3 (pack), T-1 (eve). `status→'live'`/`'done'` auto-flips on the trips read as the window arrives.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
unzip -o zip89.zip -d .
python3 patch.py            # expect 6 ✓ lines (idempotent; re-run is a no-op)
npx tsc --noEmit            # expect clean (server)
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: src/wanderer.ts (new) src/loop.ts src/index.ts app/api.js app/TravelDesk.js + new migrations/0055_trip_files_v2.sql
```

## MIGRATION (Supabase → SQL editor, run once)
Paste all of `migrations/0055_trip_files_v2.sql` and run. Pure `add column if not exists` — additive and safe to re-run. Ladder is now 0053 → 0055 → 0056; 0054 (Stylist) still lands with Phase 4.

## SHIP
```
git add -A && git commit -m "Trip v2: states + body, /build (itinerary+checklist+dates), the clock (zip89, DESK ROOMS phase 2)"
git push                                                   # Railway auto-builds the engine
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip89 travel desk trip v2" --non-interactive ; cd ..
```
Native (TravelDesk.js) needs **both** the push and the `eas update` (run it from `app/`, not the repo root). Device: **You → check for updates.**

## VERIFY (curl — engine before device)
```
BASE=https://z-production-c79a.up.railway.app
# $TOKEN = your bearer JWT (terminal only)
```

**1 · file a trip with a real future date** (chat with the Wanderer so `[[TRIP]]` fires — same path as an idea). In her thread say something like:
> "Planning Vietnam, two of us, roughly 6–15 December this year, we like food and slow mornings."

Then confirm it filed (grab its id):
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[0] | {id, destination, dates, status}'
```
Expect `status:"dreaming"`.

**2 · build the plan (§4.2 + §4.3 in one call).** The response carries the written itinerary/checklist AND the `pings` the clock just laid:
```
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/$(curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq -r '.trips[0].id')/build -H "authorization: Bearer $TOKEN" | jq '.trip | {status, start_date, end_date, budget, days: (.itinerary|length), checklist: (.checklist|length), pings: [.pings[].payload.tag]}'
```
Expect `status:"planned"`, real `start_date`/`end_date`, a non-zero `days` and `checklist`, and `pings` containing the future milestones among `["T-30","T-3","T-1"]` (only those still in the future are scheduled).

**3 · the plan now rides the read + her thread:**
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[0] | {status, itinerary: (.itinerary|length)}'
```
And open her thread in the app — her spoken summary of the plan is waiting there.

**4 · the clock is real (raw pings, founder view via Supabase):** in the SQL editor —
```
select payload->>'tag' tag, due_at, body from z.scheduled_pings
where payload->>'trip_id' = '<TRIP_ID>' and fired_at is null order by due_at;
```
Re-running the build re-lays them idempotently (no duplicates).

**On device:** Travel Desk → the trip shows a **status chip**; tap it to expand → **build the plan →** → it fills with the day-by-day itinerary + a *before you go* checklist + budget.

## NOTE
- ⚠ **`src/index.ts` + `src/loop.ts` are shared** with the other track. Edits are additive (one import, the `/wanderer` route swap + `/build`, a `tripBlock` read extension). `patch.py` uses `--3way`; reconcile if either file is dirty elsewhere before push.
- **T-1 ping is a nudge, not a baked forecast.** A live weather line composed at sync-time (up to 30 days early) would be stale, and fetching at fire-time needs a `firePings` search-hook (shared infra, out of Phase 2). So T-1 invites the weather rather than faking it; the live line rides her thread when tapped. Flag if you want me to add the fire-time search hook next.
- **`status→'live'` flip is write-on-read** in the trips GET (as the spec says "date check in the trips GET") — it only writes when the window actually changed.
- **Checklist is read-only this phase.** Ticking items persists via the `[[CHECK]]` tag = **§4.6, later**. §4.4 packlist (needs Stylist's `wardrobe_pieces`, Phase 4) and §4.5 full in-trip UI are also later, per your build order.
- **Ping collision with the morning line:** trip pings fire at 9:00 IST on their milestone days, independent of each other (same as today's booking/reminder pings). The house-wide "one knock per morning" fold is **Phase 6** (§6.4); these will route through it then.
- Guardrails held: Haiku, `web_search` capped at 3 + `__pin:'anthropic'`, `logUsage` fn `trip_build`, never-invent baked into the build prompt (no faked places/URLs), the clock is pure `scheduled_pings` + idempotent, cache prefix untouched (`tripBlock` rides the dynamic suffix).
- **Next sitting:** Phase 3 — Host brief + new tags + marquee swap (§2) + migration 0058.
