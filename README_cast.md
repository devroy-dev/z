# Coach entry fix — permanent cast-row seat (APP / OTA)

The coach was a rotating desk notice (only sometimes visible). This pins it permanently in
"the gathering, at the door" cast row alongside newsroom / z / grandmaster, and removes the
flaky rotating hook. Route already live (→ coach tab). Babel-gated. Edits app/Desk.js only.

## Apply + OTA
    cd /workspaces/z
    unzip -o coach-cast.zip
    python3 apply_cast.py
    git add -A && git commit -m "coach: permanent cast-row entry" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach cast-row entry"

Then device: You → check for updates → reopen → Desk → the "coach" seat in the cast row (with
newsroom, z…) → tap it.

## Face (optional, later)
Avatars pull from https://callmez.app/faces/<key>.jpg — drop a file at public/faces/the_coach.jpg
in the repo and `git push` (faces deploy with pushes). Until then the coach shows a clean bordered
circle labeled "coach" — functional, just faceless.
