#!/usr/bin/env python3
# apply_coach_picker.py — the Coaching-hub entry picker (pick → library / custom → days)
# + server support so custom-upload accepts an IMAGE of study material (reuses the chat
# image picker). Run from repo root (/workspaces/z) after unzipping. Anchored, idempotent.
import os, sys, shutil, tempfile
def die(m): print("ABORT:", m); sys.exit(1)
def backup(p):
    if not os.path.exists(p + ".bak"): shutil.copy2(p, p + ".bak")
def write_atomic(path, text):
    d = os.path.dirname(path) or "."; fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f: f.write(text)
    os.replace(tmp, path)
def patch(path, edits):
    if not os.path.isfile(path): die(f"{path} not found.")
    txt = open(path, encoding="utf-8").read(); orig = txt
    for old, new in edits:
        if new in txt: continue                       # idempotent
        if txt.count(old) != 1: die(f"{path}: anchor {txt.count(old)}x (need 1): {old[:55]!r}")
        txt = txt.replace(old, new)
    if txt != orig: backup(path); write_atomic(path, txt); print(f"{os.path.basename(path):16s}-> patched")
    else: print(f"{os.path.basename(path):16s}-> already current")

if not os.path.isdir("app") or not os.path.isdir("src"): die("run from repo root (/workspaces/z).")

# ── 1. app/Coach.js full replace (the picker entry) ──
SRC, DST = "Coach.js", "app/Coach.js"
if not os.path.isfile(SRC): die("Coach.js missing in root — unzip here first.")
new = open(SRC, encoding="utf-8").read()
if "entryStep" not in new or "startHouse" not in new: die("source Coach.js isn't the picker build.")
cur = open(DST, encoding="utf-8").read() if os.path.isfile(DST) else ""
if cur != new:
    if os.path.isfile(DST): backup(DST)
    write_atomic(DST, new); print(f"Coach.js        -> replaced ({new.count(chr(10))+1} lines)")
else: print("Coach.js        -> already current")

# ── 2. coachDistill.ts — accept an image (not just PDF) ──
patch("src/coachDistill.ts", [
  ("  userId: string, courseId: string | null, filename: string, dataB64: string,\n): Promise<CoachDistillResult> {",
   "  userId: string, courseId: string | null, filename: string, dataB64: string, mediaType: string = 'application/pdf',\n): Promise<CoachDistillResult> {"),
  ("const up = await supabase.storage.from(BUCKET).upload(storageRef, bytes, { contentType: 'application/pdf', upsert: true });",
   "const up = await supabase.storage.from(BUCKET).upload(storageRef, bytes, { contentType: mediaType, upsert: true });"),
  (".insert({ user_id: userId, course_id: courseId, storage_ref: storageRef, filename, content_type: 'application/pdf' })",
   ".insert({ user_id: userId, course_id: courseId, storage_ref: storageRef, filename, content_type: mediaType })"),
  ("""    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dataB64 } } as any,
      { type: 'text', text: 'Produce the Brief for this study document. JSON only.' },
    ] }],""",
   """    messages: [{ role: 'user', content: [
      (mediaType.startsWith('image/')
        ? { type: 'image', source: { type: 'base64', media_type: mediaType, data: dataB64 } }
        : { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: dataB64 } }) as any,
      { type: 'text', text: 'Produce the Brief for this study document. JSON only.' },
    ] }],"""),
])

# ── 3. index.ts /coach/:id/material — infer + pass mediaType ──
patch("src/index.ts", [
  ("""    const dataB64 = String(req.body?.dataB64 || '');
    if (!dataB64) return res.status(400).json({ error: 'dataB64 (base64 PDF) required' });
    const result = await distillMaterial(user.id, c.id, filename, dataB64);""",
   """    const dataB64 = String(req.body?.dataB64 || '');
    if (!dataB64) return res.status(400).json({ error: 'dataB64 (base64 PDF or image) required' });
    const mtRaw = String(req.body?.mediaType || '').trim();
    const mediaType = mtRaw || (/\\.png$/i.test(filename) ? 'image/png' : /\\.jpe?g$/i.test(filename) ? 'image/jpeg' : 'application/pdf');
    const result = await distillMaterial(user.id, c.id, filename, dataB64, mediaType);"""),
])

# ── 4. api.js coachMaterial — pass mediaType ──
patch("app/api.js", [
  ("export async function coachMaterial(id, filename, dataB64) { return authedJSON('POST', `/coach/${id}/material`, { filename, dataB64 }); }",
   "export async function coachMaterial(id, filename, dataB64, mediaType) { return authedJSON('POST', `/coach/${id}/material`, { filename, dataB64, mediaType }); }"),
])
print("done.")
