# zip90b · hotfix — async build race (dreaming with a full plan)

**Symptom (curl-proven):** after firing `/build` a few times, a trip read back `status:"dreaming"` with `days:10`. The async change let repeated/concurrent builds collide.

**Two faults, both in `src/wanderer.ts`:**
- **No concurrency guard** — every `/build` set `status:'planning'` unconditionally, so a later call stomped an already-succeeded `planned` back to `planning`.
- **Failure downgraded blindly** — a rebuild that hit an empty parse reset to `dreaming` even when a real itinerary already existed, leaving the inconsistent `dreaming`+`days:10`.

**Fix:**
- **Atomic build-claim** — the `planning` flip is a conditional update (`status != 'planning'`); only the caller that actually claims it fires the build. Double-taps/concurrent calls return "already building" and fire nothing.
- **Revert-aware failure** — a build that produces nothing reverts to `planned` if the trip already has an itinerary, otherwise `dreaming`. Never downgrades a real plan.

## APPLY + SHIP
```
cd /workspaces/z
git pull --rebase
unzip -o zip90b.zip -d .
python3 patch.py            # 1 ✓
npx tsc --noEmit
git add -A && git commit -m "hotfix: async build race — atomic claim + revert-aware failure (zip90b)"
git push                    # Railway rebuilds; no migration, no OTA
```

## HEAL the test trip (Supabase SQL, one-time — it's currently dreaming+days:10)
```sql
update z.trip_files set status='planned'
where id='efc5fec1-0f26-40b7-adad-a3f9694e31f5' and itinerary is not null;
```

## VERIFY (after redeploy)
Reset to dreaming, build ONCE, then poll — it should go planning → planned cleanly, and a second immediate build must NOT disturb it:
```
# SQL: update z.trip_files set status='dreaming', itinerary=null, checklist=null where id='efc5fec1-0f26-40b7-adad-a3f9694e31f5';
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/efc5fec1-0f26-40b7-adad-a3f9694e31f5/build -H "authorization: Bearer $TOKEN" | jq '.trip.status'   # "planning"
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/efc5fec1-0f26-40b7-adad-a3f9694e31f5/build -H "authorization: Bearer $TOKEN" | jq '.trip.status'   # "planning" (2nd tap = no-op, fires nothing)
# wait ~20s, then:
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[] | select(.id=="efc5fec1-0f26-40b7-adad-a3f9694e31f5") | {status, days:(.itinerary|length)}'   # {"status":"planned","days":10}
```
Should end `planned` + `days:10`, never `dreaming` with a plan attached.

## NOTE
Same-file hotfix, engine only. Next: **Phase 3 — Host brief + tags + marquee (§2) + 0058.**
