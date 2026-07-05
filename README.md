# THE COACH — gets a SOUL (server)

The coach was an engine with no character. Now he's a person: a 50/50 blend of the
electric, fun-forward substitute and the fierce believe-in-you, never-lower-the-bar
teacher. This wires that soul into the product.

WHAT THIS DOES
- Adds his codex: content/codex-coach.md (your authored soul, verbatim).
- Registers "the coach" as a REAL persona (src/personas.ts) — web ON — so he can be
  chatted with directly, like the anchor. (codex key 'coach' + CODEX_FILES mapping.)
- Threads his VOICE into the two teaching surfaces:
    • generateLesson  → lessons now speak in his voice
    • answerFromMaterial (Ask the coach) → answers in his voice

THE FIREWALL (held, verified)
The soul colors HOW he teaches, never WHAT is correct. Only lesson + ask are in-voice.
generatePlan, generateQuiz, verifyQuiz, and the deterministic gradeAnswers are LEFT PURE
— the answer key never sees the soul. "Teach the reasoning like a rockstar, report the
results like an honest man."

## Apply (server only — no OTA; codex deploys with the push)
    cd /workspaces/z && unzip -o coach-soul.zip && python3 apply_coach_soul.py
    npm run build          # real tsc — must say clean
    git add -A && git commit -m "the coach: soul (codex + persona + in-voice lessons/ask)" && git push
Railway rebuilds. Then in the app, open a course and start a lesson — it should now read
in his voice (high-energy, plain words, an everyday analogy, honest). Try "Ask the coach" too.

## NEXT (small, needs your ruling — I didn't guess the UI)
He's now a real persona, but the app has no button to open his FREE chat yet (the
"the Coach" row opens the course). Cleanest mirror of the anchor: inside the course,
an entry that opens his persona chat — OR make the row itself offer "chat vs course."
Tell me which and I'll wire it (app/OTA).

Also queued: an in-voice RESULT reaction (he reacts to your score in character — "four
of twelve, cheerful, no shame, here are the eight that slipped"). Small server + Coach.js add.
