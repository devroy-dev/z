#!/usr/bin/env python3
# zip91 · DESK ROOMS Phase 3 — the Host becomes the aggregation + dispatch layer
# (§2.2 A–D + migration 0058). GET /desk/brief (real house state, model-free), the
# marquee reads it instead of Math.random(), the front-desk block speaks it, and two
# new verbs: tasks-that-knock (TASK_ADD schedules a ping when due) + [[HANDOFF]].
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip91_desk_brief.patch'; MARKER_FILE='src/index.ts'; MARKER='/desk/brief'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip91 into the repo root first.")
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip91 already applied (found /desk/brief) — nothing to do.")
            print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0058_desk_dispatch.sql') else "MISSING (created by the patch)")); return
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 SHARED files (src/index.ts, src/loop.ts) may have drifted. git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['migrations/0058_desk_dispatch.sql','src/deskBrief.ts','src/index.ts','src/loop.ts','app/api.js','app/Desk.js']:
        print("  \u2713 "+p)
    print("\n  applied. apply migration 0058 in Supabase, then build + ship (push) + eas update from app/.")
if __name__ == '__main__': main()
