# Coach entry — clean up + put it in the RIGHT place (APP / OTA)

Does two things in one apply:
1. REVERTS the 3 dead coach edits in app/Desk.js (the PWA Desk isn't shown in the app) —
   the PERSONA_META line, the routeTo, and the cast-row entry. Desk.js goes back to clean.
2. ADDS "the Coach" as a pinned row on app/ChatHome.js (the real home — front desk, Newsroom,
   Consultant, Z, Grand Master), right under the Newsroom, + routes it in Nav.

The good phase-1 pieces stay untouched: app/Coach.js, the api.js coach calls, the Nav overlay.
Babel-gated (Desk/ChatHome/Nav all parse clean). Idempotent.

## Apply + OTA (BOTH required)
    cd /workspaces/z && unzip -o coach-cleanup.zip && python3 apply_cleanup.py
    git add -A && git commit -m "coach: clean up dead Desk edits; pin row on ChatHome" && git push
    cd app && npx expo export && CI=1 npx eas-cli@latest update --branch preview --environment preview -m "coach home row + cleanup"

Device: You → check for updates → FULLY close & reopen → home list shows "the Coach" under the
Newsroom → tap → the coach surface.
