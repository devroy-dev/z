#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip80 · THE ROOMS TAB BECOMES THE LOBBY (Tier-1 semi-loud)
#  Public rooms own the Rooms tab. "your rooms" is one tap away (reversible).
#  Pure client. OTA-safe (no migration, no server). Placeholder loader.
#  Run from the repo root:  python3 patch.py
#  Idempotent + anchor-asserted + atomic writes.
# ════════════════════════════════════════════════════════════════════════
import os, sys, tempfile

SELF = os.path.dirname(os.path.abspath(__file__))
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
            print("  · " + rel + " :: " + name + " already applied — skip"); continue
        c = src.count(anchor)
        if c == 0: die(rel + " :: " + name + " — anchor NOT FOUND (tree drifted?)")
        if c > 1: die(rel + " :: " + name + " — anchor matched " + str(c) + "× (ambiguous)")
        src = src.replace(anchor, repl, 1); changed = True
        print("  ✓ " + rel + " :: " + name)
    if changed: atomic_write(p, src)

def write_lobby():
    s = os.path.join(SELF, "app", "Lobby.js")
    if not os.path.exists(s): die("bundled app/Lobby.js missing from the zip")
    d = os.path.join(REPO, "app", "Lobby.js"); body = read(s)
    if os.path.exists(d) and read(d) == body:
        print("  · app/Lobby.js identical — skip"); return
    atomic_write(d, body); print("  ✓ app/Lobby.js written")

APP_EDITS = [
    (
        "import Lobby",
        "import PublicRoom from './PublicRoom';",
        "import PublicRoom from './PublicRoom';\nimport Lobby from './Lobby';",
        "import Lobby from './Lobby'",
    ),
    (
        "RoomsWorld → lobby-default view toggle",
        "function RoomsWorld() {\n"
        "  const [openRoom, setOpenRoom] = React.useState(null);\n"
        "  useBackLayer(!!openRoom, React.useCallback(() => { setOpenRoom(null); return true; }, []));\n"
        "  if (openRoom && !openRoom.create) {\n"
        "    if (openRoom.kind === 'public') {\n"
        "      return <PublicRoom room={openRoom} onExit={() => setOpenRoom(null)} />;\n"
        "    }\n"
        "    return ((openRoom?.personas && openRoom.personas.length) || openRoom?.persona)\n"
        "      ? <CuratedRoomScreen room={openRoom} onBack={() => setOpenRoom(null)} />\n"
        "      : <DMScreen room={openRoom} onBack={() => setOpenRoom(null)} />;\n"
        "  }\n"
        "  return <Rooms onOpen={(r) => setOpenRoom(r)} />;\n"
        "}",
        "function RoomsWorld() {\n"
        "  const [view, setView] = React.useState('lobby');   // 'lobby' | 'myrooms'\n"
        "  const [openRoom, setOpenRoom] = React.useState(null);\n"
        "  useBackLayer(view === 'myrooms', React.useCallback(() => { setView('lobby'); return true; }, []));\n"
        "  useBackLayer(!!openRoom, React.useCallback(() => { setOpenRoom(null); return true; }, []));\n"
        "  if (openRoom && !openRoom.create) {\n"
        "    if (openRoom.kind === 'public') {\n"
        "      return <PublicRoom room={openRoom} onExit={() => setOpenRoom(null)} />;\n"
        "    }\n"
        "    return ((openRoom?.personas && openRoom.personas.length) || openRoom?.persona)\n"
        "      ? <CuratedRoomScreen room={openRoom} onBack={() => setOpenRoom(null)} />\n"
        "      : <DMScreen room={openRoom} onBack={() => setOpenRoom(null)} />;\n"
        "  }\n"
        "  if (view === 'myrooms') return <Rooms onOpen={(r) => setOpenRoom(r)} onBack={() => setView('lobby')} />;\n"
        "  return <Lobby onOpen={(r) => setOpenRoom({ ...r, kind: 'public' })} onMyRooms={() => setView('myrooms')} />;\n"
        "}",
        "const [view, setView]",
    ),
]

ROOMS_EDITS = [
    (
        "onBack prop",
        "export default function Rooms({ onOpen = () => {} }) {",
        "export default function Rooms({ onOpen = () => {}, onBack = null }) {",
        "onBack = null",
    ),
    (
        "header back + your-rooms title",
        "        <View style={styles.header}>\n"
        "          <Text style={styles.kicker}>together</Text>\n"
        "          <Text style={styles.title}>rooms</Text>\n"
        "        </View>",
        "        <View style={styles.header}>\n"
        "          {onBack ? (\n"
        "            <Pressable hitSlop={12} onPress={onBack} style={styles.backRow}>\n"
        "              <Text style={styles.backChev}>‹</Text>\n"
        "              <Text style={styles.backTxt}>public rooms</Text>\n"
        "            </Pressable>\n"
        "          ) : null}\n"
        "          <Text style={styles.kicker}>together</Text>\n"
        "          <Text style={styles.title}>your rooms</Text>\n"
        "        </View>",
        "styles.backRow",
    ),
    (
        "retire the public stub (the lobby is the tab now)",
        "          {/* PUBLIC — last, not yet open */}\n"
        "          <Text style={[styles.sectionLabel, { marginTop: 28, paddingHorizontal: 24 }]}>public rooms</Text>\n"
        "          <Text style={styles.empty}>open rooms are coming — a place to step into with strangers.</Text>",
        "          {/* public rooms now own the Rooms tab (the lobby) — [zip80] */}",
        "public rooms now own the Rooms tab",
    ),
    (
        "back-row styles",
        "  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },",
        "  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 10 },\n"
        "  backRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },\n"
        "  backChev: { fontFamily: 'Figtree_400Regular', color: N.silver, fontSize: 22, marginTop: -2 },\n"
        "  backTxt: { fontFamily: 'Figtree_500Medium', color: N.silver, fontSize: 13.5 },",
        "backChev:",
    ),
]

def main():
    print("── zip80 · the rooms tab becomes the lobby ──")
    write_lobby()
    patch_file("app/App.js", APP_EDITS)
    patch_file("app/Rooms.js", ROOMS_EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
