# Coach accuracy-hardening — the verify pass (SERVER)

Protects the paid product from a wrong model-generated answer key. Edits committed coach.ts in place.
Verified: applyVerdicts filter unit-tested (7/7), grading no-regression, real tsc OK.

How it works:
- generateQuiz now OVER-generates a few extra questions (n+3), then runs verifyQuiz.
- verifyQuiz asks a SECOND independent model to answer each question COLD (no key shown).
- Only questions whose STORED key matches the checker survive (applyVerdicts). Ambiguous/unsure
  questions are dropped. Then it slices to n. So a wrong or ambiguous key never reaches a student.
- Best-effort: if the verifier errors or returns nothing usable, questions pass through unfiltered
  (a verifier outage must not brick the day). Genuine all-disagree → empty → endpoint says "try again".

## Apply (SERVER)
    unzip -o coach-verify.zip
    python3 apply_verify.py
    npm run build && git add -A && git commit -m "coach: quiz verify pass (independent answer-key check)" && git push

## Verify on device
Run the same /coach/:id/quiz curl a few times across different exams (try a numerical one like
NEET physics or JEE math, where wrong keys are likeliest). Every returned question's key should now
survive an independent check. Cost: +1 Haiku call per quiz (the checker), tagged fn 'coach_quiz_verify'.
