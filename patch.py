#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  yourZ — zip86 · THE MEMBER SHEET (R0's last piece)
#  Public-room member sheet off the room header: members with DPs (humans +
#  personas as report targets) · REPORT (all) · BLOCK per human (+ hide their
#  lines via getMyBlocks) · MUTE local v1 (AsyncStorage, hide lines) · owner
#  KICK · LEAVE · creator DELETE ROOM (the zip85 endpoint). All scoped to
#  publicRoomId → curated persona rooms + DMs are untouched. Client-only.
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

# ── api.js — the wrappers ──
API_EDITS = [
    (
        "member-sheet wrappers",
        "export async function kickFromRoom(roomId, userId) {\n"
        "  try { return await authedJSON('POST', `/public-rooms/${roomId}/kick`, { userId }); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}",
        "export async function kickFromRoom(roomId, userId) {\n"
        "  try { return await authedJSON('POST', `/public-rooms/${roomId}/kick`, { userId }); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}\n"
        "// [zip86] member-sheet actions\n"
        "export async function reportInRoom(roomId, target) {\n"
        "  try { return await authedJSON('POST', `/rooms/${roomId}/report`, target); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}\n"
        "export async function blockUser(userId) {\n"
        "  try { return await authedJSON('POST', `/users/${userId}/block`, {}); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}\n"
        "export async function unblockUser(userId) {\n"
        "  try { return await authedJSON('DELETE', `/users/${userId}/block`); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}\n"
        "export async function getMyBlocks() {\n"
        "  try { return await authedJSON('GET', '/me/blocks'); }\n"
        "  catch (e) { return { blocked: [] }; }\n"
        "}\n"
        "export async function deletePublicRoom(publicRoomId) {\n"
        "  try { return await authedJSON('DELETE', `/public-rooms/${publicRoomId}`); }\n"
        "  catch (e) { return { error: String(e?.message || e) }; }\n"
        "}",
        "export async function reportInRoom",
    ),
]

# ── useRoomFeed.js — carry uid on human lines so block/mute can filter ──
FEED_EDITS = [
    (
        "uid on seeded human line",
        "          seed.push({ id: k, who: mine ? 'you' : 'human', name: m.sender_name || (mem.members || {})[m.sender_user_id] || 'someone', text: m.content || '', at: m.created_at });",
        "          seed.push({ id: k, who: mine ? 'you' : 'human', uid: m.sender_user_id || null, name: m.sender_name || (mem.members || {})[m.sender_user_id] || 'someone', text: m.content || '', at: m.created_at });",
        "who: mine ? 'you' : 'human', uid: m.sender_user_id",
    ),
    (
        "uid on live human line",
        "      setLines((cur) => [...cur, { id: key, who: 'human', name: members[m.sender_user_id] || m.sender_name || 'someone', text: m.content || '', at: m.created_at }]);   // [zip54p/57b] the stamp's fuel",
        "      setLines((cur) => [...cur, { id: key, who: 'human', uid: m.sender_user_id || null, name: members[m.sender_user_id] || m.sender_name || 'someone', text: m.content || '', at: m.created_at }]);   // [zip54p/57b] the stamp's fuel",
        "who: 'human', uid: m.sender_user_id",
    ),
]

