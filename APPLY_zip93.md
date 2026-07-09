# zip93 · Phase 4b — TRAVEL DESK COMPLETION (§4.4–4.6)

Finishes Phase 4. **Apply zip92 first** — the packing list feeds the stylist's `wardrobe_gaps` (migration 0054). No new migration here.

- **§4.4 the packing list** — `POST /wanderer/trips/:id/packlist`: the Wanderer reads the trip + their **wardrobe** and composes a list from what they OWN, flagging what's missing → those misses land in `wardrobe_gaps` (the stylist picks them up). Stored on the trip's checklist (`pack:true` items). Room: a **packing** section on the trip card with a "build from my wardrobe" button. This is the Wanderer × Stylist cross-room moment.
- **§4.5 in-trip mode** — when a trip goes `live`, the card flips to **"day N — today's title"** (computed from `start_date`), with today's items highlighted and the current day marked in the itinerary. The desk knows where you are in the trip.
- **§4.6 the plan stays current from chat** — two new Wanderer tags: `[[ITINERARY: destination | day | title | items]]` revises a day; `[[CHECK: destination | item | done]]` ticks a checklist item. Conversation updates the file; no re-planning from scratch.

## APPLY (Codespace, repo root — AFTER zip92)
```
cd /workspaces/z
git pull --rebase
unzip -o zip93.zip -d .
python3 patch93.py          # 5 ✓ (refuses if zip92 isn't applied)
npx tsc --noEmit
cd app && npx tsc --noEmit ; cd ..
git status --short           # src/wanderer.ts src/index.ts src/loop.ts app/api.js app/TravelDesk.js
```

## MIGRATION
None. (Uses 0054's `wardrobe_gaps` from zip92 and 0055's trip columns.)

## SHIP
```
git add -A && git commit -m "Travel desk complete: packing list + in-trip mode + itinerary/check tags (zip93, phase 4b)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip93 travel completion" --non-interactive ; cd ..
```

## VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
```
**1 · the packing list builds from the wardrobe** (use a real trip id — a planned one is best):
```
TRIP=$(curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq -r '.trips[0].id')
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/$TRIP/packlist -H "authorization: Bearer $TOKEN" | jq '{pack: (.pack|length), missing: (.missing|length)}'
```
Expect `pack` 10–16, `missing` up to 6. Confirm the misses became stylist gaps:
```
curl -s https://z-production-c79a.up.railway.app/stylist/gaps -H "authorization: Bearer $TOKEN" | jq '.gaps | map(select(.why | test("trip"))) | length'
```
**2 · the itinerary updates from chat** — tell the Wanderer to change a day ("make day 2 of <trip> a food-and-markets day"); she emits `[[ITINERARY]]`. Re-fetch the trip and the day should be rewritten:
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[0].itinerary[1]'
```
**3 · in-trip mode** — for a trip whose `start_date` is today/past and `end_date` is future, `tripsFor` flips it to `live`; the card shows "day N — title". (Set a trip's dates around today to see it on device.)

## NOTE
- **Packing list is synchronous (~12s, no web search)** — it reasons from owned pieces + destination, so it's faster than the trip build; a spinner covers it. Async-if-needed (same proven pattern) if it ever times out.
- **`[[CHECK]]` matches a checklist item by text (`includes`, first match)** — robust for "visa", "flights"; if two items share words it ticks the first. Fine for the real checklist sizes.
- `src/index.ts` + `src/loop.ts` shared with the other track — additive; `--3way`.
- Phase 4 complete after this. Next: **Phase 5 — Newsroom (§6, migration 0057)**.
