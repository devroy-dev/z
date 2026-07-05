# THE COACH — UI phase 1 (APP / OTA)

The coach surface, in your app's design idiom (C palette, Fraunces+Figtree, Grain, SafeArea).
Its own overlay surface (newsroom-style), reached from a desk notice card → routes to the 'coach' tab.
Phase 1 = the daily loop + a full mock. All 4 touched files pass the babel JSX syntax gate.
(COMPILES ≠ WORKS — device-verify after OTA.)

## What's in it
- app/Coach.js — the surface: start a course → plan → today's lesson → quiz → graded result
  (correct answers + why revealed, weak-tags shown) → continue to next day; plus a full MOCK
  (12Q/20min) with a per-topic breakdown. Resumes the active course via AsyncStorage.
- app/api.js — coachStart/Get/Lesson/Quiz/Grade/Ask/MockStart/MockSubmit/Shelf.
- app/Nav.js — 'coach' overlay wired (like the bulletin).
- app/Desk.js — a "the study desk" notice card → routes to the coach.

## Apply + deploy (APP = git push AND OTA; run from the right dirs)
    cd /workspaces/z
    unzip -o coach-ui.zip
    python3 apply_coach_ui.py
    npx expo export --output-dir dist >/dev/null 2>&1 || true   # optional local sanity
    git add -A && git commit -m "coach UI phase 1: study desk surface" && git push
    cd app && npx expo export && CI=1 eas update --branch preview --environment preview -m "coach UI phase 1"

Then on the device: You → check for updates (the OTA lever), reopen.

## Test on device
- Open the Desk; look for the "the study desk" notice (it rotates in) → tap it.
- Name an exam (e.g. "CLAT legal reasoning"), pick days, Build my plan.
- Start day 1 → read the lesson → take the quiz → submit → see the graded result with the
  correct answers, the why, and your weak tags → Continue to day 2.
- Try "Take a full mock test" → answer → see the per-topic breakdown.

## Honest notes
- ENTRY: it's a rotating desk notice for now (reachable, but not always visible). For the paid
  flagship you may want a PERMANENT/prominent entry — a nav tab, a pinned desk card, or a Play
  door. Tell me which and it's a small follow-up.
- Phase 2: MATERIAL UPLOAD in-app (expo DocumentPicker → base64 → /coach/:id/material) so users
  can "upload a chapter and be taught from it" from the phone. Engine's ready; just needs the picker UI.
- "the coach" is not yet a full chat persona (no codex/face) — this surface is the front door.
