import io, os, sys
edits=[]
def E(path,old,new,label,marker): edits.append((path,old,new,label,marker))
C='src/coach.ts'; IDX='src/index.ts'; APP='app/Coach.js'

# 1) coach.ts: the in-voice reaction fn (inserted before answerFromMaterial). Pure grade
#    is done elsewhere; this only reacts to the already-computed numbers.
REACT = (
"// The coach REACTS to a score, in his voice — layered on TOP of the pure grade.\n"
"// Takes the already-computed numbers as facts; it never grades and never touches a key.\n"
"export async function coachReaction(topic: string, score: number, total: number, weakTags: string[], userId: string): Promise<string> {\n"
"  const weak = (weakTags && weakTags.length) ? ` What slipped was about: ${weakTags.join(', ')}.` : '';\n"
"  const task = `A student just finished a \"${topic}\" quiz and scored ${score} out of ${total}.${weak} React in ONE or TWO short sentences, in your own voice — honest about the number (never inflate it, never shame it), and point them at what to tighten next. This is the single line they see on their result screen. Tight, human, plain text, no lists.`;\n"
"  try {\n"
"    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 160, system: inVoice(task), messages: [{ role: 'user', content: `Result: ${score}/${total}` }] });\n"
"    logUsage({ userId, surface: 'other', fn: 'coach_reaction', model: MODEL, usage: (msg as any).usage });\n"
"    return textOf(msg).trim();\n"
"  } catch (e: any) { console.error('[coach] reaction failed:', e?.message || e); return ''; }\n"
"}\n\n"
)
E(C,
  "export async function answerFromMaterial(topic: string, question: string, material: string, userId: string): Promise<string> {",
  REACT + "export async function answerFromMaterial(topic: string, question: string, material: string, userId: string): Promise<string> {",
  "coach.ts: coachReaction fn", "export async function coachReaction(")

# 2) index.ts: import coachReaction
E(IDX,
  "import { retrieveForCourse, materialFromSections, answerFromMaterial, generateMock, breakdownByTag } from './coach.js';",
  "import { retrieveForCourse, materialFromSections, answerFromMaterial, generateMock, breakdownByTag, coachReaction } from './coach.js';",
  "index.ts: import coachReaction", "breakdownByTag, coachReaction }")

# 3) index.ts: compute reaction (score already computed) + add to grade response
E(IDX,
  "    res.json({ day, score: graded.score, total: graded.total, results: graded.perQuestion, weakTags, nextDay: lastDay ? null : nextDay, done: lastDay });",
  "    const reaction = await coachReaction(c.topic, graded.score, graded.total, graded.weakTags, user.id).catch(() => '');\n    res.json({ day, score: graded.score, total: graded.total, results: graded.perQuestion, weakTags, reaction, nextDay: lastDay ? null : nextDay, done: lastDay });",
  "index.ts: grade returns reaction", "const reaction = await coachReaction(c.topic")

# 4) Coach.js: show the in-voice reaction, static line as fallback
E(APP,
  """        <Text style={s.scoreLine}>{result.score === result.total ? 'Clean sweep.' : result.score >= result.total / 2 ? 'Solid — a few to tighten.' : "Tricky set — we'll reinforce these."}</Text>""",
  """        <Text style={s.scoreLine}>{result.reaction || (result.score === result.total ? 'Clean sweep.' : result.score >= result.total / 2 ? 'Solid — a few to tighten.' : "Tricky set — we'll reinforce these.")}</Text>""",
  "Coach.js: show reaction", "result.reaction || (result.score")

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
