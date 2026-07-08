#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip83 · THE DOORWAY: one-time consent gate (Dev ruling)
#  Before the FIRST public-room entry ever, a conduct/18+ gate; accept once,
#  never shown again (AsyncStorage flag). Client-only, OTA-safe. In-lane:
#  only the communities enter-flow in ChatHome is touched.
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
    # ── A. consent state + gate the enter flow ──
    (
        "consent gate on enter()",
        "  const enter = async (room) => {\n"
        "    if (busy) return;\n"
        "    setBusy(room.id);\n"
        "    try {\n"
        "      let threadId = room.threadId;\n"
        "      if (!room.joined) {\n"
        "        const j = await joinPublicRoom(room.id);\n"
        "        if (j && j.threadId) threadId = j.threadId;\n"
        "      }\n"
        "      if (threadId) onOpen({ kind: 'room', room: { id: threadId, name: room.name, personas: room.personas || [], publicRoomId: room.id, youCreated: !!room.youCreated } });\n"
        "    } catch (e) {}\n"
        "    setBusy(null);\n"
        "  };",

        "  const [consentFor, setConsentFor] = useState(null);\n"
        "  const consented = React.useRef(false);\n"
        "  useEffect(() => { AsyncStorage.getItem('z_public_consent').then((v) => { consented.current = (v === '1'); }).catch(() => {}); }, []);\n"
        "  const proceedEnter = async (room) => {\n"
        "    if (busy) return;\n"
        "    setBusy(room.id);\n"
        "    try {\n"
        "      let threadId = room.threadId;\n"
        "      if (!room.joined) {\n"
        "        const j = await joinPublicRoom(room.id);\n"
        "        if (j && j.threadId) threadId = j.threadId;\n"
        "      }\n"
        "      if (threadId) onOpen({ kind: 'room', room: { id: threadId, name: room.name, personas: room.personas || [], publicRoomId: room.id, youCreated: !!room.youCreated } });\n"
        "    } catch (e) {}\n"
        "    setBusy(null);\n"
        "  };\n"
        "  const enter = (room) => { if (!consented.current) { setConsentFor(room); return; } proceedEnter(room); };\n"
        "  const acceptConsent = async () => { consented.current = true; try { await AsyncStorage.setItem('z_public_consent', '1'); } catch (e) {} const r = consentFor; setConsentFor(null); if (r) proceedEnter(r); };",
        "z_public_consent",
    ),
    # ── B. wrap the return so the gate can overlay ──
    (
        "wrap return in a View",
        "  return (\n"
        "    <ScrollView contentContainerStyle={{ paddingBottom: 90, paddingTop: 6 }} showsVerticalScrollIndicator={false}>",
        "  return (\n"
        "    <View style={{ flex: 1 }}>{/* [zip83 consent wrap] */}\n"
        "    <ScrollView contentContainerStyle={{ paddingBottom: 90, paddingTop: 6 }} showsVerticalScrollIndicator={false}>",
        "[zip83 consent wrap]",
    ),
    # ── C. the gate overlay + close the wrap ──
    (
        "consent overlay",
        "      {(!rooms || !rooms.length) && <Text style={[st.commSub, { textAlign: 'center', marginTop: 30 }]}>no rooms yet — be the first to create one.</Text>}\n"
        "    </ScrollView>\n"
        "  );",
        "      {(!rooms || !rooms.length) && <Text style={[st.commSub, { textAlign: 'center', marginTop: 30 }]}>no rooms yet — be the first to create one.</Text>}\n"
        "    </ScrollView>\n"
        "    {consentFor && (\n"
        "      <Pressable style={st.consentScrim} onPress={() => setConsentFor(null)}>\n"
        "        <Pressable style={st.consentSheet} onPress={(e) => e.stopPropagation?.()}>\n"
        "          <Text style={st.consentTitle}>before you step in</Text>\n"
        "          <Text style={st.consentBody}>Open rooms are public and 18+ — you'll be talking with strangers. Keep it civil: the doorman removes slurs, harassment, and doxxing. Don't share anything you wouldn't hand a stranger.</Text>\n"
        "          <View style={st.consentRow}>\n"
        "            <Pressable hitSlop={8} onPress={() => setConsentFor(null)}><Text style={st.consentCancel}>not now</Text></Pressable>\n"
        "            <Pressable style={st.consentBtn} onPress={acceptConsent}><Text style={st.consentBtnTxt}>I understand — enter</Text></Pressable>\n"
        "          </View>\n"
        "        </Pressable>\n"
        "      </Pressable>\n"
        "    )}\n"
        "    </View>\n"
        "  );",
        "st.consentScrim",
    ),
    # ── D. the gate styles ──
    (
        "consent styles",
        "  commDot: { width: 6, height: 6, borderRadius: 3 },",
        "  commDot: { width: 6, height: 6, borderRadius: 3 },\n"
        "  consentScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 },\n"
        "  consentSheet: { width: '100%', borderRadius: 20, backgroundColor: MOON.raise, borderWidth: 1, borderColor: 'rgba(159,194,232,0.16)', padding: 22 },\n"
        "  consentTitle: { fontFamily: FONTS.display, color: MOON.porcelain, fontSize: 22 },\n"
        "  consentBody: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 14, lineHeight: 21, marginTop: 10 },\n"
        "  consentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16, marginTop: 20 },\n"
        "  consentCancel: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 14, paddingVertical: 8 },\n"
        "  consentBtn: { backgroundColor: MOON.moon, borderRadius: 100, paddingHorizontal: 18, paddingVertical: 11 },\n"
        "  consentBtnTxt: { fontFamily: FONTS.semibold, color: MOON.ground, fontSize: 13.5 },",
        "consentScrim:",
    ),
]

def main():
    print("── zip83 · the doorway (one-time consent gate) ──")
    patch_file(CH, EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
