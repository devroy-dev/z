# zip89d · RECOVERY — src/wanderer.ts had conflict markers committed

**What happened:** zip89c's patch was generated without re-syncing after zip89b, so it carried zip89b's hunks too. Your repo already had zip89b, so `git apply --3way` wrote conflict markers into `src/wanderer.ts`, and the chained `commit && push` shipped the broken file (b749db3). Railway won't deploy a failing build, so the **live engine is still the last-good zip89b** — but HEAD is broken until this lands. My mistake; this restores the correct end-state.

**This ships the full, verified `src/wanderer.ts`** (max_tokens 3000, empty-build guard, `<cite>` strip, no `_debug`) and overwrites the conflicted file. Single wanderer-owned file — a full replace is the safe fix.

## APPLY + SHIP
```
cd /workspaces/z
git pull --rebase                 # get b749db3 locally first
unzip -o zip89d.zip -d .
python3 patch.py                  # ✓ src/wanderer.ts restored
grep -c '<<<<<<<' src/wanderer.ts # must print 0
npx tsc --noEmit                  # must be clean
git add -A && git commit -m "recover: restore clean src/wanderer.ts (zip89b+zip89c end-state) (zip89d)"
git push                          # Railway rebuilds green
```

## VERIFY (after redeploy)
```
curl -s https://z-production-c79a.up.railway.app/wanderer/trips -H "authorization: Bearer $TOKEN" | jq '.trips|length'
```
Any 200 with a number = the engine is healthy again. Then resume the Sri Lanka cycle.

## NOTE
Going forward I will re-sync (`reset --hard origin/main`) before cutting every zip, and commit each hotfix before the next — the cumulative-diff collision that caused this won't recur.
