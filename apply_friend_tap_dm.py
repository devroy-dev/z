#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  Restart a DM from Settings — run from repo root: python3 apply_friend_tap_dm.py
#  App-only (OTA). Transactional + idempotent.
#
#  Bug: after deleting a DM you go to Settings › Friends to restart it, but the
#  friend rows are plain <View>s — not tappable. (openDM already create-or-reuses
#  a thread and filters out the deleted one, so restart works once you can tap.)
#  Fix: make accepted-friend rows tappable → openDM → open the chat. Wire the
#  navigate handler into You from both shells (Nav primary, App/DeskWorld too).
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

edits = []
def E(path, old, new, label, marker=None): edits.append((path, old, new, label, marker))

Y = 'app/You.js'
# import openDM
E(Y, "getPushPrefs } from './api';", "getPushPrefs, openDM } from './api';",
  "You import openDM", marker="getPushPrefs, openDM")
# onOpenChat prop
E(Y, "export default function You({ onBack = () => {}, onLogout = () => {} }) {",
  "export default function You({ onBack = () => {}, onLogout = () => {}, onOpenChat = () => {} }) {",
  "You onOpenChat prop", marker="onOpenChat = () => {}")
# openFriendChat handler (after loadFriends)
E(Y, "  const loadFriends = React.useCallback(() => { getFriends().then((f) => setFriends(f || { friends: [], incoming: [], outgoing: [] })); }, []);",
  "  const loadFriends = React.useCallback(() => { getFriends().then((f) => setFriends(f || { friends: [], incoming: [], outgoing: [] })); }, []);\n"
  "  const openFriendChat = async (u) => {\n"
  "    try { const r = await openDM(u.id); if (r && r.id) { onBack(); onOpenChat({ kind: 'dm', threadId: r.id, name: u.display_name || ('@' + u.handle) }); } } catch (e) {}\n"
  "  };",
  "You openFriendChat", marker="const openFriendChat = async")
# make the accepted-friends card tappable (View → Pressable). unique block.
E(Y, """          ) : friends.friends.map((u) => (
            <View key={u.id} style={styles.friendCard}>
              {u.avatar_url
                ? <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                : <View style={[styles.friendAvatar, styles.friendAvatarEmpty]}><Text style={styles.friendAvatarLetter}>{(u.display_name || u.handle || '?').slice(0,1).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{u.display_name || '@' + u.handle}</Text>
                <Text style={styles.friendSub}>@{u.handle}</Text>
              </View>
            </View>
          ))}""",
  """          ) : friends.friends.map((u) => (
            <Pressable key={u.id} style={styles.friendCard} onPress={() => openFriendChat(u)}>
              {u.avatar_url
                ? <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                : <View style={[styles.friendAvatar, styles.friendAvatarEmpty]}><Text style={styles.friendAvatarLetter}>{(u.display_name || u.handle || '?').slice(0,1).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{u.display_name || '@' + u.handle}</Text>
                <Text style={styles.friendSub}>@{u.handle}</Text>
              </View>
              <Text style={styles.friendGo}>chat ›</Text>
            </Pressable>
          ))}""",
  "You friend row tappable", marker="onPress={() => openFriendChat(u)}")
# a small 'chat ›' affordance style
E(Y, "  friendName: {",
  "  friendGo: { fontFamily: 'Figtree_500Medium', color: 'rgba(159,176,206,0.85)', fontSize: 13 },\n  friendName: {",
  "You friendGo style", marker="friendGo:")

# wire onOpenChat from the shells
E('app/Nav.js',
  "    if (overlay.tab === 'you') return <You onBack={() => setOverlay(null)} onLogout={onLogout} />;",
  "    if (overlay.tab === 'you') return <You onBack={() => setOverlay(null)} onLogout={onLogout} onOpenChat={navigate} />;",
  "Nav wire onOpenChat", marker="onLogout={onLogout} onOpenChat={navigate}")
E('app/App.js',
  "  if (openYou) return <You onBack={() => setOpenYou(false)} onLogout={onLogout} />;",
  "  if (openYou) return <You onBack={() => setOpenYou(false)} onLogout={onLogout} onOpenChat={navigate} />;",
  "App wire onOpenChat", marker="onLogout={onLogout} onOpenChat={navigate}")

# ── apply (transactional across files + idempotent) ─────────────────────
if not os.path.isdir('app'): print("Run from repo root."); sys.exit(1)
cache = {}
def load(p):
    if p not in cache: cache[p] = io.open(p, encoding='utf-8').read()
    return cache[p]
planned, skipped = [], []
for (path, old, new, label, marker) in edits:
    src = load(path)
    if (marker and marker in src) or (not marker and old not in src):
        skipped.append(label); continue
    if src.count(old) != 1:
        print(f"  ! {label}: anchor x{src.count(old)} (need 1) in {path} — ABORT (nothing written)"); sys.exit(1)
    cache[path] = src.replace(old, new); planned.append(label)
for p, c in cache.items(): io.open(p, 'w', encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}. App-only → OTA: expo export → eas update --branch preview.")
