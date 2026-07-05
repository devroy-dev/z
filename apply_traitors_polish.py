import io, os, sys
T = 'src/games/traitors.ts'
edits = []
def E(old, new, label, marker=None): edits.append((old, new, label, marker))

# A) reveal now falls THROUGH into roundtable (one step runs the next round's table)
E("""  if (s.phase === 'roundtable') {
    for (const seat of aliveSeats(s)) {
      if (s.seats[seat].kind === 'user') continue;   // the human speaks via chat, not auto
      const line = await speakOne(s, seat);
      s.log.push({ round: s.round, phase: 'roundtable', seat, name: s.seats[seat].name, text: line });
    }
    s.phase = 'banish';
    return s;
  }""",
"""  if (s.phase === 'reveal') {
    s.round += 1;
    s.phase = 'roundtable';   // fall through: THIS step runs the new round's table
  }

  if (s.phase === 'roundtable') {
    for (const seat of aliveSeats(s)) {
      if (s.seats[seat].kind === 'user') continue;   // the human speaks via chat, not auto
      const line = await speakOne(s, seat);
      s.log.push({ round: s.round, phase: 'roundtable', seat, name: s.seats[seat].name, text: line });
    }
    s.phase = 'banish';
    return s;
  }""",
"reveal falls through to roundtable", marker="fall through: THIS step runs the new round")

# B) remove the now-redundant trailing reveal block
E("""  if (s.phase === 'reveal') {
    s.round += 1;
    s.phase = 'roundtable';
    return s;
  }
  return s;
}""",
"""  return s;
}""",
"remove redundant reveal block")

# C) banishRecap helper (after recentTalk)
E("""function recentTalk(s: TraitorsState, n = 12): string {
  return s.log.slice(-n).map((l) => `${l.name}: ${l.text}`).join('\\n') || '(the table is silent so far)';
}""",
"""function recentTalk(s: TraitorsState, n = 12): string {
  return s.log.slice(-n).map((l) => `${l.name}: ${l.text}`).join('\\n') || '(the table is silent so far)';
}
function banishRecap(s: TraitorsState): string {
  if (s.lastBanished === null) return '';
  const name = s.seats[s.lastBanished].name;
  const wasTraitor = s.lastRevealRole === 'traitor';
  return `\\n\\nLast banishment: ${name} was banished and turned out to be ${wasTraitor ? 'a TRAITOR' : 'FAITHFUL'}. ${wasTraitor ? 'The table got one right.' : 'The table got it WRONG — a traitor is still among you. Rethink your reads.'}`;
}""",
"banishRecap helper", marker="function banishRecap")

# D) feed recap into the talk + vote prompts
E("Recent table talk:\\n${recentTalk(s)}\\n\\nYour line:",
  "Recent table talk:\\n${recentTalk(s)}${banishRecap(s)}\\n\\nYour line:",
  "recap in speak prompt", marker="${recentTalk(s)}${banishRecap(s)}\\n\\nYour line:")
E("Table talk:\\n${recentTalk(s)}\\n\\nYour vote (seat number only):",
  "Table talk:\\n${recentTalk(s)}${banishRecap(s)}\\n\\nYour vote (seat number only):",
  "recap in vote prompt", marker="${recentTalk(s)}${banishRecap(s)}\\n\\nYour vote")

src = io.open(T, encoding='utf-8').read()
staged = src; planned, skipped = [], []
for (old, new, label, marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged):
        skipped.append(label); continue
    if staged.count(old) != 1:
        print(f"  ! {label}: anchor x{staged.count(old)} (need 1) — ABORT"); sys.exit(1)
    staged = staged.replace(old, new); planned.append(label)
if planned: io.open(T,'w',encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
