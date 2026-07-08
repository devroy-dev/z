#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip84 · THE ROOM INTERIOR, TIER-2 FLAT FEED (public rooms only)
#  Bubbles are retired inside PUBLIC rooms: a flat line feed — handle in its
#  aura colour, the keeper (the_moderator) marked ◆, human strangers get a
#  stable hashed hue. The big presence rail is hidden (it's a crowd, not a
#  persona chat). ALL branched on room.publicRoomId → curated persona rooms
#  and DMs render EXACTLY as before. Client-only, OTA-safe.
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
            print("  · " + rel + " :: " + name + " already applied — skip"); continue
        c = src.count(anchor)
        if c == 0: die(rel + " :: " + name + " — anchor NOT FOUND (tree drifted?)")
        if c > 1: die(rel + " :: " + name + " — anchor matched " + str(c) + "× (ambiguous)")
        src = src.replace(anchor, repl, 1); changed = True
        print("  ✓ " + rel + " :: " + name)
    if changed: atomic_write(p, src)

ML_EDITS = [
    # ── FlatLine component + hashed human hues ──
    (
        "FlatLine + hashHue",
        "const flat = (t) => String(t || '').replace(/\\*\\*?/g, '');",
        "const flat = (t) => String(t || '').replace(/\\*\\*?/g, '');\n"
        "\n"
        "// [zip84] Tier-2 flat feed: handle in aura colour, keeper marked, no bubble.\n"
        "const FLAT_HUES = ['#F0997B', '#85B7EB', '#EF9F27', '#ED93B1', '#97C459', '#5DCAA5', '#AFA9EC'];\n"
        "const hashHue = (s) => FLAT_HUES[Math.abs([...String(s || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)) % FLAT_HUES.length];\n"
        "function FlatLine({ line }) {\n"
        "  let handle, color;\n"
        "  if (line.who === 'you') { handle = 'you'; color = '#E7B07A'; }\n"
        "  else if (line.who === 'human') { handle = line.name || 'someone'; color = hashHue(line.name); }\n"
        "  else { handle = nameOf(line.key); color = `rgb(${rgbOf(line.key)})`; }\n"
        "  const keeper = line.key === 'the_moderator';\n"
        "  const body = line.typing && !line.text ? '•••' : flat(line.text);\n"
        "  return (\n"
        "    <View style={styles.flatWrap}>\n"
        "      <Text style={styles.flatText}>\n"
        "        <Text style={[styles.flatHandle, { color }]}>{handle}</Text>{keeper ? <Text style={[styles.flatDiamond, { color }]}> ◆</Text> : null}<Text style={styles.flatBody}>{'  '}{body}</Text>\n"
        "      </Text>\n"
        "      {line.imageUri ? <Image source={{ uri: line.imageUri }} style={styles.flatPhoto} /> : null}\n"
        "    </View>\n"
        "  );\n"
        "}",
        "function FlatLine",
    ),
    # ── RoomLine: flat branch at the top ──
    (
        "RoomLine flat branch",
        "export function RoomLine({ line, hideSpeaker, mentionables }) {",
        "export function RoomLine({ line, hideSpeaker, mentionables, flatMode }) {\n"
        "  if (flatMode) return <FlatLine line={line} />;",
        "flatMode",
    ),
    # ── MessageList: accept flatFeed + pass down ──
    (
        "MessageList flatFeed prop",
        "export default function MessageList({ lines, booted, hideSpeaker = false, emptyCopy = 'a shared room — say something to get it going.', mentionables = [] }) {",
        "export default function MessageList({ lines, booted, hideSpeaker = false, emptyCopy = 'a shared room — say something to get it going.', mentionables = [], flatFeed = false }) {",
        "flatFeed = false",
    ),
    (
        "pass flatMode to RoomLine",
        "        : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={hideSpeaker} mentionables={mentionables} />)}",
        "        : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={hideSpeaker} mentionables={mentionables} flatMode={flatFeed} />)}",
        "flatMode={flatFeed}",
    ),
    # ── flat styles ──
    (
        "flat styles",
        "  sharedPhoto: { width: 190, height: 190, borderRadius: 16, resizeMode: 'cover' },",
        "  sharedPhoto: { width: 190, height: 190, borderRadius: 16, resizeMode: 'cover' },\n"
        "  flatWrap: { marginBottom: 9 },\n"
        "  flatText: { fontSize: 14.5, lineHeight: 20 },\n"
        "  flatHandle: { fontFamily: 'Figtree_600SemiBold' },\n"
        "  flatDiamond: { fontSize: 10 },\n"
        "  flatBody: { fontFamily: 'Figtree_400Regular', color: '#D6D4DE' },\n"
        "  flatPhoto: { width: 180, height: 180, borderRadius: 14, resizeMode: 'cover', marginTop: 6 },",
        "flatWrap:",
    ),
]

CR_EDITS = [
    # ── hide the presence rail for public rooms ──
    (
        "hide stage for public",
        "        {/* the presences — lit one rises */}\n"
        "        <View style={styles.stage}>\n"
        "          {personas.map((k) => (\n"
        "            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>\n"
        "              <RoomPresence pkey={k} active={feed.floor === k} targeted={addressed.includes(k)} />\n"
        "            </Pressable>\n"
        "          ))}\n"
        "          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={feed.floor === h.id} />)}\n"
        "        </View>",
        "        {/* the presences — lit one rises (curated only; public rooms are a flat feed) */}\n"
        "        {!room?.publicRoomId && (\n"
        "        <View style={styles.stage}>\n"
        "          {personas.map((k) => (\n"
        "            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>\n"
        "              <RoomPresence pkey={k} active={feed.floor === k} targeted={addressed.includes(k)} />\n"
        "            </Pressable>\n"
        "          ))}\n"
        "          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={feed.floor === h.id} />)}\n"
        "        </View>\n"
        "        )}",
        "public rooms are a flat feed",
    ),
    # ── flat feed inside public rooms ──
    (
        "flatFeed on MessageList",
        "        <MessageList lines={feed.lines} booted={feed.booted} mentionables={mentionables} />",
        "        <MessageList lines={feed.lines} booted={feed.booted} mentionables={mentionables} flatFeed={!!room?.publicRoomId} />",
        "flatFeed={!!room?.publicRoomId}",
    ),
]

def main():
    print("── zip84 · Tier-2 flat feed (public rooms only) ──")
    patch_file("app/MessageList.js", ML_EDITS)
    patch_file("app/CuratedRoomScreen.js", CR_EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
