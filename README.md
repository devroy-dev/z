# persona roster cleanup + front-desk manifest (one zip: server + app)

Roster 33 → 30. Verified: real `npm run build` (tsc) passes, `Roster.js` JSX parses,
patcher is transactional + idempotent. Server = Railway push; app = OTA.

## What it does
- **CUT** the stranger + the guardian angel (self_obsessed) — off roster, routing, blurbs, pursuits, app.
- **MERGE** the cynic → the comic (broadened to "dark wit"); the leader of opposition → the brainiac.
- **RELABEL** the brainiac → "the devil's advocate"; the economist → "the money man".
  Keys stay `the_brainiac` / `the_economist` (threads + faces survive); codex reused, soul refined later.
- **ADD** the conspiracy theorist — new key, new soul (`content/codex-conspiracy.md`), **WEB ON**.
- **Retired keys forward** (personaByKey): cynic→comic, leader_opp→brainiac, stranger→healer,
  self_obsessed→mentor — so no existing thread ever 404s.
- **Games untouched** — `resolveStyle()` already falls back for unknown keys.
- Also cleaned stray casts: the stage default cast, the room `FILLERS`, and the `hold_your_ground` arc.

## APPLY — order matters
    unzip -o persona-cleanup.zip
    cp codex-conspiracy.md content/codex-conspiracy.md      # MUST exist before the build (deploys with the push)
    python3 apply_persona_cleanup.py
    # SERVER (Railway):
    npm run build
    git add -A && git commit -m "persona roster cleanup + front-desk manifest (33→30)" && git push
    # APP (OTA — from app/, to the branch your device runs):
    cd app && npx expo export
    eas update --branch preview --environment preview -m "persona roster cleanup" --non-interactive

## One asset to add
- **`public/faces/the_conspiracy_theorist.jpg`** — until it's there, the conspiracy theorist shows the
  orb fallback (harmless). Devil's advocate + money man reuse the existing brainiac/economist faces (keys unchanged).

## Deferred to the follow-up soul pass (deliberate — you approve souls)
- Refine the reused codex souls for the merges/relabel: devil's advocate fully absorbing the leader-of-opposition
  edge; the money man's advisor + not-licensed layer; the comic absorbing the cynic's dark wit.
- Profile blurbs for economist/comic left as-is (updated brainiac + added conspiracy now); refine with the souls.
- Full app-display cleanup beyond Roster.js (stage/library.js, games/personas.js, Desk/Chat cast lists) —
  non-breaking via forwarding + face/name fallback; tidy when convenient.
