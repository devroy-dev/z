# Coach Layer 3 — sub-step B: RETRIEVAL + teach-from-material (SERVER)

Now the shelf becomes teaching. When a course has uploaded material, the coach grounds in it
(your ruling: always ground when present). Real tsc passes; grading/verify no-regression.

What it adds:
- retrieveForCourse — course-scoped fused retrieval (FTS ⊕ vector RRF) via z.coach_search_sections,
  embedding the query with Voyage; returns the top §s with citations.
- generateLesson / generateQuiz now take the retrieved material and TEACH/QUIZ from it, citing (§, p.).
  (The verify pass still guards quiz keys.)
- /lesson and /quiz auto-retrieve the day's-focus material and ground; responses carry grounded + citations.
- NEW: POST /coach/:id/ask {question} — ask anything; answered from your material with citations.

## Apply (SERVER) — no new migration; uses 0040's tables/RPC
    unzip -o coach-rag-teach.zip
    python3 apply_ground.py
    npm run build && git add -A && git commit -m "coach L3b: retrieval + teach/quiz/ask from material" && git push

## Test (curl) — on the course you already uploaded the tender note into
    # ask directly from the material
    curl -s -X POST "$BASE/coach/$CID/ask" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"question":"Which bidder was recommended and at what negotiated price?"}'; echo
    # → answer should say Saryu Constructions at Rs 3.28 crore, citing the § (e.g. §3.1, p.1)

    # a grounded lesson (day focus retrieves matching §s)
    curl -s -X POST "$BASE/coach/$CID/lesson" -H "Authorization: Bearer $TOKEN"; echo
    # → response carries "grounded": true and "citations":[{ref,page,title}]

## What to look for
- /ask returns the EXACT figure (Rs 3.28 crore, Saryu) with a §/page citation — proof it read the doc.
- /lesson and /quiz show grounded:true and cite the material when the course has a Brief.
- A course with NO material still works (grounded:false, teaches generically) — NULL-safe retrieval.
