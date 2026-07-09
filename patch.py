#!/usr/bin/env python3
# zip90 · trip /build goes ASYNC — no more 24s synchronous hold (timeout-fragile).
# /build now flips the trip to 'planning', builds in the background, returns at once;
# the room polls until it lands. Also: web_search 3->2 (faster), stuck-'planning'
# recovery on read. Touches src/wanderer.ts, src/index.ts, app/TravelDesk.js.
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip90_async_build.patch'; MARKER_FILE='src/wanderer.ts'; MARKER='startTripBuild'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip90 into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip90 already applied (found startTripBuild) — nothing to do."); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 SHARED file (src/index.ts) may have drifted. git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['src/wanderer.ts','src/index.ts','app/TravelDesk.js']: print("  \u2713 "+p)
    print("\n  applied. build + ship (git push; Railway rebuilds) + eas update from app/. No migration.")
if __name__ == '__main__': main()
