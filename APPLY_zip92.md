# zip92 · Phase 4a — THE STYLIST ACTS (§3 + migration 0054)

The wardrobe stops being a photo album. (This is the first of Phase 4's two zips; **zip93** finishes the travel desk — apply 92 first.)

- **§3.1 outfits as objects** — `[[OUTFIT: name | piece_ids | occasion | date?]]` in her thread → `z.outfits`. A dated look schedules a morning-of `the_diva` ping ("the Sharma wedding is today — the ivory look is filed. steam it."). Room: a **your looks** strip with piece thumbnails.
- **§3.2 the gap report** — `POST /stylist/gaps/run`: Haiku audits the FULL wardrobe with web search, writes 3–6 rows to `z.wardrobe_gaps` (`what/why/priority/shop_cards`, real finds only). Re-run replaces the open rows. Room: a **gap report** pane — run, tick "got it" (→ bought), tap a shop card to buy. Replaces the old "fill the gap" chat opener.
- **§3.3 retrieval fix** — `wardrobeBlock`'s hard `limit(30)` → a counts-by-kind summary + up to 40 pieces chosen by relevance (keyword-match the message against kind/colors/tags, then fill newest). Each piece now carries its id so she can compose outfits.
- **§3.4 wear tracking** — `wardrobe_pieces += wear_count, last_worn`; `POST /stylist/wardrobe/:id/worn`; a "wore it" tap on each tile; her block gets a "gathering dust" line.
- **brief fix (promised)** — the desk brief's stylist line now queries `status='open'` (was a wrong `resolved` guess) and routes to `the_diva`; and all brief lines trim on a word boundary with "…" instead of mid-word.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
git pull --rebase
unzip -o zip92.zip -d .
python3 patch.py            # 7 ✓
npx tsc --noEmit
cd app && npx tsc --noEmit ; cd ..
git status --short
```

## MIGRATION (Supabase → SQL editor, run once)
Paste `migrations/0054_stylist_outfits_gaps.sql`. Additive (`create table if not exists`, `add column if not exists`) — safe to re-run. Ladder now contiguous 0054 → 0056 → 0058 (0057 = Phase 5).

## SHIP
```
git add -A && git commit -m "Stylist acts: outfits + gap report + relevance retrieval + wear; brief stylist fix (zip92, phase 4a)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip92 stylist acts" --non-interactive ; cd ..
```

## VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
```
**1 · the gap report runs** (needs a few wardrobe pieces filed first — add them in the room, or it'll audit a near-empty closet):
```
curl -s -X POST https://z-production-c79a.up.railway.app/stylist/gaps/run -H "authorization: Bearer $TOKEN" | jq '.gaps | map({what, priority, cards: (.shop_cards|length)})'
```
Expect 3–6 gaps, priority-ordered, each with real shop cards. (~15s — Haiku + 2 searches.)
```
curl -s https://z-production-c79a.up.railway.app/stylist/gaps -H "authorization: Bearer $TOKEN" | jq '.gaps[0]'
# tick one bought:
curl -s -X POST https://z-production-c79a.up.railway.app/stylist/gaps/$(curl -s https://z-production-c79a.up.railway.app/stylist/gaps -H "authorization: Bearer $TOKEN" | jq -r '.gaps[0].id') -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"status":"bought"}' | jq '.gap.status'
```
**2 · an outfit files from chat** — talk to the stylist (`the_diva`) about a look; when she composes one from your pieces she emits `[[OUTFIT]]`:
```
curl -s https://z-production-c79a.up.railway.app/stylist/outfits -H "authorization: Bearer $TOKEN" | jq '.outfits[0] | {name, occasion, pieces: (.pieces|length)}'
```
**3 · the brief's stylist line now lights up** (after a gap run):
```
curl -s https://z-production-c79a.up.railway.app/desk/brief -H "authorization: Bearer $TOKEN" | jq '.items[] | select(.key=="stylist")'
```
Expect a `{key:"stylist", route:"the_diva", …}` item.

## NOTE
- ⚠ `src/index.ts` + `src/loop.ts` shared with the other track — additive; `--3way`; reconcile if dirty.
- **Gap run is synchronous (~15s).** If it ever hits the proxy timeout under load, we async it exactly like the trip build (the proven claim+poll pattern) — flag it. Kept sync now because it's a rare, deliberate tap.
- **Outfit piece_ids** are stored as `uuid[]`; the tag must carry ids from the wardrobe block's braces (she's instructed to only use those).
- Next: **zip93 — Travel completion (§4.4 packing list [Wanderer × Stylist], §4.5 in-trip mode, §4.6 [[ITINERARY]]/[[CHECK]] tags).** The packlist reads the wardrobe this zip enables and can feed `wardrobe_gaps`.
