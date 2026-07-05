import io, os, sys
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))

# ── api.js: coach calls ──
A='app/api.js'
E(A,"export async function getBulletinFeed() {",
  """// ── THE COACH ──
export async function coachStart(topic, days) { return authedJSON('POST', '/coach/start', { topic, days }); }
export async function coachGet(id) { return authedJSON('GET', `/coach/${id}`); }
export async function coachLesson(id) { return authedJSON('POST', `/coach/${id}/lesson`); }
export async function coachQuiz(id, n) { return authedJSON('POST', `/coach/${id}/quiz`, { n }); }
export async function coachGrade(id, answers) { return authedJSON('POST', `/coach/${id}/grade`, { answers }); }
export async function coachAsk(id, question) { return authedJSON('POST', `/coach/${id}/ask`, { question }); }
export async function coachMockStart(id, n, minutes) { return authedJSON('POST', `/coach/${id}/mock/start`, { n, minutes }); }
export async function coachMockSubmit(id, mockId, answers) { return authedJSON('POST', `/coach/${id}/mock/${mockId}/submit`, { answers }); }
export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }

export async function getBulletinFeed() {""",
  "api coach calls", marker="export async function coachStart")

# ── Nav.js: import + overlay tab + overlay render ──
N='app/Nav.js'
E(N,"import Bulletin from './Bulletin';",
  "import Bulletin from './Bulletin';\nimport Coach from './Coach';",
  "nav import coach", marker="import Coach from './Coach'")
E(N,"if (tab === 'quiet' || tab === 'stage' || tab === 'journal' || tab === 'bulletin') {",
  "if (tab === 'quiet' || tab === 'stage' || tab === 'journal' || tab === 'bulletin' || tab === 'coach') {",
  "nav coach overlay tab", marker="|| tab === 'coach'")
E(N,"    if (overlay.tab === 'bulletin') return (",
  "    if (overlay.tab === 'coach') return <Coach onBack={() => setOverlay(null)} />;\n    if (overlay.tab === 'bulletin') return (",
  "nav coach overlay render", marker="overlay.tab === 'coach'")

# ── Desk.js: coach hook card + route ──
D='app/Desk.js'
E(D,"      { key: 'the_anchor', tone: '#E0C088', kicker: 'from the news desk', line: `the anchor has the ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : '9 o’clock'} bulletin ready` },",
  "      { key: 'the_anchor', tone: '#E0C088', kicker: 'from the news desk', line: `the anchor has the ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : '9 o’clock'} bulletin ready` },\n      { key: 'the_coach', tone: '#E7B07A', kicker: 'the study desk', line: 'name an exam — the coach builds your day-by-day plan' },",
  "desk coach hook", marker="key: 'the_coach'")
E(D,"    if (key === 'the_anchor') return onRoute({ tab: 'bulletin' });",
  "    if (key === 'the_anchor') return onRoute({ tab: 'bulletin' });\n    if (key === 'the_coach') return onRoute({ tab: 'coach' });",
  "desk coach route", marker="key === 'the_coach'")

# place Coach.js
if os.path.isfile('Coach.js') and not os.path.isfile('app/Coach.js'):
    io.open('app/Coach.js','w',encoding='utf-8').write(io.open('Coach.js',encoding='utf-8').read()); print("  + app/Coach.js")
elif os.path.isfile('app/Coach.js'): print("  = app/Coach.js (already)")

cache={}
def load(p):
    if p not in cache: cache[p]=io.open(p,encoding='utf-8').read()
    return cache[p]
planned,skipped=[],[]
for (path,old,new,label,marker) in edits:
    s=load(path)
    if (marker and marker in s) or (not marker and old not in s): skipped.append(label); continue
    if s.count(old)!=1: print(f"  ! {label}: anchor x{s.count(old)} in {path} — ABORT"); sys.exit(1)
    cache[path]=s.replace(old,new); planned.append(label)
for p,c in cache.items(): io.open(p,'w',encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
