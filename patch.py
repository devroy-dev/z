#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip85 (SERVER) · DELETE /public-rooms/:id  (creator-only)
#  Drops a user-created room from the directory (active=false, which GET
#  /public-rooms already filters on) + soft-deletes the thread for history.
#  House rooms and non-creators are refused (403). No migration; no FK
#  cascade (room_sanctions.room_id stays valid on an inactive row).
#  Run from repo root:  python3 patch.py
#  ⚠ TOUCHES src/index.ts — do NOT push in the same sitting as the desk
#    session's server work. Rebase if their src/index.ts is uncommitted.
#  Gate: npm run build (real tsc) before push.
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
        "DELETE /public-rooms/:id (creator-only)",
        "app.get('/healthz', (_req, res) => res.json({ ok: true }));",
        "// creator-only: delete a public room — drops it from the directory (active=false,\n"
        "// which GET /public-rooms filters on) + soft-deletes the thread for history.\n"
        "app.delete('/public-rooms/:id', async (req, res) => {\n"
        "  try {\n"
        "    const authId = await authUser(req);\n"
        "    if (!authId) return res.status(401).json({ error: 'unauthorized' });\n"
        "    const me = await resolveUser(authId);\n"
        "    const { data: room } = await supabase.from('public_rooms')\n"
        "      .select('id, thread_id, created_by, is_house').eq('id', req.params.id).maybeSingle();\n"
        "    if (!room) return res.status(404).json({ error: 'no such room' });\n"
        "    if (room.is_house || room.created_by !== me.id) return res.status(403).json({ error: 'only the room\\u2019s creator can delete it.' });\n"
        "    await supabase.from('public_rooms').update({ active: false }).eq('id', room.id);\n"
        "    await supabase.from('threads').update({ deleted_at: new Date().toISOString() }).eq('id', room.thread_id);\n"
        "    res.json({ ok: true });\n"
        "  } catch (e: any) { res.status(500).json({ error: 'delete failed: ' + (e?.message || String(e)) }); }\n"
        "});\n"
        "\n"
        "app.get('/healthz', (_req, res) => res.json({ ok: true }));",
        "app.delete('/public-rooms/:id'",
    ),
]

def main():
    print("── zip85 (server) · DELETE /public-rooms/:id ──")
    patch_file("src/index.ts", EDITS)
    print("── done. npm run build (real tsc), curl-prove, then push ──")

if __name__ == "__main__":
    main()
