#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  DM header parity: add the DELETE + VIDEO-CALL buttons (like the persona chat).
#  Builds on roomchat-dm2 (peer DP). App-only (OTA). Run from repo root:
#      python3 apply_dm_header_buttons.py
#  Transactional + idempotent.
#
#  • delete (trash) → confirm → deleteRoomThread(room.id) → back. Real delete.
#  • call (video)  → opens VideoCall with the peer's name + avatar (same call
#    surface the personas use; real live human↔human calling is a separate backend).
#  Only DMs (isDM); group/persona rooms unchanged.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

R = 'app/RoomChat.js'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# imports
E("import { startGameSession, getLiveGame, kickFromRoom } from './api';",
  "import { startGameSession, getLiveGame, kickFromRoom, deleteRoomThread } from './api';",
  "import deleteRoomThread", marker="kickFromRoom, deleteRoomThread")
E("import CallbreakLive from './games/callbreak/Live';",
  "import CallbreakLive from './games/callbreak/Live';\nimport VideoCall from './VideoCall';",
  "import VideoCall", marker="import VideoCall from './VideoCall'")

# inCall state (next to avatars state)
E("  const [avatars, setAvatars] = useState({});   // uid -> avatar_url",
  "  const [avatars, setAvatars] = useState({});   // uid -> avatar_url\n  const [inCall, setInCall] = useState(false);",
  "inCall state", marker="const [inCall, setInCall]")

# doDeleteDM (after the peer vars)
E("  const peerAvatar = peer ? (avatars[peer.id] || null) : null;",
  "  const peerAvatar = peer ? (avatars[peer.id] || null) : null;\n"
  "  const doDeleteDM = () => {\n"
  "    Alert.alert('delete this chat?', 'this removes the conversation for you. it can\u2019t be undone.',\n"
  "      [{ text: 'cancel', style: 'cancel' },\n"
  "       { text: 'delete', style: 'destructive', onPress: async () => { try { await deleteRoomThread(room.id); } catch (e) {} onBack(); } }]);\n"
  "  };",
  "doDeleteDM", marker="const doDeleteDM")

# early return into the call surface (before the main render)
E("  return (\n    <View style={styles.root}>",
  "  if (inCall) return <VideoCall persona={{ key: (peer && peer.id) || 'peer', name: peerName, customPhoto: peerAvatar }} onEnd={() => setInCall(false)} />;\n\n"
  "  return (\n    <View style={styles.root}>",
  "inCall early return", marker="if (inCall) return <VideoCall")

# the DM header: name view + the two buttons (delete, call)
E('''          {isDM ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PeerDP name={peerName} avatar={peerAvatar} />
              <Text style={styles.roomTitle} numberOfLines={1}>{peerName}</Text>
            </View>
          ) : (''',
  '''          {isDM ? (
            <>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PeerDP name={peerName} avatar={peerAvatar} />
              <Text style={styles.roomTitle} numberOfLines={1}>{peerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable hitSlop={10} onPress={doDeleteDM}>
                <Svg width="19" height="19" viewBox="0 0 24 24" fill="none"><Path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke={N.moonDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></Svg>
              </Pressable>
              <Pressable hitSlop={10} style={styles.callBtn} onPress={() => setInCall(true)}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Path d="M15 10l4.5-3v10L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke="rgb(159,176,206)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></Svg>
              </Pressable>
            </View>
            </>
          ) : (''',
  "DM header buttons", marker="onPress={doDeleteDM}")

# callBtn style
E("  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },",
  "  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },\n"
  "  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(159,176,206,0.35)', backgroundColor: 'rgba(255,255,255,0.02)' },",
  "callBtn style", marker="  callBtn:")

# ── apply (transactional + idempotent) ──────────────────────────────────
if not os.path.isfile(R): print("Run from repo root (no app/RoomChat.js)."); sys.exit(1)
src = io.open(R, encoding='utf-8').read()
planned, skipped = [], []
staged = src
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT (nothing written)"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(R, 'w', encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}. App-only → OTA: expo export → eas update --branch preview.")
