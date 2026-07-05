import io, os, sys
edits=[]
def E(path,old,new,label,marker): edits.append((path,old,new,label,marker))
NAV='app/Nav.js'; C='app/Coach.js'

# 1) Nav: pass onAskCoach → open the coach persona chat (mirror onAskAnchor)
E(NAV,
  "    if (overlay.tab === 'coach') return <Coach onBack={() => setOverlay(null)} />;",
  "    if (overlay.tab === 'coach') return <Coach onBack={() => setOverlay(null)} onAskCoach={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_coach' }); }} />;",
  "Nav: onAskCoach → the_coach chat", "onAskCoach={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_coach' })")

# 2) Coach: accept the prop
E(C,
  "export default function Coach({ onBack = () => {} }) {",
  "export default function Coach({ onBack = () => {}, onAskCoach = () => {} }) {",
  "Coach: accept onAskCoach", "onAskCoach = () => {} }) {")

# 3) Coach: 'Ask the coach' tile → open the chat (was the course-scoped ask stage)
E(C,
  "            <Pressable style={s.action} onPress={() => setStage('ask')} disabled={busy}>",
  "            <Pressable style={s.action} onPress={onAskCoach} disabled={busy}>",
  "Coach: tile → onAskCoach", "onPress={onAskCoach} disabled={busy}>")

cache={}
def load(p):
    if p not in cache: cache[p]=io.open(p,encoding='utf-8').read()
    return cache[p]
planned,skipped=[],[]
for (path,old,new,label,marker) in edits:
    s=load(path)
    if marker in s: skipped.append(label); continue
    if s.count(old)!=1: print(f"  ! {label}: anchor x{s.count(old)} in {path} — ABORT"); sys.exit(1)
    cache[path]=s.replace(old,new); planned.append(label)
for p,c in cache.items(): io.open(p,'w',encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
