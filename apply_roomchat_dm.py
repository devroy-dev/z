#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  RoomChat convergence — make a 1:1 human DM read like the 1:1 persona chat.
#  Run from repo root: python3 apply_roomchat_dm.py   (app/ → OTA)
#  Transactional + idempotent.
#
#  Finding: RoomChat's composer + bubbles are ALREADY essentially Chat.js's.
#  What's awkward is DM-specific room chrome (personas.length === 0):
#    • a persona-COLOUR background gradient — but a DM has no persona (undefined tint)
#    • a 112px presence RAIL holding one lone floating face
#    • a speaker-NAME label over every incoming bubble (redundant in a 1:1)
#  So: when isDM, drop all three → it looks like the clean 1:1 chat. Group/persona
#  rooms keep their rail + header (they need them). Plus one bubble-notch alignment.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# 1) define isDM in component scope
E("  const title = room?.name || 'the room';",
  "  const title = room?.name || 'the room';\n  const isDM = personas.length === 0;   // 1:1 human DM — render like the 1:1 chat, not a room",
  "isDM flag", marker="render like the 1:1 chat, not a room")

# 2) neutral background for a DM (the persona-colour gradient is meaningless with no persona)
E('''      <LinearGradient colors={[`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />''',
  '''      <LinearGradient colors={isDM ? ['rgba(159,176,206,0.06)', 'rgba(159,176,206,0.02)', N.night] : [`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />''',
  "DM neutral background")

# 3) hide the presence rail for a DM
E('''        {/* the presences — lit one rises */}
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

# 4) drop the 'manage' button on a DM (you don't moderate a 1:1)
E('''          {canModerate ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>''',
  '''          {canModerate && !isDM ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>''',
  "DM drop manage")

# 5) RoomLine: accept hideSpeaker + hide the name label when set (1:1 needs no name)
E("function RoomLine({ line }) {",
  "function RoomLine({ line, hideSpeaker }) {",
  "RoomLine hideSpeaker prop")
E("          <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text>",
  "          {!hideSpeaker ? <Text style={[styles.speaker, { color: N.human }]}>{line.name}</Text> : null}",
  "RoomLine hide human speaker")
E("            : lines.map((l) => <RoomLine key={l.id} line={l} />)}",
  "            : lines.map((l) => <RoomLine key={l.id} line={l} hideSpeaker={isDM} />)}",
  "pass hideSpeaker to RoomLine")

# 6) align the sent-bubble notch to Chat.js (top corner, not bottom)
E("  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderBottomRightRadius: 5 },",
  "  bubbleYou: { backgroundColor: 'rgba(159,194,232,0.10)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.18)', borderTopRightRadius: 5 },",
  "bubble notch align")

# ── apply (transactional + idempotent) ──────────────────────────────────
P = 'app/RoomChat.js'
if not os.path.isfile(P): print("Run from repo root (no app/RoomChat.js)."); sys.exit(1)
src = io.open(P, encoding='utf-8').read()
planned, skipped = [], []
staged = src
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT (nothing written)"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(P, 'w', encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}. App/ → OTA: expo export → eas update --branch preview.")
