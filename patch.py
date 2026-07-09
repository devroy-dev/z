#!/usr/bin/env python3
# zip92 · DESK ROOMS Phase 4a — THE STYLIST ACTS (§3 + migration 0054). Outfits as
# filed objects ([[OUTFIT]] tag), the stored gap report (Haiku+search audit),
# relevance retrieval (counts + up to 40 by keyword), wear tracking. Also fixes the
# desk brief's stylist line (status/route) + word-boundary trim.
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip92_stylist.patch'; MARKER_FILE='src/index.ts'; MARKER='/stylist/gaps/run'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip92 into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip92 already applied (found /stylist/gaps/run) — nothing to do.")
            print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0054_stylist_outfits_gaps.sql') else "MISSING (created by the patch)")); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 SHARED files (src/index.ts, src/loop.ts) may have drifted. git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['migrations/0054_stylist_outfits_gaps.sql','src/stylist.ts','src/index.ts','src/loop.ts','src/deskBrief.ts','app/api.js','app/StylistRoom.js']:
        print("  \u2713 "+p)
    print("\n  applied. apply migration 0054 in Supabase, then build + ship (push) + eas update from app/. Then zip93 (travel).")
if __name__ == '__main__': main()
