# THE SHOWS — Play door: Traitors + Story Collab (APP / OTA)

A new door in Play → a landing with two games, each its own screen. Built to the coach-redesign
quality bar (warm-dark, Fraunces+Figtree, per-game accent). All 4 touched files babel-gate clean.

WHAT'S IN IT
- app/Shows.js — landing + both flows:
  · STORY COLLAB — pick writers (their voices set the genre), coherent/chaos, a premise, optionally
    write your own turns; step through; PUBLISH the finished story (shows byline + full text).
  · THE TRAITORS — seat 4-6 of the cast; you WATCH from above and see every role (the dramatic
    irony) while the faithful don't; step through roundtable talk → banishment → reveal → winner.
- app/api.js — traitorsStart/Step, storyStart/Step/Publish.
- app/Play.js — a "Shows" door (ember).
- app/App.js — routes the door to its own world (mode 'shows'), with back-layer.

## Apply + OTA (BOTH — git push does NOT update the device)
    cd /workspaces/z && unzip -o shows-ui.zip && python3 apply_shows.py
    git add -A && git commit -m "shows: Play door + Traitors + Story Collab screens" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "shows door"

Device: You → check for updates → FULLY close & reopen → Play tab → the "Shows" door → pick a game.

## Notes
- Traitors v1 is the WATCH experience (you see all roles). Human-as-player voting is a later add.
- Publishing a story: content-moderation must gate it before it's truly public (server TODO already
  flagged) — v1 finalises for you.
