#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip87 · public rooms ALWAYS open in CuratedRoomScreen
#  Bug: a public room with no resident (personas:[]) — e.g. a user-created
#  room like "Delhi foodies" — failed the persona check and opened in
#  DMScreen, which has no member sheet / no delete. Fix: route by
#  publicRoomId first, so every public room lands on the screen that has
#  the sheet + flat feed. DMs and curated rooms unchanged.
#  Client-only, OTA-safe. ⚠ touches Nav.js (shared) — rebase if dirty.
#  Run from repo root:  python3 patch.py   · idempotent · anchor-asserted
# ════════════════════════════════════════════════════════════════════════
import os, sys, tempfile

REPO = os.getcwd()

def die(m): print("  ✗ " + m); sys.exit(1)
def read(p):
    with open(p, "r", encoding="utf-8") as f: return f.read()
def atomic_write(p, text):
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(p))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
        os.replace(tmp, p)
    except Exception:
        if os.path.exists(tmp): os.remove(tmp)
        raise

def patch_file(rel, edits):
    p = os.path.join(REPO, rel)
    if not os.path.exists(p): die("missing " + rel + " — run from repo root")
    src = read(p); changed = False
    for name, anchor, repl, marker in edits:
        if marker in src:
            print("  · " + name + " already applied — skip"); continue
        c = src.count(anchor)
        if c == 0: die(name + " — anchor NOT FOUND (tree drifted?)")
        if c > 1: die(name + " — anchor matched " + str(c) + "× (ambiguous)")
        src = src.replace(anchor, repl, 1); changed = True
        print("  ✓ " + name)
    if changed: atomic_write(p, src)

EDITS = [
    (
        "route public rooms by publicRoomId",
        "          ((chatOpen.room?.personas && chatOpen.room.personas.length) || chatOpen.room?.persona)",
        "          (chatOpen.room?.publicRoomId || (chatOpen.room?.personas && chatOpen.room.personas.length) || chatOpen.room?.persona)",
        "chatOpen.room?.publicRoomId ||",
    ),
]

def main():
    print("── zip87 · public rooms always open in CuratedRoomScreen ──")
    patch_file("app/Nav.js", EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
