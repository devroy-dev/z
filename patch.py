#!/usr/bin/env python3
# zip93 · DESK ROOMS Phase 4b — TRAVEL DESK COMPLETION (§4.4-4.6). The packing list
# (Wanderer × Stylist, from what they own → feeds wardrobe_gaps), in-trip mode (the
# live card flips to "day N — today's title"), and [[ITINERARY]]/[[CHECK]] tags so
# conversation keeps the plan current. APPLY AFTER zip92 (needs the 0054 wardrobe_gaps).
#   run from the repo root:  python3 patch93.py
import os, sys, subprocess
PATCH='zip93_travel.patch'; MARKER_FILE='src/index.ts'; MARKER='trips/:id/packlist'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip93 into the repo root first.")
    txt = open(MARKER_FILE, encoding='utf-8').read()
    if MARKER in txt:
        print("  \u00b7 zip93 already applied (found the packlist route) — nothing to do."); return
    if '/stylist/gaps/run' not in txt:
        die("zip92 is NOT applied yet. Apply zip92 (stylist + migration 0054) FIRST, then run me.")
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 make sure zip92 is applied and the tree is clean; git pull --rebase if needed."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['src/wanderer.ts','src/index.ts','src/loop.ts','app/api.js','app/TravelDesk.js']:
        print("  \u2713 "+p)
    print("\n  applied on top of zip92. No new migration. build + ship (push) + eas update from app/.")
if __name__ == '__main__': main()
