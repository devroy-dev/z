import io, os, sys
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))

# 1) api.js helpers
A='app/api.js'
E(A,"export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }",
  """export async function coachShelf(id) { return authedJSON('GET', `/coach/${id}/shelf`); }

// ── SHOWS: Traitors + Story Collab ──
export async function traitorsStart(personas, opts) { return authedJSON('POST', '/games/traitors/start', { personas, ...(opts || {}) }); }
export async function traitorsStep(id, move) { return authedJSON('POST', `/games/traitors/${id}/step`, move || {}); }
export async function storyStart(personas, opts) { return authedJSON('POST', '/games/story/start', { personas, ...(opts || {}) }); }
export async function storyStep(id, text) { return authedJSON('POST', `/games/story/${id}/step`, text !== undefined ? { text } : {}); }
export async function storyPublish(id) { return authedJSON('POST', `/games/story/${id}/publish`, {}); }""",
  "api shows helpers", marker="SHOWS: Traitors + Story Collab")

# 2) Play.js — a Shows door before </ScrollView>
PL='app/Play.js'
SHOWS_DOOR = '''          <Door
            tone="#E7B07A" kicker="the cast performs" title="Shows" delay={2400}
            line="the traitors, story collab \\u2014 social games where the personas perform and you play along."
            onPress={() => onEnter('shows')}
            glyph={
              <Svg width="34" height="34" viewBox="0 0 24 24">
                <Path d="M4 5h16v11H4zM8 20h8M12 16v4" stroke="#E7B07A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            }
          />
        </ScrollView>'''
E(PL,"        </ScrollView>\n      </SafeAreaView>",
  SHOWS_DOOR + "\n      </SafeAreaView>",
  "play shows door", marker='title="Shows"')

# 3) App.js — import, mode render, back layer, onEnter
AP='app/App.js'
E(AP,"import Sims from './Sims';","import Sims from './Sims';\nimport Shows from './Shows';","app import Shows", marker="import Shows from './Shows'")
E(AP,"  useBackLayer(mode === 'sims', React.useCallback(() => { setMode('choose'); return true; }, []));",
  "  useBackLayer(mode === 'sims', React.useCallback(() => { setMode('choose'); return true; }, []));\n  useBackLayer(mode === 'shows', React.useCallback(() => { setMode('choose'); return true; }, []));",
  "app shows backlayer", marker="mode === 'shows', React.useCallback")
E(AP,"  if (mode === 'sims') {",
  "  if (mode === 'shows') {\n    return <Shows onBack={() => setMode('choose')} />;\n  }\n  if (mode === 'sims') {",
  "app shows render", marker="if (mode === 'shows') {")
E(AP,"else if (door === 'sims') setMode('sims'); }} />;",
  "else if (door === 'sims') setMode('sims'); else if (door === 'shows') setMode('shows'); }} />;",
  "app onEnter shows", marker="door === 'shows') setMode('shows')")

# place Shows.js
if os.path.isfile('Shows.js') and not os.path.isfile('app/Shows.js'):
    io.open('app/Shows.js','w',encoding='utf-8').write(io.open('Shows.js',encoding='utf-8').read()); print("  + app/Shows.js")
elif os.path.isfile('app/Shows.js'): print("  = app/Shows.js (already)")

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
