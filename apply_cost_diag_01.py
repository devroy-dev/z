#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  cost-diag zip 01 — the Battlefield cost tap (curl-verifiable, no migration)
#  Anchored, atomic, idempotent. Run from repo root: python3 apply_cost_diag_01.py
#  What it does:
#    1) src/usage.ts        — logUsage gains an optional `fn` tag, returns {inr},
#                             and pushes each call into an in-memory cost ring;
#                             adds costSnapshot()/costSince() helpers. (No DB change:
#                             `fn` is NOT written to usage_log — that column doesn't
#                             exist yet, so writing it would break every insert.)
#    2) src/battlefieldAdjudicator.ts — tag verdict call `bf_verdict`, note `bf_running_note`
#    3) src/games/battlefieldDuel.ts  — tag house turn `bf_house_turn`
#    4) src/index.ts        — /battlefield/test-duel snapshots the ring before the
#                             loop and echoes `cost` (total_inr + byFn) in its JSON.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

def patch(path, old, new, label):
    with io.open(path, 'r', encoding='utf-8') as f:
        src = f.read()
    if new in src:
        print(f"  = {label}: already applied (skip)")
        return src, False
    if old not in src:
        print(f"  ! {label}: ANCHOR NOT FOUND in {path} — aborting, nothing written")
        sys.exit(1)
    if src.count(old) != 1:
        print(f"  ! {label}: anchor appears {src.count(old)}× (need exactly 1) — aborting")
        sys.exit(1)
    src = src.replace(old, new, 1)
    with io.open(path, 'w', encoding='utf-8') as f:   # atomic-ish single write
        f.write(src)
    print(f"  + {label}: applied")
    return src, True

root = os.getcwd()
if not os.path.isdir(os.path.join(root, 'src')):
    print("Run from the repo root (no ./src here).")
    sys.exit(1)

# ── 1) src/usage.ts : ring + fn + return ────────────────────────────────
USAGE = 'src/usage.ts'
old_usage = """export function logUsage(args: {
  userId: string; threadId?: string | null; personaKey?: string | null;
  surface: 'chat' | 'group' | 'banter' | 'director' | 'seatbelt' | 'other';
  model: string; usage: Usage | any;
}) {
  try {
    const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);
    const { inr } = calcCostInr(args.model, u);
    void supabase.from('usage_log').insert({
      user_id: args.userId, thread_id: args.threadId ?? null, persona_key: args.personaKey ?? null,
      surface: args.surface, model: args.model,
      tok_in: u.in, tok_out: u.out, tok_cache_read: u.cacheRead, tok_cache_write: u.cacheWrite,
      cost_inr: inr,
    }).then(() => {});
  } catch (_) { /* the meter never breaks the machine */ }
}"""
new_usage = """// ── the diagnostic cost ring (founder-only). usage_log stays the source of
// truth; this bounded in-memory ring lets an endpoint sum the cost of a single
// run (a whole duel, a session) by snapshotting before and diffing after.
export type CostEntry = {
  ts: number; userId: string; personaKey: string | null; surface: string;
  fn: string | null; model: string; usage: Usage; inr: number;
};
const RING_MAX = 1000;
export const recentUsage: CostEntry[] = [];
export function costSnapshot(): number { return recentUsage.length; }
export function costSince(startLen: number): {
  total_inr: number; calls: number; byFn: Record<string, { inr: number; calls: number }>;
} {
  const slice = recentUsage.slice(Math.max(0, startLen));
  const byFn: Record<string, { inr: number; calls: number }> = {};
  let total = 0;
  for (const e of slice) {
    total += e.inr;
    const k = e.fn || e.surface || 'other';
    (byFn[k] ||= { inr: 0, calls: 0 });
    byFn[k].inr = Math.round((byFn[k].inr + e.inr) * 10000) / 10000;
    byFn[k].calls += 1;
  }
  return { total_inr: Math.round(total * 10000) / 10000, calls: slice.length, byFn };
}

export function logUsage(args: {
  userId: string; threadId?: string | null; personaKey?: string | null;
  surface: 'chat' | 'group' | 'banter' | 'director' | 'seatbelt' | 'other';
  fn?: string | null;
  model: string; usage: Usage | any;
}): { inr: number } {
  try {
    const u: Usage = 'in' in (args.usage ?? {}) ? args.usage : usageFromApi(args.usage);
    const { inr } = calcCostInr(args.model, u);
    // the diagnostic ring (bounded; fn is ring-only for now — no DB column yet)
    recentUsage.push({
      ts: Date.now(), userId: args.userId, personaKey: args.personaKey ?? null,
      surface: args.surface, fn: args.fn ?? null, model: args.model, usage: u, inr,
    });
    if (recentUsage.length > RING_MAX) recentUsage.splice(0, recentUsage.length - RING_MAX);
    void supabase.from('usage_log').insert({
      user_id: args.userId, thread_id: args.threadId ?? null, persona_key: args.personaKey ?? null,
      surface: args.surface, model: args.model,
      tok_in: u.in, tok_out: u.out, tok_cache_read: u.cacheRead, tok_cache_write: u.cacheWrite,
      cost_inr: inr,
    }).then(() => {});
    return { inr };
  } catch (_) { return { inr: 0 }; }  /* the meter never breaks the machine */
}"""
patch(USAGE, old_usage, new_usage, "usage.ts logUsage+ring")

# ── 2) src/battlefieldAdjudicator.ts : verdict + note tags ───────────────
ADJ = 'src/battlefieldAdjudicator.ts'
patch(ADJ,
      "    logUsage({ userId, surface: 'other', model: MODEL, usage: msg.usage });",
      "    logUsage({ userId, surface: 'other', fn: 'bf_verdict', model: MODEL, usage: msg.usage });",
      "adjudicator verdict tag")
patch(ADJ,
      "    logUsage({ userId: 'battlefield', surface: 'other', model: MODEL, usage: (msg as any).usage });",
      "    logUsage({ userId: 'battlefield', surface: 'other', fn: 'bf_running_note', model: MODEL, usage: (msg as any).usage });",
      "adjudicator running-note tag")

# ── 3) src/games/battlefieldDuel.ts : house turn tag ────────────────────
DUEL = 'src/games/battlefieldDuel.ts'
patch(DUEL,
      "    logUsage({ userId: 'battlefield', surface: 'other', model: MODEL, usage: msg.usage });",
      "    logUsage({ userId: 'battlefield', surface: 'other', fn: 'bf_house_turn', model: MODEL, usage: msg.usage });",
      "duel house-turn tag")

# ── 4) src/index.ts : import + snapshot + echo cost ─────────────────────
IDX = 'src/index.ts'
patch(IDX,
      "import { logUsage } from './usage.js';",
      "import { logUsage, costSnapshot, costSince } from './usage.js';",
      "index.ts usage import")
patch(IDX,
      "    const steps: any[] = [];\n    let myIdx = 0; let guard = 0;",
      "    const steps: any[] = [];\n    const costStart = costSnapshot();\n    let myIdx = 0; let guard = 0;",
      "index.ts cost snapshot")
patch(IDX,
      "      verdict: state.verdict ? { winner: state.verdict.winner, summary: state.verdict.summary, matter: state.verdict.matter, manner: state.verdict.manner } : null,\n      steps,\n    });",
      "      verdict: state.verdict ? { winner: state.verdict.winner, summary: state.verdict.summary, matter: state.verdict.matter, manner: state.verdict.manner } : null,\n      steps,\n      cost: costSince(costStart),\n    });",
      "index.ts cost echo")

print("\nDone. Next: npm run build  →  commit/push  →  Railway  →  curl the test-duel (see README).")
