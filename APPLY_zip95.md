# zip95 · Newsroom Phase 5a — YOUR DESK (§6.1) + FACT-CHECK (§6.3) + migration 0057

The newsroom learns your name. First of Phase 5's two zips; **zip96** adds story-tracking (§6.2). §6.4 (morning ping) is Phase 6, folded with §2.2E per the build order — not dropped.

- **§6.1 YOUR DESK — personalization at zero model cost.** `z.news_follows` holds topics/entities you follow; `GET /news/desk` filters the free RSS **wire** against them server-side → a "your desk" strip. **No model is billed for a headline.** Room: follow chips + an add-a-follow input + the matched-wire strip above the shared edition.
- **§6.3 FACT-CHECK — the WhatsApp-forward desk.** `POST /bulletin/factcheck`: paste a claim → Haiku + web search → `{verdict: true|false|misleading|unverifiable, reasoning, sources}` → filed in `z.fact_checks`, rendered as a colour-coded verdict card with history. The room's tagline finally cashed.
- **0057** — `news_follows` (with `last_checked`/`last_seen` for §6.2's tracker) + `fact_checks`.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
git pull --rebase
unzip -o zip95.zip -d .
python3 patch.py            # 5 ✓
npx tsc --noEmit
cd app && npx tsc --noEmit ; cd ..
git status --short
```

## MIGRATION (Supabase → SQL editor, run once)
Paste `migrations/0057_news_desk.sql`. Additive (`create table if not exists`). Ladder: …0057 (this) alongside the 0054/0055/0056/0058 already applied.

## SHIP
```
git add -A && git commit -m "Newsroom: your desk (follows + free wire filter) + fact-check desk + 0057 (zip95, phase 5a)"
git push
cd app && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "zip95 newsroom your-desk + factcheck"
cd ..
```
> Note: `CI=1 … update` (not `--non-interactive`, which this eas-cli rejects). A successful publish prints an **Update group ID**, not a Metro bundler start.

## VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
```
**1 · follow a topic, then your desk fills from the free wire (no model):**
```
curl -s -X POST https://z-production-c79a.up.railway.app/news/follows -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"kind":"topic","term":"cricket"}' | jq '.follow.term'
curl -s https://z-production-c79a.up.railway.app/news/desk -H "authorization: Bearer $TOKEN" | jq '.items | {count: length, first: .[0].title}'
```
Expect matched wire headlines containing your term. (If the wire has nothing matching right now, `count` may be 0 — try a broad term like "india".)

**2 · the fact-check desk returns + files a verdict:**
```
curl -s -X POST https://z-production-c79a.up.railway.app/bulletin/factcheck -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d '{"claim":"The Indian government has made UPI transactions taxable from this month."}' | jq '.check | {verdict, sources: (.sources|length)}'
curl -s https://z-production-c79a.up.railway.app/bulletin/factchecks -H "authorization: Bearer $TOKEN" | jq '.checks | length'
```
Expect a `verdict` (one of true/false/misleading/unverifiable) with real sources, and history length ≥ 1.

**On device:** the bulletin room shows a "your desk" box (follow chips + matched wire) above the edition, and a "the fact-check desk" with a verdict card + past checks.

## NOTE
- ⚠ `src/index.ts` shared with the other track — additive; `--3way`.
- `yourDesk` bills **no model** — it's the free wire filtered by string match (the wire's own law). Fact-check is the only model call here (Haiku + ≤4 searches).
- 0057 carries two columns beyond the base spec (`last_checked`, `last_seen`) so §6.2's tracker (zip96) needs no second migration.
- **§6.2 story-tracking** ships next in **zip96** (a throttled per-user sweep — pinned stories that develop → the anchor pings you). **§6.4** morning ping is Phase 6.
- Carried: the empty-closet starter-gaps tweak (stylist) still rides a later zip.
