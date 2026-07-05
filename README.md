# THE COACH — v2: real fixes + editorial polish (APP / OTA)

Fixes every issue from the device pass and lifts the design toward the Newsroom/Consult bar.

BUGS FIXED
- MARKDOWN now RENDERS. Lessons + Ask answers were showing raw #, **, --- — a new editorial
  renderer turns them into real headers (Fraunces), bold, bullets, rules, and code blocks.
- The \u2019 / escape BLEED is gone (real characters throughout, not JSX-literal escapes).
- "Mock test → Opening…" fixed. Each action now has its own busy state; buttons no longer
  cross-fire each other's loading labels.
- ASK flow fixed. The box CLEARS after you ask; your question shows above the rendered answer.
- BACK GESTURE now walks inward (lesson/quiz/ask → the course, then out) instead of jumping to
  the chat landing — wired through the app's own useBackLayer.
- Play "Shows" door subtitle dash fixed (was showing \u2014).

DESIGN
- Editorial lesson typography (rendered markdown), italic-serif subtitles, bolder Fraunces
  headers, hairline rules, more air — closer to the Consult/Newsroom feel.

## Apply + OTA
    cd /workspaces/z && unzip -o coach-v2.zip && python3 apply_coach_v2.py
    git add -A && git commit -m "coach v2: markdown render, escape/busy/ask/back fixes, polish" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach v2"

## STILL NEEDED — the mock
"Mock nothing renders" is the coach_mocks TABLE not existing. Run migrations/0041_coach_mocks.sql
in Supabase (it's in your repo). After v2, if it still fails you'll SEE the error text — send it.
