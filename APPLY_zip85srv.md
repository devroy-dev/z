# zip85 (SERVER) · DELETE /public-rooms/:id — creator-only delete

Adds one route. **Touches `src/index.ts`** — coordinate with the desk session (don't co-push; rebase if their `src/index.ts` is dirty).

## WHAT IT DOES
`DELETE /public-rooms/:id`, creator-gated:
- caller must be the room's `created_by`; house rooms and non-creators → **403**.
- sets `active = false` → the room drops out of `GET /public-rooms` (the directory) immediately.
- soft-deletes the thread (`deleted_at`) so history is preserved, no FK cascade.

## APPLY (Codespace, repo root)
```
cd /workspaces/z
unzip -o zip85srv.zip -d .
python3 patch.py            # expect 1 ✓ line
```

## GATE (the real one)
```
npm run build               # must exit 0 (check tsc's exit, not tail's)
```

## PUSH (server auto-builds on Railway)
```
git add -A && git commit -m "creator can delete their public room: DELETE /public-rooms/:id (active=false + thread soft-delete) (zip85 server)"
git push
```
Wait for Railway to redeploy (verify the deployed commit hash matches before curling).

## CURL-PROVE (before any client button)
```
BASE=https://z-production-c79a.up.railway.app
# 1. find a room YOU created (youCreated:true), grab its id:
curl -s $BASE/public-rooms -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | grep -B3 '"youCreated": true'

# 2. delete it (creator) → {ok:true}
curl -s -X DELETE $BASE/public-rooms/<ROOM_ID> -H "Authorization: Bearer $TOKEN"

# 3. confirm it's gone from the directory (grep returns nothing)
curl -s $BASE/public-rooms -H "Authorization: Bearer $TOKEN" | grep <ROOM_ID>

# 4. non-creator refused: as De1, try deleting someone else's room → 403
#    (mint De1 token: POST /auth/otp {phone:+919888294440} → POST /auth/verify {phone,code:123456})
curl -s -X DELETE $BASE/public-rooms/<A_ROOM_YOU_DIDNT_MAKE> -H "Authorization: Bearer $TOKEN_DE1"
#    → {"error":"only the room's creator can delete it."}

# 5. house room refused: try deleting a house room (the football stands etc.) → 403
```
If you don't have a user-created room handy, create one first: tap "create a room" in the app, then it shows up with `youCreated:true`.

## NEXT
Once these curls pass, the **client member sheet** zip lands the creator "delete room" button (wired to this endpoint) alongside report/block/kick/mute/leave.
