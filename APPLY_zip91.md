# zip91 · DESK ROOMS Phase 3 — the Host reads its own house (§2.2 A–D + 0058)

The front desk stops performing a living house and starts holding the real one.

- **§2.2A `GET /desk/brief`** (`src/deskBrief.ts`) — one model-free assembly of REAL state, priority-ordered, max 5: a trip counting down (≤14 days), a task due (≤48h), this week's unmoved MM instruction (or a fresh memo), the coaching day waiting, today's lead. Each source is guarded — stylist gaps (§3, migration 0054) contribute nothing until they exist.
- **§2.2B the marquee** — `Desk.js`'s random `Math.random()` "tonight at the house" is replaced by the brief; same card design, `route` feeds the existing `routeTo()`. A random hook only shows for a brand-new, empty house.
- **§2.2C the block** — the same brief in compact text rides `frontDeskBlock`, so Z *speaks* the house ("your trip's in 9 days and the visa box is unticked — want the Wanderer?") instead of guessing.
- **§2.2D new verbs:**
  - **tasks that knock** — `[[TASK_ADD: … | due: …]]` now also schedules a `scheduled_pings` reminder, so a dated task actually comes back. (Kept on the existing TASK_ADD rather than adding a duplicate `[[TASK]]`.)
  - **`[[HANDOFF: persona_key | opener]]`** — GOTO plus a briefing: the door card appears AND the target room greets them already holding the context (opener rides as that persona's own opening line — no fake user turn, no extra model call).
- **0058** — `tasks.due_at` (already present → no-op) + index; `users.morning_brief`/`morning_brief_hour` (unused until the Phase 6 morning line).

## APPLY (Codespace, repo root)
```
cd /workspaces/z
git pull --rebase
unzip -o zip91.zip -d .
python3 patch.py            # 6 ✓ (idempotent)
npx tsc --noEmit
cd app && npx tsc --noEmit ; cd ..
git status --short          # src/deskBrief.ts(new) src/index.ts src/loop.ts app/api.js app/Desk.js + migrations/0058
```

## MIGRATION (Supabase → SQL editor, run once)
Paste `migrations/0058_desk_dispatch.sql`. All `add column if not exists` — additive, safe to re-run. Ladder: 0056 → 0058 (0057 newsroom lands with Phase 5).

## SHIP
```
git add -A && git commit -m "Host: /desk/brief + marquee swap + block brief + tasks-knock + HANDOFF (zip91, phase 3)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip91 desk brief marquee" --non-interactive ; cd ..
```

## VERIFY (curl — engine)
```
BASE=https://z-production-c79a.up.railway.app
```
**1 · the brief assembles from real state:**
```
curl -s https://z-production-c79a.up.railway.app/desk/brief -H "authorization: Bearer $TOKEN" | jq '.items'
```
Expect an array (≤5) of `{key, kicker, line, route, prio}`. With your data it should include the Media Manager's open instruction ("this week's move"), plus today's lead if a bulletin is cached. (The Sri Lanka trip won't show — it's >14 days out; file a trip ≤14 days to see the countdown line.)

**2 · a dated task now knocks** — chat the front desk and let her set one:
```
curl -s -N -X POST https://z-production-c79a.up.railway.app/chat -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d "{\"threadId\":\"$(curl -s -X POST https://z-production-c79a.up.railway.app/threads -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"personaKey":"the_front_desk"}' | jq -r .id)\",\"message\":\"Add to my list: call the lawyer tomorrow at 11am.\"}"
```
Then confirm the task exists AND a ping was scheduled for it (Supabase SQL):
```sql
select title, due_at from z.tasks where user_id='<YOUR_ID>' order by created_at desc limit 1;
select body, due_at from z.scheduled_pings where payload->>'kind'='task' order by created_at desc limit 1;
```

**3 · HANDOFF pre-seeds a room** — ask the desk to walk you somewhere:
```
curl -s -N -X POST https://z-production-c79a.up.railway.app/chat -H "authorization: Bearer $TOKEN" -H "content-type: application/json" -d "{\"threadId\":\"$(curl -s -X POST https://z-production-c79a.up.railway.app/threads -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"personaKey":"the_front_desk"}' | jq -r .id)\",\"message\":\"I want to plan a trip to Japan — take me to the Wanderer.\"}"
```
The stream ends with a door card (route). Then the Wanderer's thread has a fresh opening line from her, already about Japan:
```sql
select content from z.messages where thread_id=(select id from z.threads where user_id='<YOUR_ID>' and persona_key='the_wanderer' and is_group=false order by last_active desc limit 1) and role='assistant' order by created_at desc limit 1;
```

**On device:** the Desk's "tonight at the house" strip now shows your real state (trip/task/MM/coach/lead), each tapping through to the right room.

## NOTE
- ⚠ `src/index.ts` + `src/loop.ts` are shared with the other track — edits additive; `--3way`; reconcile if dirty before push.
- **Stylist gaps** deferred to Phase 4 (0054) — the brief's gap source is guarded and lights up automatically then.
- **HANDOFF opener** rides as the target persona's assistant-role greeting (a judgment call the spec left open) — if it reads oddly on device, the alternative is a client-prefilled composer; flag it.
- **Coach route** is `the_coach` (verified against personas.ts — the spec's "dean" is `the_coach`).
- **Pings dedup with the notes panel:** the brief deliberately omits raw pings (the desk's notes panel already surfaces them) to avoid double-showing.
- Next: **Phase 4 — Stylist outfits + gaps + retrieval fix (§3) + 0054**, which also lights up the brief's stylist line and the packing list (§4.4).
