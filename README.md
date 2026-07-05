# cost-diag zip 01 — the Battlefield cost tap

First slice of the cost-diagnostics layer. Migration-free, curl-verifiable, server-only.
No UI, no DB change — proves the metering pattern on the fattest function (a full duel).

## What it changes (4 files, 8 anchored edits)
- `src/usage.ts` — `logUsage` gains an optional `fn` tag, returns `{ inr }`, and pushes
  every call into a bounded in-memory cost ring. Adds `costSnapshot()` / `costSince()`.
  `fn` is ring-only for now — NOT written to `usage_log` (that column doesn't exist yet;
  writing it would break every insert). Persisting `fn` + the dashboard = next slice (needs a migration).
- `src/battlefieldAdjudicator.ts` — tags the verdict call `bf_verdict`, the note `bf_running_note`.
- `src/games/battlefieldDuel.ts` — tags the house turn `bf_house_turn`.
- `src/index.ts` — `/battlefield/test-duel` snapshots the ring before the loop and echoes
  a `cost` object in its JSON.

## Apply (from repo root, /workspaces/z)
    python3 apply_cost_diag_01.py     # anchored, atomic, idempotent (safe to re-run)
    npm run build                     # THE gate — real type-check (syntax was pre-checked, types weren't)
    git add -A && git commit -m "cost-diag 01: battlefield cost tap" && git push
    # Railway auto-builds. Confirm the deployed commit hash matches git log before testing.

## Verify (same test-duel curl you already run — now with cost)
Re-run your sanctions curl. The response now ends with:

    "cost": {
      "total_inr": 0.51,
      "calls": 8,
      "byFn": {
        "bf_house_turn":   { "inr": 0.32, "calls": 5 },
        "bf_running_note": { "inr": 0.04, "calls": 2 },
        "bf_verdict":      { "inr": 0.15, "calls": 1 }
      }
    }

(Illustrative numbers.) That tells you what one full duel costs and where the money goes —
house turns vs the running commentary vs the verdict. If `total_inr` is 0 or `calls` is 0,
the ring isn't seeing the calls — check the deployed hash.

## Notes
- The ring is per-process and bounded (1000). Fine for a single-user curl diagnostic; not a ledger.
- `usage_log` still records everything exactly as before (untouched insert).
- Next slices: (2) add an `fn` column + `/diagnostics/costs` aggregation for the dashboard;
  (3) echo `{cost_inr, usage, fn}` on the persona chat responses, gated to Dev's ID, for the in-app whisper.
