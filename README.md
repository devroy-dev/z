# The coach REACTS to your score — in his voice (server + OTA)

The result card was ending on a flat "3/5". Now the coach says one honest, in-voice line
about it — never inflating, never shaming, pointing at what to tighten. Firewall held:
grading stays pure; this reacts to the numbers AFTER they're computed, and never touches a key.

Changes:
- src/coach.ts   — new coachReaction(): a short in-voice line built from the already-graded
                   score + weakTags (max_tokens 160, fn 'coach_reaction'). Returns '' on any error.
- src/index.ts   — the /grade endpoint computes it (score first, pure) and returns `reaction`.
- app/Coach.js   — the result card shows result.reaction, falling back to the old static line
                   if it's ever empty.

## Apply — SERVER first
    cd /workspaces/z && unzip -o coach-reaction.zip && python3 apply_coach_reaction.py
    npm run build        # real tsc — must be clean
    git add -A && git commit -m "coach: in-voice reaction on the result card" && git push
Railway rebuilds. You can curl /grade now and see a `reaction` field appear.

## Then OTA (for the card to render it)
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach result reaction"

## Curl to verify (server, after Railway rebuilds)
    curl -s -X POST "$BASE/coach/$CID/quiz" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"n":5}' >/dev/null
    curl -s -X POST "$BASE/coach/$CID/grade" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"answers":[0,0,0,0,0]}' | python3 -m json.tool
    # expect: score/total/results as before, PLUS a "reaction" line in his voice.
