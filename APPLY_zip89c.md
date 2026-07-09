# zip89c · cleanup — clean her voice, drop the debug field

Trip /build is proven (zip89b). Two small tidies, `src/wanderer.ts` only:
- **Strip inline `<cite …>…</cite>` markup** the model wrapped around web-search facts inside the `summary` string. That summary is inserted into her thread as her spoken voice — the tags were leaking into it. Words kept, markup gone.
- **Remove `_debug`** from the build response (it did its job diagnosing the truncation).

## APPLY + SHIP
```
cd /workspaces/z
unzip -o zip89c.zip -d .
python3 patch.py            # 1 ✓
npx tsc --noEmit
git add -A && git commit -m "wanderer: strip <cite> markup from trip summary; drop _debug (zip89c)"
git push                    # Railway rebuilds; no migration, no OTA
```

## VERIFY (after redeploy)
Re-build the trip (overwrites the plan + re-lays pings idempotently), then read her thread — the summary is clean prose, no `<cite>` tags:
```
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/021dee14-b06f-4094-a8a9-dcac37e7de42/build -H "authorization: Bearer $TOKEN" | jq '{built, status, days:(.itinerary|length)}'
```
The one already-posted summary message in her thread (from the zip89b test) keeps its tags — cosmetic, ignore or delete it; all new builds are clean.

## NOTE
Phase 2 is now fully proven on the live engine: §4.2 build (real itinerary + checklist + parsed dates), §4.3 clock (T-30/T-3/T-1, idempotent), status flip. Still to do: eyeball the Travel Desk room on device after the zip89 OTA. Next sitting: **Phase 3 — Host brief + tags + marquee (§2) + 0058.**
