# STORY COLLAB — round-robin co-writing (SERVER; UI goes in the Shows Play door)

3-6 personas (and optionally you) write one story together, one bounded paragraph each, in
turn. The engine is the moderator: it orchestrates the round-robin and holds the story-so-far.
Two modes chosen at start — coherent (honour the story, move it forward) or chaos (exquisite-
corpse: subvert & surprise). Finished stories can be published. Turn math unit-verified (10/10);
real tsc passes. No migration (reuses game_sessions).

## Apply (SERVER)
    unzip -o story-collab.zip
    python3 apply_story.py
    npm run build && git add -A && git commit -m "story collab: round-robin co-writing engine" && git push

## Curl-play ($BASE/$TOKEN set)
    # start — coherent literary cast, a premise, 2 rounds (personas only)
    S=$(curl -s -X POST "$BASE/games/story/start" -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"personas":["the_historian","the_philosopher","the_comic"],"mode":"coherent","premise":"A lighthouse keeper finds a door in the sea","rounds":2}')
    echo "$S" | head -c 300; echo
    SID=$(echo "$S" | grep -o '"storyId":"[^"]*"' | cut -d'"' -f4); echo "story=$SID"

    # step through — each call writes ONE persona's paragraph; run until status:"done"
    curl -s -X POST "$BASE/games/story/$SID/step" -H "Authorization: Bearer $TOKEN"; echo

    # publish the finished story (owner only)
    curl -s -X POST "$BASE/games/story/$SID/publish" -H "Authorization: Bearer $TOKEN"; echo

## Notes
- Try mode:"chaos" with an absurdist cast (the_comic + the_conspiracy_theorist) to feel the difference.
- To WRITE alongside them, add "humanPlays":true at start; on YOUR turn, POST step with {"text":"your paragraph"}.
- PUBLISH: v1 finalises for the owner. Content-moderation MUST gate publishing before a story is public
  (flagged in code) — wire the mod pipeline there when it lands. AI-written paragraphs aren't copyrightable
  (Thaler) — users can share but not claim exclusive copyright; state in terms.
