#!/usr/bin/env python3
# zip89 · DESK ROOMS Phase 2 — Trip v2: states, /build endpoint, the clock (§4.1–4.3 + 0055)
#
# Idempotent, anchor-verified. Applies zip89_trip_v2.patch via `git apply --3way`
# (survives small drift in the two SHARED files it touches — src/index.ts,
# src/loop.ts). Re-running is safe: detects the marker and no-ops. Never
# blind-overwrites.
#
#   run from the repo root:  python3 patch.py
import os, sys, subprocess

PATCH = 'zip89_trip_v2.patch'
MARKER_FILE = 'src/index.ts'
MARKER = "/wanderer/trips/:id/build"     # present only after this patch has applied
SENTINEL = 'migrations'

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def die(msg):
    print("  \u2717 " + msg)
    sys.exit(1)

def main():
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')):
        die("run me from the repo root (need src/index.ts and migrations/).")
    if not os.path.isfile(PATCH):
        die(f"{PATCH} not found next to me — unzip the whole zip89 into the repo root first.")

    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip89 already applied (found the /build route) — nothing to do.")
            print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0055_trip_files_v2.sql')
                                             else "MISSING \u2014 it is created by the patch; see APPLY_zip89.md"))
            return

    chk = sh('git', 'apply', '--3way', '--check', PATCH)
    if chk.returncode != 0:
        plain = sh('git', 'apply', '--check', PATCH)
        print("  \u2717 the patch does not apply cleanly. git says:")
        print((plain.stderr or chk.stderr).rstrip())
        print("  \u2192 most likely a SHARED file (src/index.ts / src/loop.ts) drifted.")
        print("    `git pull --rebase` (or reconcile the other session), then re-run me.")
        sys.exit(1)

    ap = sh('git', 'apply', '--3way', PATCH)
    if ap.returncode != 0:
        print("  \u2717 apply failed after a clean check (unexpected):")
        print((ap.stderr or ap.stdout).rstrip())
        sys.exit(1)

    for path in ['migrations/0055_trip_files_v2.sql', 'src/wanderer.ts', 'src/loop.ts',
                 'src/index.ts', 'app/api.js', 'app/TravelDesk.js']:
        print("  \u2713 " + path)
    print("\n  applied. next: apply migration 0055 in Supabase, then build + ship (see APPLY_zip89.md).")

if __name__ == '__main__':
    main()
