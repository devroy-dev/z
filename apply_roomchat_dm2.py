#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  RoomChat: DM convergence + peer DP.  SUPERSEDES roomchat-dm.zip (do not apply
#  both — this is idempotent and includes the earlier convergence).
#  Run from repo root: python3 apply_roomchat_dm2.py
#  Touches src/index.ts (SERVER — send member avatars) + app/RoomChat.js (APP/OTA).
#  Transactional + idempotent.
#
#  Adds to the DM convergence: the 1:1 header now shows the PERSON — their DP if set,
#  their initials circle as fallback — next to their name, exactly like a persona chat
#  shows the persona's face. Needs the server to include each member's avatar_url.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

R, I = 'app/RoomChat.js', 'src/index.ts'
edits = []  # (path, old, new, label, marker)
def E(path, old, new, label, marker=None): edits.append((path, old, new, label, marker))

# ═══ SERVER: /rooms/:id/members → include avatars ════════════════════════
E(I,
  """    const map: Record<string,string> = {};
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name').in('id', ids);
      (us ?? []).forEach((u: any) => { map[u.id] = u.display_name || 'someone'; });
    }
    res.json({ members: map, meId: user.id });""",
  """    const map: Record<string,string> = {};
    const avatars: Record<string,string|null> = {};
    if (ids.length) {
      const { data: us } = await supabase.from('users').select('id, display_name, avatar_url').in('id', ids);
      (us ?? []).forEach((u: any) => { map[u.id] = u.display_name || 'someone'; avatars[u.id] = u.avatar_url || null; });
    }
    res.json({ members: map, avatars, meId: user.id });""",
  "server members +avatars", marker="const avatars: Record<string,string|null>")

# ═══ APP: DM convergence (from roomchat-dm) ══════════════════════════════
E(R, "  const title = room?.name || 'the room';",
  "  const title = room?.name || 'the room';\n  const isDM = personas.length === 0;   // 1:1 human DM — render like the 1:1 chat, not a room",
  "isDM flag", marker="render like the 1:1 chat, not a room")
E(R, '''      <LinearGradient colors={[`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />''',
  '''      <LinearGradient colors={isDM ? ['rgba(159,176,206,0.06)', 'rgba(159,176,206,0.02)', N.night] : [`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />''',
  "DM neutral background")
E(R, '''        {/* the presences — lit one rises */}
        <View style={styles.stage}>
          {personas.map((k) => (
            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>
              <RoomPresence pkey={k} active={floor === k} targeted={addressed.includes(k)} />
            </Pressable>
          ))}
          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={floor === h.id} />)}
        </View>''',
  '''        {/* the presences — lit one rises (rooms only; a 1:1 DM has no rail) */}
        {!isDM && (
        <View style={styles.stage}>
          {personas.map((k) => (
            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>
              <RoomPresence pkey={k} active={floor === k} targeted={addressed.includes(k)} />
            </Pressable>
          ))}
          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={floor === h.id} />)}
        </View>
        )}''',
  "DM hide rail", marker="rooms only; a 1:1 DM has no rail")
E(R, '''          {canModerate ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>''',
  '''          {canModerate && !isDM ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>''',
  "DM drop manage")
E(R, "function RoomLine({ line }) {", "function RoomLine({ line, hideSpeaker }) {", "RoomLine hideSpeaker prop")
E(R, "          <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text>",
  "          {!hideSpeaker ? <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text> : null}",
  "RoomLine hide human speaker")
E(R, "            : lines.map((l) => <RoomLine key={l.id} line={l} />)}",
  "            : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={isDM} />)}",
  "pass hideSpeaker to RoomLine")
E(R, "  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderBottomRightRadius: 5 },",
  "  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderTopRightRadius: 5 },",
  "bubble notch align")

# ═══ APP: the peer DP ════════════════════════════════════════════════════
# avatars state + load
E(R, "  const [members, setMembers] = useState({});   // uid -> name",
  "  const [members, setMembers] = useState({});   // uid -> name\n  const [avatars, setAvatars] = useState({});   // uid -> avatar_url",
  "avatars state", marker="const [avatars, setAvatars]")
E(R, "      setMembers(mem.members || {});",
  "      setMembers(mem.members || {});\n      setAvatars(mem.avatars || {});",
  "load avatars", marker="setAvatars(mem.avatars")
# the PeerDP component (inserted before the spoken-line comment)
E(R, "// ── a spoken line ──",
  '''// ── the peer's DP for a 1:1 DM header: their photo if set, initials otherwise ──
function PeerDP({ name, avatar }) {
  const [ok, setOk] = React.useState(!!avatar);
  const S = 34;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: S, height: S, borderRadius: S / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(159,176,206,0.4)', backgroundColor: 'rgba(40,46,60,0.6)', alignItems: 'center', justifyContent: 'center' }}>
      {ok && avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
        : <Text style={{ fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: '#AEB6C6' }}>{initials}</Text>}
    </View>
  );
}

// ── a spoken line ──''',
  "PeerDP component", marker="function PeerDP({ name, avatar })")
# peer vars (after humans is derived)
E(R, "  const humans = Object.entries(members).filter(([uid]) => uid !== meIdRef.current).map(([id, name]) => ({ id, name }));",
  "  const humans = Object.entries(members).filter(([uid]) => uid !== meIdRef.current).map(([id, name]) => ({ id, name }));\n"
  "  const peer = humans[0] || null;\n"
  "  const peerName = (peer && peer.name) || title;\n"
  "  const peerAvatar = peer ? (avatars[peer.id] || null) : null;",
  "peer vars", marker="const peerAvatar = peer ?")
# DM header: DP + name (else the room title/sub)
E(R, '''          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            {personas.length ? (
              <Text style={styles.roomSub} numberOfLines={1}>
                {personas.map((k) => nameOf(k).replace('the ', '')).join(' · ')}
                {humans.length ? `  +  ${humans.map((h) => (h.name || '').split(' ')[0]).join(', ')}` : ''}
              </Text>
            ) : null}
          </View>''',
  '''          {isDM ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PeerDP name={peerName} avatar={peerAvatar} />
              <Text style={styles.roomTitle} numberOfLines={1}>{peerName}</Text>
            </View>
          ) : (
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            {personas.length ? (
              <Text style={styles.roomSub} numberOfLines={1}>
                {personas.map((k) => nameOf(k).replace('the ', '')).join(' · ')}
                {humans.length ? `  +  ${humans.map((h) => (h.name || '').split(' ')[0]).join(', ')}` : ''}
              </Text>
            ) : null}
          </View>
          )}''',
  "DM header DP", marker="<PeerDP name={peerName}")

# ── apply (transactional across files + idempotent) ─────────────────────
if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
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
print(f"\nStaged {len(planned)}, skipped {len(skipped)}.")
print("SERVER: npm run build → push.  APP: expo export → eas update --branch preview.")