# ── CuratedRoomScreen.js — the sheet ──
CR_EDITS = [
    (
        "rn imports (Image/Alert/ScrollView)",
        "import { View, Text, StyleSheet, Pressable, Share, KeyboardAvoidingView } from 'react-native';",
        "import { View, Text, StyleSheet, Pressable, Share, KeyboardAvoidingView, Image, Alert, ScrollView } from 'react-native';",
        "Image, Alert, ScrollView } from 'react-native'",
    ),
    (
        "AsyncStorage import",
        "import Grain from './Grain';",
        "import Grain from './Grain';\nimport AsyncStorage from '@react-native-async-storage/async-storage';",
        "AsyncStorage from '@react-native-async-storage",
    ),
    (
        "api imports",
        "import { startGameSession, getLiveGame, kickFromRoom, inviteToRoom } from './api';",
        "import { startGameSession, getLiveGame, kickFromRoom, inviteToRoom, reportInRoom, blockUser, getMyBlocks, deletePublicRoom, leaveRoom } from './api';",
        "reportInRoom, blockUser, getMyBlocks",
    ),
    (
        "faceUrl const",
        "import { N, nameOf, rgbOf } from './roomTheme';",
        "import { N, nameOf, rgbOf } from './roomTheme';\nconst faceUrl = (k) => `https://callmez.app/faces/${k}.jpg?v=6`;",
        "const faceUrl =",
    ),
    (
        "state + actions",
        "  const mentionables = [",
        "  const isPublic = !!room?.publicRoomId;\n"
        "  const [blocked, setBlocked] = useState(new Set());\n"
        "  const [muted, setMuted] = useState(new Set());\n"
        "  const [acting, setActing] = useState(null);\n"
        "  React.useEffect(() => {\n"
        "    if (!isPublic) return;\n"
        "    getMyBlocks().then((r) => setBlocked(new Set(r?.blocked || []))).catch(() => {});\n"
        "    AsyncStorage.getItem('z_room_mute_' + roomId).then((v) => { try { setMuted(new Set(JSON.parse(v || '[]'))); } catch (e) {} }).catch(() => {});\n"
        "  }, [isPublic, roomId]);\n"
        "  const doReport = async (t) => {\n"
        "    if (acting) return; setActing(t.id || t.key);\n"
        "    await reportInRoom(roomId, t.isPersona ? { targetPersona: t.key } : { targetUserId: t.id });\n"
        "    setActing(null); alert('reported to the doorman. thanks for keeping it civil.');\n"
        "  };\n"
        "  const doBlock = (uid, name) => {\n"
        "    Alert.alert('block ' + (name || 'them') + '?', \"you won't see each other's messages in any room.\", [\n"
        "      { text: 'cancel', style: 'cancel' },\n"
        "      { text: 'block', style: 'destructive', onPress: () => { blockUser(uid); setBlocked((s) => new Set(s).add(uid)); } },\n"
        "    ]);\n"
        "  };\n"
        "  const doMute = (uid) => {\n"
        "    setMuted((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); AsyncStorage.setItem('z_room_mute_' + roomId, JSON.stringify([...n])).catch(() => {}); return n; });\n"
        "  };\n"
        "  const doDeleteRoom = () => {\n"
        "    Alert.alert('delete this room?', 'it disappears for everyone. this cannot be undone.', [\n"
        "      { text: 'cancel', style: 'cancel' },\n"
        "      { text: 'delete', style: 'destructive', onPress: async () => { setActing('__del'); const r = await deletePublicRoom(room.publicRoomId); setActing(null); if (r && r.ok) { setRosterOpen(false); onBack(); } else alert((r && r.error) || 'could not delete the room'); } },\n"
        "    ]);\n"
        "  };\n"
        "  const doLeave = () => {\n"
        "    Alert.alert('leave this room?', 'you can rejoin from communities anytime.', [\n"
        "      { text: 'cancel', style: 'cancel' },\n"
        "      { text: 'leave', style: 'destructive', onPress: async () => { setActing('__leave'); await leaveRoom(roomId); setActing(null); setRosterOpen(false); onBack(); } },\n"
        "    ]);\n"
        "  };\n"
        "\n"
        "  const mentionables = [",
        "const isPublic = !!room?.publicRoomId;",
    ),
    (
        "hide blocked/muted lines",
        "        <MessageList lines={feed.lines} booted={feed.booted} mentionables={mentionables} flatFeed={!!room?.publicRoomId} />",
        "        <MessageList lines={(isPublic && (blocked.size || muted.size)) ? feed.lines.filter((l) => !(l.uid && (blocked.has(l.uid) || muted.has(l.uid)))) : feed.lines} booted={feed.booted} mentionables={mentionables} flatFeed={!!room?.publicRoomId} />",
        "blocked.has(l.uid)",
    ),
    (
        "topbar members button",
        "          {canModerate ? (\n"
        "            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>\n"
        "              <Text style={{ fontSize: 12 }}>🛡️</Text>\n"
        "              <Text style={styles.inviteText}>manage</Text>\n"
        "            </Pressable>\n"
        "          ) : null}",
        "          {isPublic ? (\n"
        "            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>\n"
        "              <Text style={{ fontSize: 12 }}>👥</Text>\n"
        "              <Text style={styles.inviteText}>members</Text>\n"
        "            </Pressable>\n"
        "          ) : null}",
        "<Text style={styles.inviteText}>members</Text>",
    ),
    (
        "the member sheet",
        "        {rosterOpen && canModerate && (\n"
        "          <Pressable style={styles.rosterScrim} onPress={() => setRosterOpen(false)}>\n"
        "            <Pressable style={styles.rosterSheet} onPress={(e) => e.stopPropagation?.()}>\n"
        "              <Text style={styles.rosterTitle}>your room</Text>\n"
        "              <Text style={styles.rosterSub}>tap someone to remove them for 24 hours.</Text>\n"
        "              {humans.length ? humans.map((h) => (\n"
        "                <View key={h.id} style={styles.rosterRow}>\n"
        "                  <Text style={styles.rosterName} numberOfLines={1}>{h.name || 'someone'}</Text>\n"
        "                  <Pressable style={styles.rosterKick} onPress={() => doKick(h.id, h.name)}>\n"
        "                    <Text style={styles.rosterKickTxt}>{kicking === h.id ? '…' : 'remove'}</Text>\n"
        "                  </Pressable>\n"
        "                </View>\n"
        "              )) : <Text style={styles.rosterEmpty}>no one else here yet.</Text>}\n"
        "            </Pressable>\n"
        "          </Pressable>\n"
        "        )}",
        "        {rosterOpen && isPublic && (\n"
        "          <Pressable style={styles.rosterScrim} onPress={() => setRosterOpen(false)}>\n"
        "            <Pressable style={styles.rosterSheet} onPress={(e) => e.stopPropagation?.()}>\n"
        "              <Text style={styles.rosterTitle} numberOfLines={1}>{title}</Text>\n"
        "              <Text style={styles.rosterSub}>{canModerate ? 'you host this room.' : 'report or block anyone who crosses the line.'}</Text>\n"
        "              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>\n"
        "                {personas.map((k) => (\n"
        "                  <View key={k} style={styles.memRow}>\n"
        "                    <View style={styles.memTop}>\n"
        "                      <Image source={{ uri: faceUrl(k) }} style={styles.memAvatar} />\n"
        "                      <Text style={styles.rosterName} numberOfLines={1}>{nameOf(k)}</Text>\n"
        "                    </View>\n"
        "                    <View style={styles.memActions}>\n"
        "                      <Pressable style={styles.actBtn} onPress={() => doReport({ key: k, isPersona: true })}><Text style={styles.actTxt}>{acting === k ? '…' : 'report'}</Text></Pressable>\n"
        "                    </View>\n"
        "                  </View>\n"
        "                ))}\n"
        "                {humans.map((h) => (\n"
        "                  <View key={h.id} style={styles.memRow}>\n"
        "                    <View style={styles.memTop}>\n"
        "                      <View style={styles.memInitial}><Text style={styles.memInitialTxt}>{((h.name || '?').trim()[0] || '?').toUpperCase()}</Text></View>\n"
        "                      <Text style={styles.rosterName} numberOfLines={1}>{h.name || 'someone'}{muted.has(h.id) ? '  · muted' : ''}</Text>\n"
        "                    </View>\n"
        "                    <View style={styles.memActions}>\n"
        "                      <Pressable style={styles.actGhost} onPress={() => doMute(h.id)}><Text style={styles.actGhostTxt}>{muted.has(h.id) ? 'unmute' : 'mute'}</Text></Pressable>\n"
        "                      <Pressable style={styles.actBtn} onPress={() => doReport({ id: h.id })}><Text style={styles.actTxt}>{acting === h.id ? '…' : 'report'}</Text></Pressable>\n"
        "                      <Pressable style={styles.actDanger} onPress={() => doBlock(h.id, h.name)}><Text style={styles.actDangerTxt}>block</Text></Pressable>\n"
        "                      {canModerate ? <Pressable style={styles.actDanger} onPress={() => doKick(h.id, h.name)}><Text style={styles.actDangerTxt}>{kicking === h.id ? '…' : 'kick'}</Text></Pressable> : null}\n"
        "                    </View>\n"
        "                  </View>\n"
        "                ))}\n"
        "                {!humans.length ? <Text style={styles.rosterEmpty}>no one else here yet — you and the room.</Text> : null}\n"
        "              </ScrollView>\n"
        "              <View style={styles.sheetFooter}>\n"
        "                <Pressable style={styles.leaveBtn} onPress={doLeave}><Text style={styles.leaveTxt}>{acting === '__leave' ? '…' : 'leave room'}</Text></Pressable>\n"
        "                {canModerate ? <Pressable style={styles.delBtn} onPress={doDeleteRoom}><Text style={styles.delTxt}>{acting === '__del' ? '…' : 'delete room'}</Text></Pressable> : null}\n"
        "              </View>\n"
        "            </Pressable>\n"
        "          </Pressable>\n"
        "        )}",
        "report or block anyone who crosses",
    ),
    (
        "member-sheet styles",
        "  rosterEmpty: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 13, paddingVertical: 12, textAlign: 'center' },",
        "  rosterEmpty: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 13, paddingVertical: 12, textAlign: 'center' },\n"
        "  memRow: { paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: N.hair },\n"
        "  memTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },\n"
        "  memAvatar: { width: 32, height: 32, borderRadius: 16 },\n"
        "  memInitial: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(159,176,206,0.18)', alignItems: 'center', justifyContent: 'center' },\n"
        "  memInitialTxt: { fontFamily: 'Figtree_600SemiBold', color: N.moon, fontSize: 14 },\n"
        "  memActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 42 },\n"
        "  actBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: N.hair },\n"
        "  actTxt: { fontFamily: 'Figtree_500Medium', color: N.moonDim, fontSize: 12 },\n"
        "  actGhost: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(233,232,240,0.06)' },\n"
        "  actGhostTxt: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 12 },\n"
        "  actDanger: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(224,138,138,0.4)' },\n"
        "  actDangerTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 12 },\n"
        "  sheetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: N.hair },\n"
        "  leaveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: N.hair },\n"
        "  leaveTxt: { fontFamily: 'Figtree_500Medium', color: N.moonDim, fontSize: 13 },\n"
        "  delBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, backgroundColor: 'rgba(224,138,138,0.14)', borderWidth: 1, borderColor: 'rgba(224,138,138,0.5)' },\n"
        "  delTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 13 },",
        "memActions:",
    ),
]

def main():
    print("── zip86 · the member sheet ──")
    patch_file("app/api.js", API_EDITS)
    patch_file("app/useRoomFeed.js", FEED_EDITS)
    patch_file("app/CuratedRoomScreen.js", CR_EDITS)
    print("── done. gate, then: git push  +  eas update ──")

if __name__ == "__main__":
    main()
