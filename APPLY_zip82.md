# zip82 · COMMUNITIES, SEMI-LOUD (aura per room)

Design-only restyle of the **live** communities directory in `app/ChatHome.js`. Pure client. OTA-safe — no server, no migration. Function untouched (enter/join/open/create + all room data). **Only the communities section is touched**, per your ownership ruling.

## WHAT CHANGES
Every room now wears its **doorman's aura** — the same tint language as your desk rows, so it's consistent across the app:
- a left **aura spine** + face **ring** + a presence **dot** + the open/join **pill**, all in the doorman's tone.
- **honest presence** — no fake "68 live." The line reads "<doorman> hosting" (the never-empty law — the doorman always holds the floor), and only shows "· N here" when a room genuinely has more than the host. The count can go loud later when real live data exists.
- card description brightened; count text lifted off the near-black.

## APPLY (from repo root)
```
python3 patch.py
```

## GATE
```
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: ChatHome.js only
```

## SHIP
```
git add -A && git commit -m "communities wear the doorman's aura: spine, ring, presence dot, join pill — honest, not fake-live (zip82)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip82 communities semi-loud" --non-interactive
```
OTA apply on device = **You → check for updates**.

## VERIFY ON DEVICE (look check)
1. rooms tab → each community card now carries a distinct color (the football stands, the trading pit, late night philosophy, the writers' table each in their doorman's tone) — rows stop blurring together.
2. Presence reads honestly: "<doorman> hosting", "· house" tag on house rooms; a real member count only appears past the host.
3. open/join still works; create still works. Nothing functional changed.

## NOTES / COORDINATION
- Built against HEAD `4bcf9f8` (zip81). The desk session is active — apply promptly.
- **`ChatHome.js` is shared**: I own the communities section, the desk session owns the rest. Don't land this and a desk-session `ChatHome.js` edit in the same push without a rebase.
- My dead `App.js` `RoomsWorld` → `Lobby` path from zip80 is now superseded by this. It can be removed in a later cleanup zip (it renders nothing, so it's harmless for now).
- Next: the **room interior** (Tier-2 full-loud flat feed) — the surface a room opens into. Still needs your doorway ruling (§OPEN).
