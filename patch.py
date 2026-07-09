#!/usr/bin/env python3
# zip88 · DESK ROOMS Phase 1 — the Media Manager retention loop (§5.1–5.3 + 0056)
#
# Idempotent, anchor-verified. Applies zip88_mm_loop.patch via `git apply --3way`
# (a 3-way merge, so it survives small drift in the two SHARED files it touches —
# src/index.ts and src/loop.ts). Re-running is safe: if the loop is already in
# place it detects the marker and no-ops. Never blind-overwrites.
#
#   run from the repo root:  python3 patch.py
import os, sys, subprocess

PATCH = 'zip88_mm_loop.patch'
MARKER_FILE = 'src/index.ts'
MARKER = "/dev/mm/desknote"          # present only after this patch has applied
SENTINEL = 'migrations'              # repo-root sanity check

def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)

def die(msg):
    print("  \u2717 " + msg)
    sys.exit(1)

def main():
    # 0) repo-root sanity
    if not (os.path.isdir(SENTINEL) and os.path.isfile('src/index.ts')):
        die("run me from the repo root (need src/index.ts and migrations/).")
    if not os.path.isfile(PATCH):
        die(f"{PATCH} not found next to me — unzip the whole zip88 into the repo root first.")

    # 1) idempotency — already applied?
    with open(MARKER_FILE, encoding='utf-8') as f:
        if MARKER in f.read():
            print("  \u00b7 zip88 already applied (found the desk-note trigger) — nothing to do.")
            print("  \u00b7 migration: " + ("present" if os.path.isfile('migrations/0056_mm_loop.sql')
                                             else "MISSING \u2014 see APPLY_zip88.md, it is created by the patch"))
            return

    # 2) anchor verification — will it apply cleanly (3-way)?
    chk = sh('git', 'apply', '--3way', '--check', PATCH)
    if chk.returncode != 0:
        # a plain --check gives a cleaner error surface than the 3-way fallback noise
        plain = sh('git', 'apply', '--check', PATCH)
        print("  \u2717 the patch does not apply cleanly. git says:")
        print((plain.stderr or chk.stderr).rstrip())
        print("  \u2192 most likely a SHARED file (src/index.ts / src/loop.ts) drifted.")
        print("    `git pull --rebase` (or reconcile the other session), then re-run me.")
        sys.exit(1)

    # 3) apply for real
    ap = sh('git', 'apply', '--3way', PATCH)
    if ap.returncode != 0:
        print("  \u2717 apply failed after a clean check (unexpected):")
        print((ap.stderr or ap.stdout).rstrip())
        sys.exit(1)

    for path in ['migrations/0056_mm_loop.sql', 'src/mmDesk.ts', 'src/loop.ts',
                 'src/index.ts', 'app/api.js', 'app/MediaRoom.js']:
        print("  \u2713 " + path)
    print("\n  applied. next: apply migration 0056 in Supabase, then build + ship (see APPLY_zip88.md).")

if __name__ == '__main__':
    main()
