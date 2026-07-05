import io, sys
edits=[]
def E(path,old,new,label,marker_absent=None): edits.append((path,old,new,label,marker_absent))

D='app/Desk.js'; H='app/ChatHome.js'; N='app/Nav.js'

# ── A. REVERT the 3 dead Desk.js coach edits ──
E(D, "  the_coach:{name:'the coach',desc:'name an exam — a plan, daily lessons, quizzes, and mocks.',rgb:'231,176,122'},\n", "", "revert Desk PERSONA_META")
E(D, "    if (key === 'the_coach') return onRoute({ tab: 'coach' });\n", "", "revert Desk routeTo")
E(D, "{['the_coach', ...TABLE_CAST.map((p) => p.key), 'the_anchor'].map((k) => (",
     "{[...TABLE_CAST.map((p) => p.key), 'the_anchor'].map((k) => (", "revert Desk cast row")

# ── B. ADD the coach row to ChatHome (the real home), under the Newsroom ──
E(H,
  '          <Row face={`https://callmez.app/faces/the_newsroom.jpg?v=4`} tone={MOON.hairStrong} name="the Newsroom" line="the bulletin · fact-checks · ask the anchor" pinned onPress={() => onOpen({ kind: \'bulletin\' })} />',
  '          <Row face={`https://callmez.app/faces/the_newsroom.jpg?v=4`} tone={MOON.hairStrong} name="the Newsroom" line="the bulletin · fact-checks · ask the anchor" pinned onPress={() => onOpen({ kind: \'bulletin\' })} />\n          <Row face={`https://callmez.app/faces/the_coach.jpg?v=4`} tone={MOON.hairStrong} name="the Coach" line="name an exam — a plan, daily lessons, quizzes, mocks." pinned onPress={() => onOpen({ kind: \'coach\' })} />',
  "add ChatHome coach row", marker_absent='name="the Coach"')

# ── C. route kind:'coach' in Nav openFromChat ──
E(N,
  "    if (dest.kind === 'bulletin') return setOverlay({ tab: 'bulletin' });",
  "    if (dest.kind === 'bulletin') return setOverlay({ tab: 'bulletin' });\n    if (dest.kind === 'coach') return setOverlay({ tab: 'coach' });",
  "nav openFromChat coach", marker_absent="dest.kind === 'coach'")

cache={}
def load(p):
    if p not in cache: cache[p]=io.open(p,encoding='utf-8').read()
    return cache[p]
planned,skipped=[],[]
for (path,old,new,label,mabs) in edits:
    s=load(path)
    # idempotent: skip if the target state is already there
    if mabs and mabs in s: skipped.append(label); continue
    if old not in s: skipped.append(label); continue
    if s.count(old)!=1: print(f"  ! {label}: anchor x{s.count(old)} in {path} — ABORT"); sys.exit(1)
    cache[path]=s.replace(old,new); planned.append(label)
for p,c in cache.items(): io.open(p,'w',encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
