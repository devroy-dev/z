#!/usr/bin/env python3
# apply_coach_library.py — wires the house subject library (SEED-02: 16 codices, mig 0044).
# Run from repo root (/workspaces/z) AFTER unzipping coach-library-seed-02.zip here.
# The zip drops content/coach-library/*.md (16), migrations/0044_coach_library.sql, and
# src/coachLibrary.ts into place. This script patches src/index.ts (import + two routes)
# and appends the v3 amendment to coach-library/AUTHORING.md. Anchored, idempotent.
import os, sys, shutil, tempfile

def die(m): print("ABORT:", m); sys.exit(1)
def backup(p):
    if not os.path.exists(p + ".bak"): shutil.copy2(p, p + ".bak")
def write_atomic(path, text):
    d = os.path.dirname(path) or "."
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)

if not os.path.isdir("src"): die("no ./src — run from repo root (/workspaces/z).")

CODICES = ["logical-reasoning","quant-reasoning","critical-reasoning","english-grammar",
           "reading-comprehension","legal-reasoning","history","global-economy","geopolitics",
           "law","democracy","philosophy","war","technology","religion","environment"]
need = ["src/coachLibrary.ts", "migrations/0044_coach_library.sql"] + \
       [f"content/coach-library/codex-{n}.md" for n in CODICES]
missing = [p for p in need if not os.path.isfile(p)]
if missing: die("missing files (unzip the zip at repo root first):\n  " + "\n  ".join(missing))
print(f"files present -> src/coachLibrary.ts, migration 0044, {len(CODICES)} codices")

# ── patch src/index.ts ────────────────────────────────────────────────
IDX = "src/index.ts"; txt = open(IDX, encoding="utf-8").read(); orig = txt

IMPORT_ANCHOR = "import { distillMaterial } from './coachDistill.js';"
IMPORT_LINE   = "import { seedLibrary, listLibrary } from './coachLibrary.js';"
if IMPORT_LINE not in txt:
    if txt.count(IMPORT_ANCHOR) != 1: die("import anchor not found exactly once in index.ts")
    txt = txt.replace(IMPORT_ANCHOR, IMPORT_ANCHOR + "\n" + IMPORT_LINE)

ROUTE_ANCHOR = "app.get('/battlefield/watch/:sessionId', async (req, res) => {"
ROUTES = """// \u2500\u2500 COACH LIBRARY (house subject corpus, shared) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
app.get('/coach/library', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    res.json({ subjects: await listLibrary() });
  } catch (e: any) { res.status(500).json({ error: 'library list failed: ' + (e?.message || String(e)) }); }
});
app.post('/coach/library/seed', express.json(), async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    if (user.id !== 'd91a137e-46d4-4d85-91e4-6092007e8501') return res.status(403).json({ error: 'forbidden' });
    const only = req.body && typeof req.body.subject === 'string' ? req.body.subject : undefined;
    const seeded = await seedLibrary(only);
    res.json({ ok: true, count: seeded.length, seeded });
  } catch (e: any) { res.status(500).json({ error: 'library seed failed: ' + (e?.message || String(e)) }); }
});

"""
if "/coach/library/seed" not in txt:
    if txt.count(ROUTE_ANCHOR) != 1: die("route anchor not found exactly once in index.ts")
    txt = txt.replace(ROUTE_ANCHOR, ROUTES + ROUTE_ANCHOR)

if txt != orig:
    backup(IDX); write_atomic(IDX, txt); print("index.ts     -> import + /coach/library + /coach/library/seed added")
else:
    print("index.ts     -> already wired")

# ── append v3 amendment to coach-library/AUTHORING.md ─────────────────
AUTH, AMEND = "coach-library/AUTHORING.md", "coach-library/AUTHORING-v3-amendment.md"
if os.path.isfile(AUTH) and os.path.isfile(AMEND):
    a = open(AUTH, encoding="utf-8").read()
    if "SUBJECT-KNOWLEDGE codex type" not in a:
        backup(AUTH)
        with open(AUTH, "a", encoding="utf-8") as f: f.write("\n\n---\n\n" + open(AMEND, encoding="utf-8").read())
        print("AUTHORING.md -> v3 amendment appended")
    else: print("AUTHORING.md -> v3 amendment already present")
else: print("AUTHORING.md -> (skipped: not found — append manually if needed)")
print("done.")
