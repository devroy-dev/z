# Ask the coach → opens a real chat with him (APP / OTA)

Mirrors the Newsroom's "ask the anchor." Tapping "Ask the coach" on the study desk now
opens a live chat with the coach persona (the_coach) — in his voice, web-on — instead of
the old course-scoped ask panel. Simple, same pattern as the anchor.

3 edits:
- Nav.js — passes onAskCoach to <Coach>, wired to navigate({ tab:'gathering', persona:'the_coach' }).
- Coach.js — accepts the onAskCoach prop.
- Coach.js — the "Ask the coach" tile now calls onAskCoach (was the course-scoped 'ask' stage).

## Apply + OTA
    cd /workspaces/z && unzip -o coach-chat.zip && python3 apply_coach_chat.py
    git add -A && git commit -m "ask the coach → opens the coach persona chat" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "ask the coach → chat"

## Note
His chat works now (he's a registered persona). The only cosmetic gap: no face at
public/faces/the_coach.jpg yet, so the chat shows a default avatar until you drop one in
(deploys with a git push, like the other faces). Not blocking.
