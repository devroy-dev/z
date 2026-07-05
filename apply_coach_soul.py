import io, os, sys
edits=[]
def E(path,old,new,label,marker=None): edits.append((path,old,new,label,marker))
PS='src/personas.ts'; CT='src/content.ts'; C='src/coach.ts'

E(PS,"| 'colleague' | 'anchor' | 'grandmaster' | 'conspiracy';",
  "| 'colleague' | 'anchor' | 'grandmaster' | 'conspiracy' | 'coach';",
  "CodexKey +coach", marker="'conspiracy' | 'coach'")

E(PS,"  the_grandmaster:  { key: 'the_grandmaster',  defaultName: 'the Grand Master',  codex: 'grandmaster', webEnabled: true  },",
  "  the_grandmaster:  { key: 'the_grandmaster',  defaultName: 'the Grand Master',  codex: 'grandmaster', webEnabled: true  },\n  the_coach:        { key: 'the_coach',        defaultName: 'the coach',        codex: 'coach',      webEnabled: true  },",
  "PERSONAS +the_coach", marker="the_coach:        { key: 'the_coach'")

E(CT,"  conspiracy:     'codex-conspiracy.md',\n};",
  "  conspiracy:     'codex-conspiracy.md',\n  coach:          'codex-coach.md',\n};",
  "CODEX_FILES +coach", marker="coach:          'codex-coach.md'")

E(C,"import { embedQueryLiteral } from './coachEmbed.js';",
  "import { embedQueryLiteral } from './coachEmbed.js';\nimport { codexText } from './content.js';",
  "coach import codexText", marker="import { codexText } from './content.js'")

E(C,"const MODEL = 'claude-haiku-4-5-20251001';",
  """const MODEL = 'claude-haiku-4-5-20251001';

// The coach's SOUL — his voice/manner, loaded once. It colors HOW he teaches and
// answers; it never touches WHAT is correct (quiz keys, verify, grading stay pure).
const COACH_VOICE = (() => { try { return codexText('coach') || ''; } catch { return ''; } })();
function inVoice(task: string): string {
  if (!COACH_VOICE) return task;
  return `[WHO YOU ARE — this is you, right now, in the room with a student. Your voice, your manner, how you explain, how you react to a score — all of it comes from here. You never name it, never point to it, never call it a character or a codex; there is only you, being yourself.]\\n${COACH_VOICE}\\n\\n[WHAT YOU ARE DOING RIGHT NOW]\\n${task}`;
}""",
  "coach voice frame", marker="function inVoice(task: string)")

# LESSON call → in-voice (anchor on unique `content: userMsg`)
E(C,"max_tokens: 1400, system: sys, messages: [{ role: 'user', content: userMsg }]",
  "max_tokens: 1400, system: inVoice(sys), messages: [{ role: 'user', content: userMsg }]",
  "lesson in-voice", marker="system: inVoice(sys), messages: [{ role: 'user', content: userMsg }]")

# ASK call → in-voice (anchor on unique max_tokens: 1200)
E(C,"max_tokens: 1200, system: sys,",
  "max_tokens: 1200, system: inVoice(sys),",
  "ask in-voice", marker="max_tokens: 1200, system: inVoice(sys)")
# NOTE: generatePlan (line 83) and verifyQuiz (line 205) deliberately left pure.

if os.path.isfile('codex-coach.md') and not os.path.isfile('content/codex-coach.md'):
    io.open('content/codex-coach.md','w',encoding='utf-8').write(io.open('codex-coach.md',encoding='utf-8').read()); print("  + content/codex-coach.md")
elif os.path.isfile('content/codex-coach.md'): print("  = content/codex-coach.md (already)")

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
