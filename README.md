# THE COACH — tutoring engine v1 (Layer 1: core teaching loop)

Name any exam or topic → a day-by-day plan → per-day lesson → MCQ quiz → DETERMINISTIC
grade (answer key stored server-side; graded by exact index match — no model in the loop,
trustworthy for a paid product) → weak-spot detection → the next day ADAPTS to what you missed.
Exam-agnostic (GMAT/SAT/IIT-JEE/CAT/UPSC/CLAT/NEET/GRE/foreign or any topic).
Grading + "answer key never leaks to client" are UNIT-VERIFIED locally (7/7). Real tsc passes.

## Contents
- 0039_coach.sql   — z.coach_courses (RUN IN SUPABASE FIRST)
- coach.ts         — engine: generatePlan/Lesson/Quiz + gradeAnswers (pure)
- apply_coach.py   — places files + wires 5 endpoints into index.ts

## Apply (SERVER)
    unzip -o coach.zip
    # 1) run 0039_coach.sql in Supabase
    # 2) from repo root:
    python3 apply_coach.py
    npm run build && git add -A && git commit -m "the coach: tutoring engine v1 (plan/lesson/quiz/grade/adapt)" && git push

## Curl-play (in your terminal; $BASE/$TOKEN set)
    # 1) start — coach me for CLAT legal reasoning, 5-day sprint
    C=$(curl -s -X POST "$BASE/coach/start" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"topic":"CLAT legal reasoning","days":5}')
    echo "$C"; CID=$(echo "$C" | grep -o '"courseId":"[^"]*"' | cut -d'"' -f4); echo "course=$CID"

    # 2) today's lesson
    curl -s -X POST "$BASE/coach/$CID/lesson" -H "Authorization: Bearer $TOKEN"; echo

    # 3) today's quiz (no answer key returned)
    curl -s -X POST "$BASE/coach/$CID/quiz" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"n":5}'; echo

    # 4) submit answers (0-based option indexes) → score + reveals + weak spots + advances the day
    curl -s -X POST "$BASE/coach/$CID/grade" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"answers":[0,1,2,1,3]}'; echo

    # 5) progress
    curl -s "$BASE/coach/$CID" -H "Authorization: Bearer $TOKEN"; echo

## What to look for
- the plan reads like a real sequenced syllabus for that exam
- the lesson actually TEACHES (idea → worked example → exam tip)
- the quiz is exam-realistic; grade returns each question's correct index + a one-line WHY
- after a graded day, weakTags accumulate and the NEXT day's lesson reinforces them

## Honest v1 scope / next
- ACCURACY HARDENING (fast-follow, important for paid): add a verify pass that double-checks
  each MCQ's key before it's stored, so a bad-key can never reach a paying student. v1 relies on
  strong generation constraints; grading itself is already deterministic.
- Layer 2 progress persistence is largely here (courses persist, days advance, weak spots carry).
- Layer 3 = bring-your-own-material (PORT the dreamai RAG). Layer 4 = full mock tests.
- Persona link ("the coach" front door), and the Play/coach surface, are UI — later.
