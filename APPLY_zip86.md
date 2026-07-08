# zip86 · THE MEMBER SHEET (R0's last piece)

Client-only, OTA-safe. Everything scoped to **public rooms** (`publicRoomId`) — curated persona rooms and DMs untouched. Needs the zip85 server endpoint live (it is, curl-proven).

## WHAT LANDS
In a public room, the header's **members** button (now shown to everyone, not just the creator) opens the sheet:
- **residents** listed as **report** targets.
- **humans**: **mute** (local, hides their lines) · **report** · **block** (server + hides their lines everywhere) · owner-only **kick**.
- footer: **leave room** (everyone) · creator-only **delete room** (the zip85 endpoint).
- blocked/muted lines are filtered out of the feed live (feed lines now carry `uid`).

## APPLY (Codespace, repo root)
```
cd /workspaces/z
unzip -o zip86.zip -d .
python3 patch.py            # expect 12 ✓ lines
```

## GATE
```
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: api.js, useRoomFeed.js, CuratedRoomScreen.js
```

## SHIP
```
git add -A && git commit -m "the member sheet: report/block/mute/kick/leave + creator delete — public rooms only (zip86)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip86 member sheet" --non-interactive
```
Device: **You → check for updates**. `git pull --rebase` first if the desk session has uncommitted `api.js`/`useRoomFeed.js`/`CuratedRoomScreen.js`.

## VERIFY ON DEVICE
1. Open a public room → header shows **members** → tap it → sheet lists the resident (report) + any humans (mute/report/block, +kick if you own it), leave at the bottom, **delete room** if you created it.
2. Create a throwaway room → open it → **delete room** → confirm → you're bounced out and it's gone from communities.
3. **mute** a human → their lines vanish from the feed; unmute → they return.
4. **block** a human → confirm → their lines vanish (and DM to them bounces, server-side).
5. Open a **curated** persona room and a **DM** → unchanged (no members button, bubbles intact).

## NOTES
- Report has no reason field in v1 (reports land with target only); easy to add a reason prompt later.
- Mute is local per-install; block is server-side and global.
- Human avatars use a coloured initial (we don't store human DPs yet).
- This closes R0. Remaining tracked work after this: relabel pass (partial), DM hardening (parked), Phase-5 native build (push notifications).
