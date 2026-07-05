# Coach visible — move to FRONT of the cast row (APP / OTA)

The coach was appended at the END of the horizontal cast row, so it sat off the right edge
(you'd have to scroll sideways). This moves it to the FIRST seat — visible immediately.

REQUIRES OTA — git push alone does NOT update your device. You MUST run eas update.

    cd /workspaces/z && unzip -o coach-front.zip && python3 apply_front.py
    git add -A && git commit -m "coach: first seat in cast row" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach first seat"

Then device: You → check for updates → FULLY CLOSE and reopen the app → Desk → "coach" is the
first seat in "the gathering, at the door" row.
