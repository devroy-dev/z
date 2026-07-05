import io, os, sys
D='app/Desk.js'
edits=[]
def E(old,new,label,marker=None): edits.append((old,new,label,marker))
# 1) PERSONA_META entry (name + ember aura)
E("const PERSONA_META = {",
  "const PERSONA_META = {\n  the_coach:{name:'the coach',desc:'name an exam — a plan, daily lessons, quizzes, and mocks.',rgb:'231,176,122'},",
  "meta the_coach", marker="the_coach:{name:'the coach'")
# 2) permanent cast row
E("{[...TABLE_CAST.map((p) => p.key), 'the_anchor'].map((k) => (",
  "{[...TABLE_CAST.map((p) => p.key), 'the_anchor', 'the_coach'].map((k) => (",
  "cast row +the_coach", marker="'the_anchor', 'the_coach'")
# 3) remove the flaky rotating hook
E("      { key: 'the_coach', tone: '#E7B07A', kicker: 'the study desk', line: 'name an exam — the coach builds your day-by-day plan' },\n",
  "",
  "remove rotating coach hook", marker=None)
src=io.open(D,encoding='utf-8').read(); staged=src; planned,skipped=[],[]
for (old,new,label,marker) in edits:
    if marker and marker in staged: skipped.append(label); continue
    if old not in staged: skipped.append(label); continue
    if staged.count(old)!=1: print(f"  ! {label}: anchor x{staged.count(old)} — ABORT"); sys.exit(1)
    staged=staged.replace(old,new); planned.append(label)
if planned: io.open(D,'w',encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already/absent)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
