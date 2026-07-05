# Traitors polish — rounds 2+ land as well as round 1 (SERVER)

Two fixes to the committed traitors.ts (edits it in place; verified: local logic test 21/21, tsc OK):
1. reveal → next roundtable now falls through in ONE step (no more empty "dead" step between rounds).
2. the last banishment outcome is fed into the talk + vote prompts ("X was banished, was FAITHFUL —
   the table got it wrong, a traitor's still among you"), so reasoning compounds across rounds.

## Apply (SERVER)
    unzip -o traitors-polish.zip
    python3 apply_traitras_polish.py   # (filename below; Staged 5)
    npm run build && git add -A && git commit -m "traitors polish: reveal falls through + banish recap" && git push

## Verify (same game as before, or start fresh)
Each step from a reveal now immediately produces the next round's roundtable (no empty step), and
round 2+ lines should reference who got banished and whether the table was right.
