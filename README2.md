# RoomChat: DM convergence + peer DP  (SUPERSEDES roomchat-dm.zip — apply only this one)

Makes a 1:1 human DM read like the 1:1 persona chat, AND shows the person in the header:
their DP if set, their initials circle otherwise — like a persona chat shows its face.
Touches SERVER (send member avatars) + APP (render the DP). Idempotent.

## What changes
- SERVER `src/index.ts` — `/rooms/:id/members` now returns `avatars` (uid → avatar_url)
  alongside `members`. Non-breaking (new field).
- APP `app/RoomChat.js`:
  - DM: neutral background (no persona → no persona-colour gradient), no presence rail,
    no 'manage', no speaker-name label.
  - DM header: a DP circle (photo or initials) next to the peer's name — like a persona DP.
  - Sent bubble notch aligned to Chat.js (all rooms).
  Group/persona rooms are unchanged.

## Apply — SERVER first, then APP
    unzip -o roomchat-dm2.zip
    python3 apply_roomchat_dm2.py
    # SERVER (Railway):
    npm run build && git add -A && git commit -m "DM: converge on chat surface + peer DP" && git push
    # APP (OTA):
    cd app && npx expo export
    CI=1 eas update --branch preview --environment preview -m "DM convergence + peer DP"
    # device: You → check for updates, reopen

## Verify
Open a DM: header shows the person's photo (or their initials if they haven't set one) next to
their name; no rail; clean 1:1 feel. Group/persona rooms look exactly as before.
