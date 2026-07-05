#!/usr/bin/env python3
# apply_coach_hub3.py — the corrected Coaching-hub pass (supersedes hub-02).
# Run from repo root (/workspaces/z) AFTER unzipping coach-hub-03.zip here.
#   1. app/Coach.js       -> replaced (redesign + "Coaching hub" rename; ask -> onAskCoach chat)
#   2. app/Chat.js        -> registers the_coach in the client PERSONAS map (THE brother-bug fix)
#   3. app/Nav.js         -> ask-the-coach/anchor tag origin; back returns to the hub/newsroom (button + gesture)
#   4. app/ChatHome.js    -> entry row renamed to "the Coaching hub" + hub image
#   5. public/faces/*     -> the_coach.jpg (persona) + the_coaching_hub.jpg (room) unzip into place
# Anchored, idempotent, backs up each file before writing.
import os, sys, shutil, tempfile

def die(m): print("ABORT:", m); sys.exit(1)
def backup(p):
    if not os.path.exists(p + ".bak"): shutil.copy2(p, p + ".bak")
def write_atomic(path, text):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)
def patch(path, edits):
    # edits: list of (old, new). Skips any edit whose `new` is already present.
    if not os.path.isfile(path): die(f"{path} not found.")
    txt = open(path, encoding="utf-8").read(); orig = txt
    for old, new in edits:
        if new in txt:  # already applied
            continue
        n = txt.count(old)
        if n != 1: die(f"{path}: anchor found {n}x (expected 1): {old[:55]}...")
        txt = txt.replace(old, new)
    if txt != orig:
        backup(path); write_atomic(path, txt); print(f"{os.path.basename(path):14s}-> patched")
    else:
        print(f"{os.path.basename(path):14s}-> already current")

if not os.path.isdir("app"): die("no ./app — run from repo root (/workspaces/z).")

# ── 1. Coach.js full replace ──────────────────────────────────────────
SRC, DST = "Coach.js", "app/Coach.js"
if not os.path.isfile(SRC): die("Coach.js missing in root — unzip the zip here first.")
new = open(SRC, encoding="utf-8").read()
if "THE COACHING HUB" not in new or "onPress={onAskCoach}" not in new:
    die("source Coach.js isn't the hub-03 build (anchor check failed).")
cur = open(DST, encoding="utf-8").read() if os.path.isfile(DST) else ""
if cur != new:
    if os.path.isfile(DST): backup(DST)
    write_atomic(DST, new); print(f"Coach.js      -> replaced ({new.count(chr(10))+1} lines)")
else:
    print("Coach.js      -> already current")

# ── 2. Chat.js — register the_coach in the client PERSONAS map ────────
GM = "  the_grandmaster:{name:'the Grand Master',desc:\"come empty-handed. leave understanding what the world runs on.\",rgb:'198,168,120'},"
COACH = "\n  the_coach:{name:'the coach',desc:\"name a subject. i'll build the road and walk it with you.\",rgb:'231,176,122'},"
patch("app/Chat.js", [(GM, GM + COACH)])

# ── 3. Nav.js — origin-tagged back for coach->hub and anchor->newsroom ─
patch("app/Nav.js", [
  ("useBackLayer(!!chatOpen, React.useCallback(() => { setChatOpen(null); return true; }, []));",
   "useBackLayer(!!chatOpen, React.useCallback(() => { if (chatOpen && chatOpen.from) { setChatOpen(null); setOverlay({ tab: chatOpen.from }); } else { setChatOpen(null); } return true; }, [chatOpen]));"),
  ("setChatOpen({ kind: 'persona', key: target.persona, draft: target.draft, autoSend: target.autoSend }); } }, [target, world]);",
   "setChatOpen({ kind: 'persona', key: target.persona, draft: target.draft, autoSend: target.autoSend, from: target.from }); } }, [target, world]);"),
  ("navigate({ tab: 'gathering', persona: 'the_coach' }); }",
   "navigate({ tab: 'gathering', persona: 'the_coach', from: 'coach' }); }"),
  ("navigate({ tab: 'gathering', persona: 'the_anchor', draft: text, autoSend: !!send }); }",
   "navigate({ tab: 'gathering', persona: 'the_anchor', draft: text, autoSend: !!send, from: 'bulletin' }); }"),
  ("onBack={() => setChatOpen(null)} onRoute={navigate}",
   "onBack={() => { if (chatOpen.from) { setChatOpen(null); setOverlay({ tab: chatOpen.from }); } else { setChatOpen(null); } }} onRoute={navigate}"),
])

# ── 4. ChatHome.js — entry row -> "the Coaching hub" + hub image ──────
patch("app/ChatHome.js", [
  ("the_coach.jpg?v=4", "the_coaching_hub.jpg?v=5"),
  ('name="the Coach"', 'name="the Coaching hub"'),
  ('line="name an exam \u2014 a plan, daily lessons, quizzes, mocks."',
   'line="name an exam or subject \u2014 plans, lessons, quizzes, mocks."'),
])

# ── 5. faces ──────────────────────────────────────────────────────────
for f in ("the_coach.jpg", "the_coaching_hub.jpg"):
    p = os.path.join("public", "faces", f)
    print(f"face          -> {'present' if os.path.isfile(p) else 'MISSING'}: {p}")
print("done.")
