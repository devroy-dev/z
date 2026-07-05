# RoomChat convergence — 1:1 human DM reads like the 1:1 chat (OTA)

Finding: RoomChat's composer + bubbles were ALREADY essentially Chat.js's. The awkwardness
was DM-only room chrome (a DM = a room with no personas). This strips it so a 1:1 human DM
looks like the 1:1 persona chat; group/persona rooms are untouched (they keep their rail +
header, which they need). One bubble-notch alignment applies everywhere.

## What changes (app/RoomChat.js only)
- DM: neutral background (the persona-colour gradient is meaningless with no persona).
- DM: no presence rail (a lone floating face for a 1:1 looked half-empty).
- DM: no 'manage' button, no speaker-name label over each incoming bubble.
- All: sent bubble notches the top corner (matches Chat.js), not the bottom.

## Apply (OTA — from repo root, then app/)
    unzip -o roomchat-dm.zip
    python3 apply_roomchat_dm.py
    cd app && npx expo export
    CI=1 eas update --branch preview --environment preview -m "roomchat DM convergence"
    # device: You → check for updates, reopen

## Verify
- Open a human↔human DM: no rail, clean header (peer name), no name-label over their bubbles,
  neutral background — it should feel like a 1:1 persona chat.
- Open a persona/group room: unchanged — rail, header, invite/play all still there.
