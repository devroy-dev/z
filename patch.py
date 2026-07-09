#!/usr/bin/env python3
# zip95 · NEWSROOM Phase 5a — YOUR DESK (§6.1) + FACT-CHECK (§6.3) + migration 0057.
# The wire personalizes for free (follows → filtered RSS, no model billed); the
# fact-check desk cashes the room's tagline (paste a forward → stored verdict card).
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip95_news_desk.patch'; MARKER_FILE='src/index.ts'; MARKER='/bulletin/factcheck'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip95 into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip95 already applied (found /bulletin/factcheck) — nothing to do.")
            print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0057_news_desk.sql') else "MISSING (created by the patch)")); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 SHARED file src/index.ts may have drifted. git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['migrations/0057_news_desk.sql','src/newsdesk.ts','src/index.ts','app/api.js','app/Bulletin.js']:
        print("  \u2713 "+p)
    print("\n  applied. apply migration 0057 in Supabase, then build + ship (push) + eas update from app/. Then zip96 (story tracking).")
if __name__ == '__main__': main()
