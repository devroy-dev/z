#!/usr/bin/env python3
# apply_coach_hub.py — Coaching-hub pass. Run from repo root (/workspaces/z) AFTER
# unzipping coach-hub-02.zip here. Does three things:
#   1. replaces app/Coach.js (ask-the-coach fix + hub rename)
#   2. patches the ChatHome entry row: "the Coach" -> "the Coaching hub" + hub image
#   3. the two face images unzip straight into public/faces/ (no action needed here)
# Idempotent, anchored, backs up before writing. Aborts on any anchor miss.
import os, sys, shutil, tempfile

def die(m): print("ABORT:", m); sys.exit(1)
def write_atomic(path, text):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)

if not os.path.isdir("app"): die("no ./app — run from repo root (/workspaces/z).")

# ── 1. Coach.js full replace ──────────────────────────────────────────
SRC, DST = "Coach.js", os.path.join("app", "Coach.js")
if not os.path.isfile(SRC): die("Coach.js missing in root — unzip the zip here first.")
new = open(SRC, encoding="utf-8").read()
if "THE COACHING HUB" not in new or "setStage('ask')" not in new:
    die("source Coach.js isn't the hub build (anchor check failed).")
if os.path.isfile(DST):
    old = open(DST, encoding="utf-8").read()
    if old != new:
        if not os.path.exists(DST + ".bak"): shutil.copy2(DST, DST + ".bak")
        write_atomic(DST, new); print(f"Coach.js  -> replaced ({new.count(chr(10))+1} lines)")
    else: print("Coach.js  -> already current")
else: die("app/Coach.js not found.")

# ── 2. ChatHome.js row patch (3 unique, anchored replacements) ─────────
CH = os.path.join("app", "ChatHome.js")
if not os.path.isfile(CH): die("app/ChatHome.js not found.")
txt = open(CH, encoding="utf-8").read()
edits = [
    ("the_coach.jpg?v=4", "the_coaching_hub.jpg?v=5"),
    ('name="the Coach"', 'name="the Coaching hub"'),
    ('line="name an exam \u2014 a plan, daily lessons, quizzes, mocks."',
     'line="name an exam or subject \u2014 plans, lessons, quizzes, mocks."'),
]
already = all(b in txt for _, b in edits) and all(a not in txt for a, _ in edits)
if already:
    print("ChatHome  -> already current")
else:
    for a, b in edits:
        n = txt.count(a)
        if n == 0 and b in txt: continue          # this edit already applied
        if n != 1: die(f"ChatHome anchor '{a[:40]}...' found {n}x (expected 1). Not patching.")
        txt = txt.replace(a, b)
    if not os.path.exists(CH + ".bak"): shutil.copy2(CH, CH + ".bak")
    write_atomic(CH, txt); print("ChatHome  -> row renamed to 'the Coaching hub' + hub image")

# ── 3. images ─────────────────────────────────────────────────────────
for f in ("the_coach.jpg", "the_coaching_hub.jpg"):
    p = os.path.join("public", "faces", f)
    print(f"face      -> {'present' if os.path.isfile(p) else 'MISSING'}: {p}")
print("done.")
