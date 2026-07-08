# zip83 · THE DOORWAY — one-time consent gate

Client-only, OTA-safe. In-lane: only ChatHome's communities enter-flow is touched. No server, no migration.

## WHAT IT DOES
Before the **first** public-room entry ever, a conduct/18+ gate appears: "before you step in — open rooms are public and 18+… keep it civil, the doorman removes slurs/harassment/doxxing." Accept once → flag saved (`z_public_consent` in AsyncStorage) → never shown again. "not now" backs out. On accept, it proceeds straight into the room you tapped.

## APPLY (in the Codespace, from repo root)
```
cd /workspaces/z
unzip -o zip83.zip -d .
python3 patch.py            # expect 4 ✓ lines
```

## GATE
```
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: ChatHome.js only
```

## SHIP
```
git add -A && git commit -m "the doorway: one-time 18+/conduct consent gate before first public-room entry (zip83)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip83 consent gate" --non-interactive
```
Device: **You → check for updates**.

## VERIFY
1. rooms tab → tap open/join on any community → the gate appears (first time only).
2. "I understand — enter" → room opens; tap another room → gate does NOT reappear.
3. To re-test the first-run: reinstall, or it's a fresh flag per install.

## NOTES
- Built on HEAD `6fb85dc` (zip82). `ChatHome.js` is shared with the desk session — `git pull --rebase` before push if their tree has uncommitted ChatHome edits.
- The flag is per-install (local). If you later want durable/server-side consent proof for compliance, that's a small server add — say the word.
- NEXT (pending your ownership ruling): the Tier-2 full-loud flat feed in the room interior — branch on `publicRoomId` inside `CuratedRoomScreen`/`MessageList` so curated + DM rooms stay untouched.
