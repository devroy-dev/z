# zip89b · HOTFIX — trip /build flipped status without a plan

**Symptom (curl-proven):** `POST /wanderer/trips/:id/build` set `status='planned'` but left `itinerary`, `checklist`, `start_date`, `end_date`, `budget` all null, and laid 0 pings. The build model returned something the JSON parse couldn't read, and the code flipped status unconditionally — a failed build looked like a planned trip.

**Fix (src/wanderer.ts only):**
- A build with **no real itinerary no longer writes anything** — the trip stays `dreaming` instead of a fake `planned`.
- The build response now carries a `_debug` block (`rawLen`, `stop_reason`, `parsedKeys`, `head`, `tail`) so we can **see** what the model returned.
- `max_tokens` 1600 → 3000 (truncation of a long itinerary JSON is the leading suspect).

## APPLY
```
cd /workspaces/z
unzip -o zip89b.zip -d .
python3 patch.py            # expect 1 ✓ line
npx tsc --noEmit            # clean
git add -A && git commit -m "hotfix: trip /build must not flip status on empty parse; surface raw + raise tokens (zip89b)"
git push                    # Railway rebuilds; no migration, no OTA
```

## VERIFY (after Railway redeploys)
```
BASE=https://z-production-c79a.up.railway.app
# reset the falsely-'planned' test trip back to dreaming first (Supabase SQL):
#   update z.trip_files set status='dreaming' where id='021dee14-b06f-4094-a8a9-dcac37e7de42';
```
Then re-run the build and read the diagnostic:
```
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/021dee14-b06f-4094-a8a9-dcac37e7de42/build -H "authorization: Bearer $TOKEN" | jq '{built, status, days: (.itinerary|length), checklist: (.checklist|length), pings: [.pings[].payload.tag], _debug}'
```
- If `built:true` with non-zero `days`/`checklist` and `pings` — fixed, the token bump was it.
- If `built:false` — the `_debug.head`/`_debug.tail`/`_debug.stop` show exactly what the model returned; paste that and I'll fix the true cause (empty text vs. prose vs. still-truncated).

Once green, `_debug` comes out in the next zip.
