# THE TRAITORS — reality game v1 (phase 1: engine + curl-playable)

Social-deduction game: personas sit at a table, a few are secretly TRAITORS. Each round
= roundtable (everyone talks) → banish (everyone votes) → reveal (banished role shown).
FAITHFUL win when all traitors are banished; TRAITORS win at parity. The moat primitive =
information asymmetry: a spectator (watch) sees who's lying; the faithful don't.

Engine state machine + view asymmetry are UNIT-VERIFIED locally (21/21). The AI contestants'
talk + votes are model-driven → verify on the server (below). Real `npm run build` passes.

## Apply (SERVER)
    unzip -o traitors.zip
    python3 apply_traitors.py
    npm run build && git add -A && git commit -m "the traitors: reality game v1 (engine + endpoints)" && git push

## Curl-play (in your terminal; $BASE/$TOKEN already set)
    # 1) start a game — 5 AI personas, 1 traitor (defaults are fine)
    G=$(curl -s -X POST "$BASE/games/traitors/start" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" -d '{"personas":["the_comic","the_brainiac","the_historian","the_philosopher","the_wannabe"],"traitors":1}')
    echo "$G" | head -c 400; echo
    GID=$(echo "$G" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
    echo "game = $GID"

    # 2) step through phases — roundtable, then banish+reveal, then next round.
    #    run this a few times; each returns YOUR view (as caller you're a spectator → you see roles)
    curl -s -X POST "$BASE/games/traitors/$GID/step" -H "Authorization: Bearer $TOKEN"; echo

    # 3) spectator watch (sees the traitors — the dramatic irony)
    curl -s "$BASE/games/traitors/$GID/watch" -H "Authorization: Bearer $TOKEN"; echo

## What to look for
- start's "view" shows players; since you're not seated (humanPlays not set), you're a
  SPECTATOR → each player's role is visible (you can see who the traitor is).
- After a roundtable step, "log" fills with each persona's line — a traitor should deflect,
  faithful should probe. After a banish step, "lastBanished" shows who went and their role.
- Play until "winner" is set ("faithful" or "traitors").

## To play AS a contestant (you don't see roles): add "humanPlays":true to start, then
   pass your vote on the banish step: {"vote": SEAT_NUMBER}.

## Phase 1 scope (honest): single continuous game (no multi-day tasks yet), no UI, no
   directory surfacing, spectator = the watch endpoint (not yet streamed to the rooms list).
   Those are phases 2-4.
