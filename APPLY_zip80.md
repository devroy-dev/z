# zip80 · THE ROOMS TAB BECOMES THE LOBBY (Tier-1 semi-loud)

Pure client. OTA-safe — no migration, no server, no `src/` touched. Placeholder data (design-verifiable now; backend phase swaps in `GET /public-rooms/v2` behind `useCachedState`).

## RULING BAKED IN (veto in one word if wrong)
The **Rooms tab now opens into the public-rooms lobby**. "your rooms" + gather aren't gone — they're one tap away via a quiet **"your rooms ›"** strip in the lobby header. Reversible: if you want the tab to be lobby-only, say so and I strip the strip + the `Rooms` view.

## WHAT LANDS
- `app/Lobby.js` (new) — the Rooms tab root. Semi-loud: dark Nightfall ground + house fonts kept; color in the live badges, category chips, who's-inside clusters. Search, facets (topic+geo+live), room cards, `soon` event rows, `delhi · 2` overflow, sort live→soon→rest. Spec: `yourZ-rooms-design.md §TIER 1`.
- `app/App.js` — `RoomsWorld` flips to a `lobby | myrooms` view toggle. Default = lobby. Android back walks correctly: room → (lobby or myrooms) → lobby, via the back bus.
- `app/Rooms.js` — becomes the **"your rooms"** view (title relabeled, back affordance when reached from the lobby). Its obsolete "public rooms coming" stub is retired.

## APPLY (from repo root)
```
python3 patch.py
```

## GATE (honest exits before handoff)
```
cd app && npx tsc --noEmit ; cd ..
git status --short          # expect: Lobby.js (new), App.js, Rooms.js
```

## SHIP
```
git add -A && git commit -m "rooms is its own tab: the lobby takes the Rooms world, your rooms one tap away (zip80)"
git push
cd app && npx eas-cli@latest update --branch preview --environment preview -m "zip80 rooms tab = the lobby" --non-interactive
```
OTA apply on device = **You → check for updates**.

## VERIFY ON DEVICE (this is a LOOK check — the whole point)
1. Tap the **Rooms** tab → it opens straight into the semi-loud **lobby** (dark ground, Fraunces titles, red live badges, tinted category chips, who's-inside clusters). Confirm it reads *between* the calm app and a loud room — waking up, not flooded.
2. Facet chips filter; search filters by title; `soon` rows sit below live rooms.
3. Tap **"your rooms ›"** → your old rooms list ("gather a room", suggested, your rooms). Back (chevron or Android back) → returns to the lobby.
4. Tap a lobby room → the (still-mock) public interior opens. Back → returns to the lobby. (Proves the nav before the interior gets rebuilt next.)

## NOTES
- Live counts are placeholder until the endpoint lands.
- Tapping a lobby room still shows the OLD `PublicRoom` mock — that's the NEXT zip (Tier-2 full-loud flat feed, `§TIER 2`), gated behind realtime hardening + your doorway ruling (§OPEN).
- Coordination: this touches `App.js` (shared with the desk session). Don't land this and a desk-session `App.js` edit in the same push without a rebase.
