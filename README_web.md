# Coach — WEB SEARCH ON for plans (SERVER, Railway)

When you name an exam, the coach now web-searches the CURRENT official syllabus/pattern first,
then builds the plan from that (not just the model's training memory). Uses the native
web_search_20250305 tool (same as your webEnabled personas). Real tsc passes; idempotent.

How it works:
- New fetchExamContext(topic) — a Haiku + web_search call that returns a short factual brief of
  the exam's current sections, question format/counts, marking, and any recent pattern changes.
- /coach/start calls it, then feeds the brief into generatePlan as ground truth. Cost: +1
  Haiku+web call per course start (tagged fn 'coach_exam_context'). NULL-safe: if web fails,
  the brief is empty and the plan falls back to training knowledge (no break).

## Apply (SERVER)
    cd /workspaces/z && unzip -o coach-web.zip && python3 apply_web.py
    npm run build && git add -A && git commit -m "coach: web-search current exam syllabus for plans" && git push

## Test (curl) — start a course for an exam whose pattern has changed recently
    curl -s -X POST "$BASE/coach/start" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"topic":"CAT 2026 quant","days":5}'; echo
    # the plan's day focuses should reflect the CURRENT sections/pattern, not an older one.
    # (takes a couple seconds longer than before — that's the web research step.)

## Notes
- Web is on the PLAN step (structure/syllabus = the thing that goes stale). Lessons teach the
  day's focus from knowledge; quizzes ground in uploaded material when present + the verify pass.
- FUTURE (logged): hand-authored exam CODEXES (CLAT/GMAT/NEET/UPSC/CAT) as the reliable spine.
