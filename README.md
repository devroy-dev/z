# THE COACH — full redesign (APP / OTA)

The engine was already producing rich, web-grounded plans (each day a full title + focus
paragraph) — the old UI hid all of it. This rebuild SURFACES that depth and fixes the flow.

WHAT CHANGED
- The SYLLABUS is now a progress SPINE: a connected vertical journey, each day showing its
  FULL focus paragraph (was hidden), the current day glowing, done days carrying their score.
- Segmented progress bar under the exam title (day X of N at a glance).
- Surfaced actions: "Mock test" + "Ask the coach" (the /ask endpoint existed but was never shown).
- Polished lesson (real reading type), quiz (progress + clean option states), result (score reveal
  + per-question review), and mock RESULT with a per-topic bar breakdown.
- Errors are now VISIBLE with direction (so "nothing renders" becomes a readable message).
- Day-length picker (5/7/14/30) instead of a bare number field.

## Apply + OTA (BOTH — git push does NOT update the device)
    cd /workspaces/z && unzip -o coach-redesign.zip && python3 apply_coach_redesign.py
    git add -A && git commit -m "coach UI: full redesign (spine, depth, ask, polished flow)" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach redesign"

Device: You → check for updates → FULLY close & reopen → the Coach.

## IMPORTANT — the mock "nothing renders" bug
That is almost certainly the mocks TABLE not existing yet. Run this in Supabase SQL editor if you
haven't (it ships in your repo at migrations/0041_coach_mocks.sql):
  the contents of migrations/0041_coach_mocks.sql
After the redesign, if the mock still fails you'll now SEE the error text (not a blank) — send it to me.

## Still to come (honest)
- MATERIAL UPLOAD in-app needs expo-document-picker (a native dep) → a native build, not OTA.
  The engine + /ask grounding already work; the upload button is deferred to that build.
