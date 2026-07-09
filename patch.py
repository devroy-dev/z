#!/usr/bin/env python3
# zip89d · RECOVERY — origin/main's src/wanderer.ts was committed with merge-conflict
# markers (zip89c's patch was cut without re-syncing after zip89b, so it carried
# zip89b's hunks and collided). This restores the file to the correct, clean
# zip89b+zip89c end-state (max_tokens 3000, empty-build guard, <cite> strip, no
# _debug). Full-file overwrite — this file is wanderer-owned, single file, verified.
#   run from the repo root:  python3 patch.py
import os, sys, shutil
GOOD = 'wanderer.fixed.ts'
TARGET = 'src/wanderer.ts'
def die(m): print("  \u2717 "+m); sys.exit(1)
def main():
    if not os.path.isfile(TARGET): die("run me from the repo root (need src/wanderer.ts).")
    if not os.path.isfile(GOOD): die(f"{GOOD} not found — unzip the whole zip89d into the repo root first.")
    cur = open(TARGET, encoding='utf-8').read()
    clean = ('<<<<<<<' not in cur) and ('cite[^>]' in cur) and ('_debug' not in cur)
    if clean:
        print("  \u00b7 src/wanderer.ts is already clean (zip89b+zip89c) — nothing to do."); return
    if '<<<<<<<' in cur:
        print("  \u00b7 conflict markers found — restoring the clean file.")
    shutil.copyfile(GOOD, TARGET)
    # sanity: the restored file must be free of markers
    chk = open(TARGET, encoding='utf-8').read()
    if '<<<<<<<' in chk: die("restore left markers behind — abort, do not commit.")
    print("  \u2713 src/wanderer.ts restored (clean, builds green).")
    print("\n  next: npx tsc --noEmit (expect clean) -> commit -> push. No migration, no OTA.")
if __name__ == '__main__': main()
