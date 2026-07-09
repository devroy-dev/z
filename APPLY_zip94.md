# zip94 · the Wanderer × Stylist seam (completes §4.4 · pins trip-gaps)

A pre-Newsroom clean-up of the cross-room bridge. Built after reading §4.4/§3.2 verbatim and auditing the live code — it closes the one dropped §4.4 line and delivers the polish we agreed from the screenshots. **Apply after zip92 + zip93.**

### What it does
- **§4.4 completion — the T-3 ping surfaces the packlist.** The ping was a Phase-2 placeholder ("want me to build you a list?"). Now: if a packing list is filed it says *"your list's ready — N to pack, want to run through it?"*; only offers to build when there isn't one. `buildPacklist` re-syncs the pings after storing, so the ping reflects reality.
- **Trip-gaps pinned (`0054b`, `wardrobe_gaps.trip_id`).** The packlist's misses now carry the trip they came from. Re-running a packlist replaces *that trip's* open gaps and never touches the standing wardrobe audit.
- **Per-trip cards in the stylist room.** Trip-gaps render as a labelled group ("for Sri Lanka · 5 pieces"), visually distinct from the standing closet gaps — no more crowding.
- **Wanderer → Stylist handoff on the travel card.** A planned trip with gaps shows *"the stylist has 5 pieces for this trip →"*, tapping through to her room. The bridge is now walkable from the side that creates it.
- **Owned-vs-needed packing.** `buildPacklist` maps pack items to real `piece_id`s; the travel card shows owned pieces with their **actual filed photos**, generics as plain lines, and the misses via the handoff card.
- **Desk brief counts standing gaps only** (`trip_id is null`) — a trip no longer makes your closet read as incomplete.

### APPLY (Codespace, repo root — AFTER zip92 + zip93)
```
cd /workspaces/z
git pull --rebase
unzip -o zip94.zip -d .
python3 patch.py            # 7 ✓  (refuses if the packlist isn't present)
npx tsc --noEmit
cd app && npx tsc --noEmit ; cd ..
git status --short
```

### MIGRATION (Supabase → SQL editor, run once)
Paste `migrations/0054b_gap_trip_link.sql` — one nullable column + a partial index. Additive, no backfill (existing trip-gaps stay `trip_id null` until their packlist is rebuilt, which re-tags them). **Apply by hand as usual** — there's no auto-runner, so the `0054b` name is purely for our reference and slots after 0054.

### SHIP
```
git add -A && git commit -m "Wanderer×Stylist seam: T-3 surfaces packlist + trip_id pinning + per-trip cards + handoff + owned packing (zip94)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip94 wanderer×stylist seam" --non-interactive ; cd ..
```

### VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
TRIP=$(curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq -r '.trips[] | select(.destination|test("Sri Lanka")) | .id')
```
**1 · rebuild the packlist — pack items now carry piece_id, misses carry trip_id:**
```
curl -s -X POST https://z-production-c79a.up.railway.app/wanderer/trips/$TRIP/packlist -H "authorization: Bearer $TOKEN" | jq '{pack:(.pack|length), owned:.owned, missing:(.missing|length), sample:(.pack[0])}'
```
Expect `owned` > 0 and `sample` to include a `piece_id`.
**2 · the misses are pinned to the trip:**
```
curl -s https://z-production-c79a.up.railway.app/stylist/gaps -H "authorization: Bearer $TOKEN" | jq '[.gaps[] | select(.trip_id!=null)] | {count: length, trip: .[0].trip_name}'
```
Expect `trip: "Sri Lanka"` and a count.
**3 · the trip carries a gap_count (drives the handoff card):**
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips[] | select(.destination|test("Sri Lanka")) | .gap_count'
```
**4 · the brief no longer counts trip-gaps** (should reflect only standing wardrobe gaps, or be absent if none):
```
curl -s https://z-production-c79a.up.railway.app/desk/brief -H "authorization: Bearer $TOKEN" | jq '.items[] | select(.key=="stylist")'
```
**5 · the T-3 ping surfaces the list** — for a trip 3+ days out with a packlist, check the scheduled ping body (Supabase SQL):
```sql
select body from z.scheduled_pings where payload->>'tag'='T-3' and fired_at is null order by created_at desc limit 1;
```
Expect "your packing list's ready — N to pack…".

**On device:** stylist room shows a "for Sri Lanka · N pieces" group under the gap report; the travel card's packing section shows your owned pieces with photos + a "the stylist has N pieces →" handoff.

### NOTE
- ⚠ `src/wanderer.ts`, `src/deskBrief.ts`, `app/Nav.js` are shared with the other track — additive; `--3way`.
- Migration name `0054b` is deliberate (amends 0054's `wardrobe_gaps`); it does not consume a reserved integer slot.
- The owned-vs-needed thumbnails surface the traveller's wardrobe photos on the travel desk (agreed — it's their own filed pieces).
- Next: **Phase 5 — Newsroom (§6, migration 0057).** The empty-closet starter-gaps tweak still rides Phase 5.
