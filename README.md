# cost-diag zip 02 — the full cost layer (fn tags · main-chat log · whisper echo · dashboard)

Base: bb715c9. Completes the cost-diagnostic work. The patcher is transactional
(validates every anchor first; writes nothing unless all pass) and idempotent.

## What it does (22 edits, 14 files + 1 migration)
- Tags EVERY `logUsage()` call with a fine `fn` — chat, banter, group_turn, gm_turn,
  morning_brief, seatbelt, fantasy, simfloor_money_man, simfloor_oracle, followup,
  bulletin, trivia_duel, arena_debate_duel, custom_persona_* (bf_* were done in zip 01).
- Logs the MAIN 1:1 chat turn — it was returning usage but never hitting `logUsage`
  (your highest-volume function was missing from the ledger). Now `fn:'chat'`.
- Gated whisper echo: the chat SSE `done` event now carries `{ cost: {cost_inr,fn,usage} }`
  ONLY for Dev's id (`diagEcho` in usage.ts) — cost data isn't even sent to other accounts.
- RESTORES slice-1's `/battlefield/test-duel` cost echo, which **zip65 silently reverted**
  (parallel index.ts edit — the collision your notes warn about). Re-curl will show `cost` again.
- Persists `fn` to `usage_log` + adds `GET /diagnostics/costs` (founder-gated rollup by fn/persona/day).

## APPLY — order matters (migration FIRST)
    # 1. run the migration in Supabase SQL editor (adds the fn column) — BEFORE the code deploys,
    #    or the persisted insert fails on a missing column:
    #    → paste 0036_usage_fn.sql into Supabase SQL editor and run it.
    cp 0036_usage_fn.sql migrations/         # keep it in the repo record too
    python3 apply_cost_diag_02.py            # transactional, idempotent
    npm run build                            # the gate (types); syntax pre-checked, all clean
    git status --short
    git add -A && git commit -m "cost-diag 02: fn tags + chat log + whisper echo + dashboard" && git push
    # confirm Railway's deployed hash == git log before testing.

## Verify
1. **test-duel** (restored): re-run your sanctions curl → `cost` block is back.
2. **the whisper**: send a normal 1:1 chat message as your account; the SSE `done` frame now
   includes `cost: { cost_inr, fn:'chat', usage }`. (Other accounts: no `cost` field at all.)
3. **the dashboard** (needs YOUR auth token — 403 otherwise):
       curl -s "https://z-production-c79a.up.railway.app/diagnostics/costs?days=7" \
         -H "Authorization: Bearer <your-token>" | python3 -m json.tool
   → `{ total_inr, active_users, cost_per_active_user_inr, byFn{}, byPersona{}, byDay{} }`.

## Known gaps (by design, note for later)
- System calls with synthetic userIds (`battlefield`, `bulletin`, `trivia-duel`, `duel`,
  `sim-oracle`) fail the `usage_log.user_id → users(id)` FK and **do not persist** — they live
  only in the in-memory ring (per-process). So `/diagnostics/costs` reflects USER-attributed cost;
  system-function cost is measured via the ring / the test endpoints. Fixing that = a later schema
  change (nullable user_id or a separate system_usage table). Not needed now.
- `fn` is ring + DB from here on; back-rows before this deploy have `fn = null` (bucketed under `surface`).

## Next (when you want it)
- Group-room + banter responses could carry the same gated `cost` echo (same `diagEcho` helper) if
  you want the whisper in rooms too — small follow-on.
