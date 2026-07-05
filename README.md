# RoomChat keyboard fix — the black-gap glitch (OTA, app-only)

Bug: tapping the composer, then tapping outside, leaves a black empty gap near the chat.
Cause: RoomChat's content wasn't wrapped in a KeyboardAvoidingView, so with the app's
"pan" keyboard mode the layout didn't settle on keyboard show/hide. Chat.js (the 1:1
persona chat, which behaves) wraps its SafeAreaView in KeyboardAvoidingView behavior="padding".
This mirrors that in RoomChat — fixes the glitch for ALL rooms + DMs.

## Apply (OTA — repo root, then app/)
    cd /workspaces/z
    unzip -o roomchat-keyboard.zip
    python3 apply_roomchat_keyboard.py          # Staged 3, skipped 0
    cd /workspaces/z/app
    npx expo export
    CI=1 eas update --branch preview --environment preview -m "roomchat keyboard fix"
    # device: You → check for updates, reopen

## Verify
Open any room/DM → tap the message box (keyboard opens) → tap outside → the keyboard
dismisses cleanly with no black gap; composer sits at the bottom as normal.
