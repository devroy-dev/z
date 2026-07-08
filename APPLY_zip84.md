# zip84 · THE ROOM INTERIOR — Tier-2 flat feed (public rooms only)

Client-only, OTA-safe. **Everything is branched on `room.publicRoomId`** — curated persona rooms and DMs render exactly as before; only public rooms change.

## WHAT CHANGES (inside a public room)
- **Bubbles retired → flat line feed.** Each line = handle in its colour + message inline, tight, IRC/Yahoo-style. Personas use their aura; the keeper (`the_moderator`) is marked with ◆; human strangers get a stable hashed hue; you're the ember "you".
- **The big presence rail is hidden** — a public room is a crowd, not a persona chat. (Curated rooms keep their rail.)
- The room keeps its doorman-aura gradient, topbar, play/invite, and composer.

## APPLY (Codespace, from repo root)
```
cd /workspaces/z
unzip -o zip84.zip -d .
python3 patch.py            # expect 7 ✓ lines
```

## GATE
```
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: MessageList.js, CuratedRoomScreen.js
```

## SHIP
```
git add -A && git commit -m "public rooms are a flat feed: handles in colour, keeper marked, presence rail hidden — curated/DM untouched (zip84)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip84 flat feed" --non-interactive
```
Device: **You → check for updates**.

## VERIFY
1. Open a **public** room (the writers' table) → the feed is now flat lines with coloured handles; "the moderator" reads with a ◆; no big face rail. Send a message → you appear as ember "you".
2. Open a **curated persona room** (from "your rooms" / gather) → still bubbles + presence rail, unchanged.
3. Open a **DM** → still bubbles, unchanged.

## NOTES / COORDINATION
- Built on HEAD `ee6ed0b` (zip83). `MessageList.js` + `CuratedRoomScreen.js` are **shared** with curated/DM rooms — `git pull --rebase` before push if the other session has uncommitted edits to either.
- @mention colouring in the body renders as plain text in flat mode (the handle carries the colour). Easy to add back if you want it.
- This completes the rooms crescendo: lobby (semi-loud) → consent gate → room (full-loud flat feed).
