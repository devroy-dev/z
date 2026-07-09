#!/usr/bin/env python3
# zip94 · the WANDERER × STYLIST seam. Completes §4.4's dropped line (the T-3 ping
# now SURFACES the packlist instead of offering to build it) and delivers the agreed
# polish: gaps pinned to their trip (0054b), per-trip stylist cards, the Wanderer→
# Stylist handoff on the travel card, owned-vs-needed packing (real thumbnails), and
# the desk brief counting standing wardrobe gaps only.
#   run from the repo root:  python3 patch.py
import os, sys, subprocess
PATCH='zip94_gap_trip_seam.patch'; MARKER_FILE='src/wanderer.ts'; MARKER='gap_count'; SENTINEL='migrations'
def sh(*a): return subprocess.run(a, capture_output=True, text=True)
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/wanderer.ts')): die("run me from the repo root.")
    if not os.path.isfile(PATCH): die(f"{PATCH} not found — unzip the whole zip94 into the repo root first.")
    txt = open(MARKER_FILE, encoding='utf-8').read()
    if MARKER in txt:
        print("  \u00b7 zip94 already applied (found gap_count in wanderer) — nothing to do.")
        print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0054b_gap_trip_link.sql') else "MISSING (created by the patch)")); return
    if 'buildPacklist' not in txt:
        die("zip93 (the packlist) isn't in this tree. Apply zip92+zip93 first, then run me.")
    chk = sh('git','apply','--3way','--check',PATCH)
    if chk.returncode != 0:
        print("  \u2717 does not apply cleanly:"); print((sh('git','apply','--check',PATCH).stderr or chk.stderr).rstrip())
        print("  \u2192 SHARED files (wanderer.ts, deskBrief.ts, Nav.js) may have drifted. git pull --rebase, then re-run."); sys.exit(1)
    ap = sh('git','apply','--3way',PATCH)
    if ap.returncode != 0: print("  \u2717 apply failed:"); print((ap.stderr or ap.stdout).rstrip()); sys.exit(1)
    for p in ['migrations/0054b_gap_trip_link.sql','src/wanderer.ts','src/stylist.ts','src/deskBrief.ts','app/StylistRoom.js','app/TravelDesk.js','app/Nav.js']:
        print("  \u2713 "+p)
    print("\n  applied. apply migration 0054b in Supabase, then build + ship (push) + eas update from app/.")
if __name__ == '__main__': main()
