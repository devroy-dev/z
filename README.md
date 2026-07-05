# Coach Layer 4 — MOCK TESTS (SERVER)

Full timed mock exams that span the WHOLE course (every day-focus), grade deterministically,
and break the score down BY TOPIC so the student sees exactly where they're weak. Reuses the
proven quiz generation + verify pass + deterministic grading; grounds in uploaded material if present.
Per-topic breakdown unit-verified (5/5); real tsc passes.

## Contents
- 0041_coach_mocks.sql — z.coach_mocks (RUN IN SUPABASE FIRST)
- apply_mock.py         — generateMock + breakdownByTag + 2 endpoints

## Apply (SERVER)
    unzip -o coach-mock.zip
    # 1) run 0041_coach_mocks.sql in Supabase
    # 2) from repo root:
    python3 apply_mock.py
    npm run build && git add -A && git commit -m "coach L4: mock tests (full timed exam + per-topic breakdown)" && git push

## Test (curl) — on any course you've started
    # start a 12-question, 20-minute mock across the whole syllabus
    M=$(curl -s -X POST "$BASE/coach/$CID/mock/start" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"n":12,"minutes":20}')
    echo "$M" | head -c 300; echo
    MID=$(echo "$M" | grep -o '"mockId":"[^"]*"' | cut -d'"' -f4); echo "mock=$MID"

    # submit answers (0-based indexes, one per question) → score + per-topic breakdown
    curl -s -X POST "$BASE/coach/$CID/mock/$MID/submit" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"answers":[0,1,2,3,0,1,2,3,0,1,2,3]}'; echo

## What to look for
- mock/start returns ~n questions spanning ALL the plan's topics (not just one day), no answer keys
- takes a bit longer than a daily quiz (it generates + verifies across every focus)
- submit returns score/total, per-question reveals (correct+why), AND a "breakdown" by topic tag
  e.g. {"algebra":{"right":3,"total":5}, "geometry":{"right":2,"total":4}} — the weak-area map
- grounded:true if the course has uploaded material (questions drawn from it)
