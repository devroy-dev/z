#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  cost-diag zip 02 (transactional, self-healing) — run from repo root:
#      python3 apply_cost_diag_02.py
#  Base: bb715c9.  Validates EVERY anchor first; writes nothing unless all pass.
#
#  Does three things:
#   1) usage.ts — adds DIAG_USER_ID + diagEcho() (the founder-gated echo helper).
#   2) tags every remaining logUsage() with a fine `fn` (chat, banter, group,
#      gm_turn, morning_brief, seatbelt, fantasy, simfloor_*, followup, …).
#   3) index.ts — RESTORES slice-1's test-duel cost echo (zip65 reverted it),
#      logs the previously-unlogged main 1:1 chat turn (fn:'chat'), and echoes
#      { cost } on the chat SSE 'done' event ONLY for Dev's id (feeds the whisper).
#   4) usage.ts persists `fn` + adds GET /diagnostics/costs (founder-gated rollup
#      by fn/persona/day). REQUIRES migration 0036_usage_fn.sql to be run in Supabase
#      FIRST (adds the fn column) — else the persisted insert fails on the new column.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

edits = []  # (path, old, new, label, all, marker)

def E(path, old, new, label, all=False, marker=None):
    edits.append((path, old, new, label, all, marker))

def tag(path, old, fn, label, all=False):
    assert ", model:" in old, label
    E(path, old, old.replace(", model:", f", fn: '{fn}', model:", 1), label, all)

# ── 1) usage.ts : diagEcho + DIAG_USER_ID (append after costSince) ───────
E('src/usage.ts',
  "  return { total_inr: Math.round(total * 10000) / 10000, calls: slice.length, byFn };\n}",
  "  return { total_inr: Math.round(total * 10000) / 10000, calls: slice.length, byFn };\n}\n\n"
  "// the founder gate: cost is echoed to the client ONLY for Dev's id, so cost\n"
  "// data is never even sent to other accounts. The in-app whisper reads this.\n"
  "export const DIAG_USER_ID = 'd91a137e-46d4-4d85-91e4-6092007e8501';\n"
  "export function diagEcho(userId: string, args: { usage: Usage | any; model: string; fn: string }):\n"
  "  { cost_inr: number; fn: string; usage: Usage } | undefined {\n"
  "  if (userId !== DIAG_USER_ID) return undefined;\n"
  "  const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);\n"
  "  const { inr } = calcCostInr(args.model, u);\n"
  "  return { cost_inr: Math.round(inr * 10000) / 10000, fn: args.fn, usage: u };\n"
  "}",
  "usage.ts diagEcho + DIAG_USER_ID", marker="export function diagEcho")

