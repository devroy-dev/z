#!/usr/bin/env python3
# zip89b · HOTFIX — trip /build was flipping status to 'planned' on an empty parse.
# Now: bail (stay 'dreaming') when no real itinerary parsed + return the raw model
# output so a failure is visible; raise max_tokens 1600->3000. One file: src/wanderer.ts
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip89b_build_fix.patch'; MARKER_FILE='src/wanderer.ts'; MARKER='built: false'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not os.path.isfile('src/wanderer.ts'): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip89b into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip89b already applied — nothing to do."); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    print("  \u2713 src/wanderer.ts")
    print("\n  applied. build + ship (git push; Railway rebuilds). No migration, no OTA — engine only.")
if __name__ == '__main__': main()
