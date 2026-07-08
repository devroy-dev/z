#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip82 · THE COMMUNITIES DIRECTORY, SEMI-LOUD (Tier-1)
#  Design-only restyle of the LIVE PublicRooms directory in ChatHome.js.
#  Every room wears its DOORMAN's aura (same tint language as the desk rows):
#  left spine + face ring + presence dot + open/join pill, all in the tone.
#  Honest presence — the doorman is the ever-present host (never-empty law);
#  no fabricated "live" crowds while rooms are near-empty pre-launch.
#  Function untouched: enter/join/open/create + all data fields preserved.
#  ONLY the communities section is touched (Dev's ownership ruling).
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

CH = "app/ChatHome.js"

EDITS = [
    # ── A. the tint helper (module scope, after nameOf) ──
    (
        "commTint helper",
        "const nameOf = (k) => (personaMeta(k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));",
        "const nameOf = (k) => (personaMeta(k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));\n"
        "const commTint = (hex, a) => { const h = String(hex).replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };",
        "const commTint",
    ),
    # ── B. the room card render — aura per room ──
    (
        "room card aura render",
        "      {(rooms || []).map((room) => (\n"
        "        <Pressable key={room.id} style={st.commCard} onPress={() => enter(room)}>\n"
        "          <View style={st.commFaces}>\n"
        "            {(room.personas || []).slice(0, 2).map((k, i) => (\n"
        "              <Image key={k} source={{ uri: dpFor(k) }} style={[st.commFace, i > 0 && { marginLeft: -12 }]} />\n"
        "            ))}\n"
        "            {(!room.personas || !room.personas.length) && <View style={[st.commFace, { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(159,194,232,0.1)' }]}><Text style={{ color: MOON.moon, fontSize: 18 }}>◇</Text></View>}\n"
        "          </View>\n"
        "          <View style={{ flex: 1, marginLeft: 12 }}>\n"
        "            <Text style={st.commName} numberOfLines={1}>{room.name}{room.youCreated ? '  ·  yours' : ''}</Text>\n"
        "            <Text style={st.commTheme} numberOfLines={2}>{room.theme}</Text>\n"
        "            <Text style={st.commMeta}>{room.memberCount || 0} in the room{room.isHouse ? ' · a house room' : ''}</Text>\n"
        "          </View>\n"
        "          <Text style={st.commGo}>{busy === room.id ? '…' : room.joined ? 'open' : 'join'}</Text>\n"
        "        </Pressable>\n"
        "      ))}",

        "      {(rooms || []).map((room) => {\n"
        "        const door = (room.personas || [])[0];\n"
        "        const tone = (door && personaMeta(door)?.tone) || MOON.moon;\n"
        "        const here = room.memberCount || 0;\n"
        "        return (\n"
        "        <Pressable key={room.id} style={[st.commCard, { backgroundColor: commTint(tone, 0.05), borderColor: commTint(tone, 0.16) }]} onPress={() => enter(room)}>\n"
        "          <View style={[st.commSpine, { backgroundColor: tone }]} />\n"
        "          <View style={st.commFaces}>\n"
        "            {(room.personas || []).slice(0, 2).map((k, i) => (\n"
        "              <Image key={k} source={{ uri: dpFor(k) }} style={[st.commFace, { borderColor: tone }, i > 0 && { marginLeft: -12 }]} />\n"
        "            ))}\n"
        "            {(!room.personas || !room.personas.length) && <View style={[st.commFace, { borderColor: tone, alignItems: 'center', justifyContent: 'center', backgroundColor: commTint(tone, 0.12) }]}><Text style={{ color: tone, fontSize: 18 }}>◇</Text></View>}\n"
        "          </View>\n"
        "          <View style={{ flex: 1, marginLeft: 12 }}>\n"
        "            <Text style={st.commName} numberOfLines={1}>{room.name}{room.youCreated ? '  ·  yours' : ''}</Text>\n"
        "            <Text style={st.commTheme} numberOfLines={2}>{room.theme}</Text>\n"
        "            <View style={st.commMetaRow}>\n"
        "              <View style={[st.commDot, { backgroundColor: tone }]} />\n"
        "              <Text style={st.commMeta} numberOfLines={1}>{door ? nameOf(door) + ' hosting' : 'open room'}{here > 1 ? '  ·  ' + here + ' here' : ''}{room.isHouse ? '  ·  house' : ''}</Text>\n"
        "            </View>\n"
        "          </View>\n"
        "          <View style={[st.commGoWrap, { borderColor: commTint(tone, 0.5) }]}>\n"
        "            <Text style={[st.commGo, { color: tone }]}>{busy === room.id ? '…' : room.joined ? 'open' : 'join'}</Text>\n"
        "          </View>\n"
        "        </Pressable>\n"
        "        );\n"
        "      })}",
        "personaMeta(door)",
    ),
    # ── C. commCard overflow (so the absolute spine clips to the radius) ──
    (
        "commCard overflow",
        "  commCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(159,194,232,0.05)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.12)' },",
        "  commCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(159,194,232,0.05)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.12)', overflow: 'hidden' },  // [zip82 aura]",
        "[zip82 aura]",
    ),
    # ── D. commMeta brighter + flex ──
    (
        "commMeta brighten",
        "  commMeta: { fontFamily: FONTS.light, color: 'rgba(232,236,244,0.4)', fontSize: 11, marginTop: 5 },",
        "  commMeta: { fontFamily: FONTS.light, color: MOON.mist, fontSize: 11, flex: 1 },  // [zip82 meta]",
        "[zip82 meta]",
    ),
    # ── E. commGo pill + the new aura styles ──
    (
        "commGo pill + aura styles",
        "  commGo: { fontFamily: FONTS.semibold, color: MOON.moon, fontSize: 13, marginLeft: 10 },",
        "  commGo: { fontFamily: FONTS.semibold, fontSize: 12.5 },\n"
        "  commGoWrap: { marginLeft: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1 },\n"
        "  commSpine: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },\n"
        "  commMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },\n"
        "  commDot: { width: 6, height: 6, borderRadius: 3 },",
        "commSpine:",
    ),
]

def main():
    print("── zip82 · communities semi-loud (aura per room) ──")
    patch_file(CH, EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