# ── 2) fn tags on every remaining call site ─────────────────────────────
tag('src/morningBrief.ts', "logUsage({ userId, surface: 'other', model: MODEL, usage: (msg as any).usage });", 'morning_brief', "morningBrief")
tag('src/seatbelt.ts', "logUsage({ userId: ctx.userId, personaKey: ctx.personaKey, surface: 'seatbelt', model: SEATBELT_MODEL, usage: (msg as any).usage });", 'seatbelt', "seatbelt")
tag('src/index.ts', "logUsage({ userId: user.id, personaKey: persona, surface: 'banter', model: 'claude-haiku-4-5-20251001', usage: (final as any).usage });", 'banter', "index banter")
tag('src/eveningProgramme.ts', "logUsage({ userId, surface: 'other', model: MODEL, usage: (msg as any).usage });", 'evening_programme', "eveningProgramme")
tag('src/fantasyLeague.ts', "logUsage({ userId, personaKey: 'the_wannabe', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'fantasy', "fantasyLeague")
tag('src/simFloor.ts', "logUsage({ userId, personaKey: 'the_economist', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'simfloor_money_man', "simFloor money_man")
tag('src/simFloor.ts', "logUsage({ userId: 'sim-oracle', personaKey: 'the_oracle', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'simfloor_oracle', "simFloor oracle")
tag('src/grandMaster.ts', "logUsage({ userId, surface: 'other', model: MODEL, usage: msg.usage });", 'gm_turn', "grandMaster")
tag('src/followups.ts', "logUsage({ userId, surface: 'other', model: MODEL, usage: (msg as any).usage });", 'followup', "followups (both)", all=True)
tag('src/customPersonas.ts', "logUsage({ userId, surface: 'seatbelt', model: MODEL, usage: (msg as any).usage });", 'custom_persona_seatbelt', "customPersonas seatbelt")
tag('src/customPersonas.ts', "logUsage({ userId, surface: 'other', model: MODEL, usage: (msg as any).usage });", 'custom_persona_build', "customPersonas build")
tag('src/bulletin.ts', "logUsage({ userId: 'bulletin', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'bulletin', "bulletin")
tag('src/groupLoop.ts', "logUsage({ userId, threadId, personaKey: key, surface: 'group', model: MODEL, usage: (final as any).usage });", 'group_turn', "groupLoop")
tag('src/games/triviaDuel.ts', "logUsage({ userId: 'trivia-duel', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'trivia_duel', "triviaDuel")
tag('src/games/debateDuel.ts', "logUsage({ userId: 'duel', surface: 'other', model: MODEL, usage: (msg as any).usage });", 'arena_debate_duel', "debateDuel (both)", all=True)

# ── 3) index.ts : import, restore test-duel echo, log+echo main chat ─────
E('src/index.ts',
  "import { logUsage } from './usage.js';",
  "import { logUsage, costSnapshot, costSince, diagEcho, DIAG_USER_ID } from './usage.js';",
  "index import")
# persist fn now that migration 0036 adds the column (run the SQL FIRST — see README)
E('src/usage.ts',
  "      surface: args.surface, model: args.model,\n      tok_in: u.in,",
  "      surface: args.surface, fn: args.fn ?? null, model: args.model,\n      tok_in: u.in,",
  "usage.ts persist fn")
# the founder cost dashboard: rollup over usage_log by fn / persona / day
E('src/index.ts',
  "app.post('/battlefield/test-duel', async (req, res) => {",
  "app.get('/diagnostics/costs', async (req, res) => {\n"
  "  try {\n"
  "    const authId = await authUser(req);\n"
  "    const user = await resolveUser(authId);\n"
  "    if (!user || user.id !== DIAG_USER_ID) return res.status(403).json({ error: 'nope' });\n"
  "    const days = Math.max(1, Math.min(90, parseInt(String(req.query.days ?? '7'), 10) || 7));\n"
  "    const since = new Date(Date.now() - days * 864e5).toISOString();\n"
  "    const { data, error } = await supabase.from('usage_log')\n"
  "      .select('fn, surface, persona_key, user_id, cost_inr, created_at')\n"
  "      .gte('created_at', since).limit(100000);\n"
  "    if (error) return res.status(500).json({ error: error.message });\n"
  "    const rows: any[] = data || [];\n"
  "    const byFn: Record<string, { inr: number; calls: number }> = {};\n"
  "    const byPersona: Record<string, { inr: number; calls: number }> = {};\n"
  "    const byDay: Record<string, number> = {};\n"
  "    const users = new Set<string>();\n"
  "    let total = 0;\n"
  "    for (const r of rows) {\n"
  "      const inr = Number(r.cost_inr) || 0; total += inr; if (r.user_id) users.add(r.user_id);\n"
  "      const fk = r.fn || r.surface || 'other';\n"
  "      (byFn[fk] ||= { inr: 0, calls: 0 }); byFn[fk].inr += inr; byFn[fk].calls += 1;\n"
  "      const pk = r.persona_key || '\\u2014';\n"
  "      (byPersona[pk] ||= { inr: 0, calls: 0 }); byPersona[pk].inr += inr; byPersona[pk].calls += 1;\n"
  "      const day = String(r.created_at).slice(0, 10); byDay[day] = (byDay[day] || 0) + inr;\n"
  "    }\n"
  "    const r4 = (n: number) => Math.round(n * 10000) / 10000;\n"
  "    for (const k in byFn) byFn[k].inr = r4(byFn[k].inr);\n"
  "    for (const k in byPersona) byPersona[k].inr = r4(byPersona[k].inr);\n"
  "    for (const k in byDay) byDay[k] = r4(byDay[k]);\n"
  "    const active = users.size;\n"
  "    res.json({ days, rows: rows.length, total_inr: r4(total), active_users: active,\n"
  "      cost_per_active_user_inr: active ? r4(total / active) : 0, byFn, byPersona, byDay });\n"
  "  } catch (e: any) { res.status(500).json({ error: String(e?.message || e) }); }\n"
  "});\n\n"
  "app.post('/battlefield/test-duel', async (req, res) => {",
  "index /diagnostics/costs endpoint", marker="'/diagnostics/costs'")
E('src/index.ts',
  "    const steps: any[] = [];\n    let myIdx = 0; let guard = 0;",
  "    const steps: any[] = [];\n    const costStart = costSnapshot();\n    let myIdx = 0; let guard = 0;",
  "index test-duel snapshot (restore)")
E('src/index.ts',
  "      verdict: state.verdict ? { winner: state.verdict.winner, summary: state.verdict.summary, matter: state.verdict.matter, manner: state.verdict.manner } : null,\n      steps,\n    });",
  "      verdict: state.verdict ? { winner: state.verdict.winner, summary: state.verdict.summary, matter: state.verdict.matter, manner: state.verdict.manner } : null,\n      steps,\n      cost: costSince(costStart),\n    });",
  "index test-duel echo (restore)")
E('src/index.ts',
  "      res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\\n\\n`);",
  "      logUsage({ userId: user.id, threadId, surface: 'chat', fn: 'chat', model: 'claude-haiku-4-5-20251001', usage: result.usage });\n"
  "      const _diag = diagEcho(user.id, { usage: result.usage, model: 'claude-haiku-4-5-20251001', fn: 'chat' });\n"
  "      res.write(`data: ${JSON.stringify({ done: true, usage: result.usage, ...(_diag ? { cost: _diag } : {}) })}\\n\\n`);",
  "index main-chat log + gated echo")

# ── validate ALL, then write ALL (transactional) ────────────────────────
root = os.getcwd()
if not os.path.isdir(os.path.join(root, 'src')):
    print("Run from the repo root (no ./src here)."); sys.exit(1)

cache = {}
def load(p):
    if p not in cache:
        with io.open(p, 'r', encoding='utf-8') as f: cache[p] = f.read()
    return cache[p]

skipped, planned = [], []
for (path, old, new, label, all, marker) in edits:
    src = load(path)
    if marker and marker in src:
        skipped.append(label); continue
    if new in src and (all or src.count(old) == 0):
        skipped.append(label); continue
    n = src.count(old)
    if n == 0:
        print(f"  ! {label}: ANCHOR NOT FOUND in {path} — ABORT (no files written)"); sys.exit(1)
    if not all and n != 1:
        print(f"  ! {label}: anchor appears {n}x (need 1) — ABORT (no files written)"); sys.exit(1)
    cache[path] = src.replace(old, new)
    planned.append((label, n))

for p, content in cache.items():
    with io.open(p, 'w', encoding='utf-8') as f: f.write(content)

for (label, n) in planned: print(f"  + {label} ({n} site{'s' if n != 1 else ''})")
for label in skipped:      print(f"  = {label} (already applied)")
print(f"\nStaged {len(planned)} edit(s), skipped {len(skipped)}. Now: npm run build -> commit/push -> Railway.")
