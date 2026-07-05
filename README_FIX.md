# cost-diag 02 — build FIX (apply on top of commit ad34ff3)

Your `npm run build` failed with:
    src/index.ts:1355 - TS2345: Argument of type 'string | null' is not assignable to 'string'.
Cause: the new `/diagnostics/costs` endpoint called `resolveUser(authId)` without the
`if (!authId) return 401` guard that every other endpoint has, so `authId` stayed `string | null`.
(My earlier pre-check was syntax-only and didn't type-check; now verified with real `tsc`.)

## Apply (repo root)
    unzip -o cost-diag-02-fix.zip
    python3 apply_cost_diag_02_fix.py
    npm run build            # now passes clean (verified: tsc --noEmit → 0 errors, dist emitted)
    git add -A && git commit -m "cost-diag 02 fix: auth guard on /diagnostics/costs" && git push
