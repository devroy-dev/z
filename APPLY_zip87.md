# zip87 · public rooms always open in CuratedRoomScreen

Client-only, OTA-safe. One line in Nav.js. Fixes: user-created public rooms with no resident (personas:[], e.g. "Delhi foodies") were opening in DMScreen — no member sheet, no delete. Now any room with a publicRoomId routes to CuratedRoomScreen (which has the sheet + flat feed). DMs and curated persona rooms unchanged.

## APPLY (Codespace, repo root)
cd /workspaces/z
unzip -o zip87.zip -d .
python3 patch.py            # expect 1 ✓ line
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: Nav.js only

## SHIP
git add -A && git commit -m "public rooms always open in CuratedRoomScreen (member sheet + flat feed for resident-less rooms too) (zip87)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip87 room routing" --non-interactive

Device: You → check for updates. git pull --rebase first if the desk session has uncommitted Nav.js.

## VERIFY
1. Open "Delhi foodies" (your resident-less room) → it now opens as a proper room (flat feed) with a **members** button → tap → sheet → **delete room** at the bottom (you created it).
2. Delete it → you're bounced out, gone from communities.
3. A DM still opens as a DM; a curated persona room still opens curated.

## NOTE
⚠ Nav.js is shared with the desk session — rebase if their Nav.js is dirty before pushing.
