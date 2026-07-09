#!/usr/bin/env python3
# zip89c · cleanup — strip inline web-search <cite> markup from the Wanderer's
# spoken trip summary; remove the _debug field now that /build is proven.
# One file: src/wanderer.ts. Engine only — no migration, no OTA.
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip89c_cite_cleanup.patch'; MARKER_FILE='src/wanderer.ts'; MARKER='<\\/?cite'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not os.path.isfile('src/wanderer.ts'): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip89c into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if 'cite[^>]' in f.read():
            print("  \u00b7 zip89c already applied — nothing to do."); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    print("  \u2713 src/wanderer.ts")
    print("\n  applied. git push; Railway rebuilds. No migration, no OTA.")
if __name__ == '__main__': main()
