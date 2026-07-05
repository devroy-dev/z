import io, os, sys
C = 'src/coach.ts'
edits=[]
def E(old,new,label,marker=None): edits.append((old,new,label,marker))

# over-generate a buffer so verification can drop weak ones and still hit n
E("export async function generateQuiz(topic: string, focus: string, n: number, userId: string): Promise<MCQ[]> {",
  "export async function generateQuiz(topic: string, focus: string, n: number, userId: string): Promise<MCQ[]> {\n  const gen = Math.min(n + 3, 12);   // over-generate so the verify pass can drop weak keys and still hit n",
  "quiz gen buffer", marker="const gen = Math.min(n + 3, 12)")
E("Produce EXACTLY ${n} multiple-choice questions", "Produce EXACTLY ${gen} multiple-choice questions", "gen count in prompt", marker="EXACTLY ${gen}")
E("      if (clean.length === n) break;", "      if (clean.length === gen) break;", "gen count in loop", marker="clean.length === gen")
E("    return clean;\n  } catch (e: any) { console.error('[coach] quiz failed:', e?.message || e); return []; }\n}",
  "    const verified = await verifyQuiz(topic, clean, userId);\n    return verified.slice(0, n);\n  } catch (e: any) { console.error('[coach] quiz failed:', e?.message || e); return []; }\n}\n\n// PURE: apply an independent checker's verdicts — keep only questions the checker\n// confirmed (agreed answer, not unsure). If the checker returned nothing usable,\n// best-effort KEEP all (a verifier hiccup must not brick the day). Unit-tested.\nexport function applyVerdicts(questions: MCQ[], verdicts: { i: number; answer: number; unsure?: boolean }[]): MCQ[] {\n  const map = new Map<number, { answer: number; unsure: boolean }>();\n  for (const c of verdicts || []) {\n    const i = Number((c as any)?.i);\n    if (Number.isInteger(i)) map.set(i, { answer: Number((c as any)?.answer), unsure: !!(c as any)?.unsure });\n  }\n  if (map.size === 0) return questions;   // verifier gave nothing usable -> don't drop\n  return questions.filter((q, i) => { const v = map.get(i); return !!v && !v.unsure && v.answer === q.correct; });\n}\n\n// Independent verification: a SECOND model answers each question COLD (no key shown);\n// we keep only questions whose stored key matches the checker. The 'never trust one\n// generation' guard (same discipline that fixed the debate verdict). Best-effort on error.\nexport async function verifyQuiz(topic: string, questions: MCQ[], userId: string): Promise<MCQ[]> {\n  if (!questions.length) return questions;\n  const sys = `You are a meticulous exam answer-checker for \"${topic}\". You are given multiple-choice questions with their options but NOT the answer key. For EACH, independently work out the single best answer. If a question is ambiguous, flawed, or has no single clearly-correct option, mark it unsure. Output ONLY a JSON array: [{\"i\":0,\"answer\":2,\"unsure\":false}] where i is the 0-based question index (matching input order), answer is the 0-based option you judge correct, unsure is true when you cannot confidently pick one. No prose, no markdown.`;\n  const payload = questions.map((q, i) => ({ i, q: q.q, opts: q.opts }));\n  try {\n    const msg = await anthropic.messages.create({ model: MODEL, max_tokens: 1400, system: sys, messages: [{ role: 'user', content: JSON.stringify(payload) }] });\n    logUsage({ userId, surface: 'other', fn: 'coach_quiz_verify', model: MODEL, usage: (msg as any).usage });\n    return applyVerdicts(questions, parseJSONArray(textOf(msg)) as any);\n  } catch (e: any) { console.error('[coach] verify failed:', e?.message || e); return questions; }\n}",
  "wire verify into generateQuiz + add verifyQuiz/applyVerdicts", marker="export function applyVerdicts")

src=io.open(C,encoding='utf-8').read(); staged=src; planned,skipped=[],[]
for (old,new,label,marker) in edits:
    if (marker and marker in staged) or (not marker and old not in staged): skipped.append(label); continue
    if staged.count(old)!=1: print(f"  ! {label}: anchor x{staged.count(old)} — ABORT"); sys.exit(1)
    staged=staged.replace(old,new); planned.append(label)
if planned: io.open(C,'w',encoding='utf-8').write(staged)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"Staged {len(planned)}, skipped {len(skipped)}.")
