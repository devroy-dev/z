# HANDOFF — SITTING 2C
*For the next instance. Read the memories, read this, verify before claiming. COMPILES ≠ WORKS.*

## WHERE THINGS STAND
Sitting 2B's desk campaign is functionally complete and device-verified through many rounds:
manifest/switchboard, house-lives, morning note (plain-words), evening programme (cron UNARMED —
flag `EVENING_PROGRAMME=1` flips it once card rendering is re-verified post-fixes), arrival
interview (codex-contract form: loop.ts feeds facts+hands ONLY; codex-front-desk.md owns the
self — never author manner in loop.ts again, that lesson cost three regressions), concierge
(BOOK/REMIND/FEEDBACK + 60s ping scheduler + /dev/fire-pings), cards/chips/burst delivery,
timestamps, profile v1, native typed journal (quiet room → "the journal ›"), updates/groups tabs,
real memory on You, Opus's 31-persona CODEX DEPTH installed + diary writer feeds on backstories.

## THE SIX-ZIP CONTRACT (Dev's ruling: exact count, executed in order)
1. ✅ fix-nine + codex depth + real memory (this zip)
2. NATIVE BUILD CONFIG — app.json permissions/plugins + eas.json + deps for FCM (expo-notifications),
   mic (expo-av or expo-audio — expo-audio already a dep, needs the native build), image picker
   perms. Dev fires ONE `eas build` (credits are finite — this is THE batched build).
3. IMAGE SHARE — /chat already accepts `image` param (verify engine handling end-to-end first);
   composer picker. OTA while build bakes.
4. VOICE — Sarvam STT button in Chat+RoomChat composers, journal mic (engine POST /journal accepts
   audio/*, transcribeAudio exists). Only after the build installs.
5. FRIENDS v1 — migration 0024 (users.handle unique + friendships table), set-handle in You,
   add/accept by handle, friends chip real, in-app game invites over FCM. Voice notes to friends
   = human↔human audio messages, needs this + build.
6. RELOCATION — followups/drop-ins into personas' own threads, unread counts in getThreads,
   badges in ChatHome, FCM delivery; then arm EVENING_PROGRAMME.

## OPEN RULINGS DEV GAVE VERBATIM
- "everything should be self contained" — NO PWA links, no external hand-offs.
- Play landing page STAYS (pill → arena/stage doors → in). The dupe was a state leak (chatOpen
  not cleared on world switch — fixed in zip 1). Never delete the landing again.
- Z streams live + the anchor streams live; the desk delivers in blocks (3–6s beats). Z alone
  keeps italic serif; everyone else WhatsApp-flat.
- Arena/play world stays Lamplight (thermal split locked) unless Dev explicitly unlocks.
- Pins: max 3, 4th blocked with "unpin one first"; pins ≠ favourites; swipe-left row actions
  (pin/archive/fav) still unbuilt (needs thread-state migration).

## DEBTS / WATCH ITEMS
- ROOMS KNOWLEDGE SEAM (found live, 3 Jul eve): suggestion engine creates topical rooms with
  current-events knowledge the personas lack (e.g. Nolan's 2026 Odyssey). Patch shipped: room
  name injected as standing premise + no-fake-checking law in groupLoop. REAL FIX PENDING a
  design call: grant web tools in group turns to webEnabled personas (brainiac, anchor, oracle,
  screen_junkie...) so rooms can verify — cost/latency tradeoff, Dev to rule. Also: store the
  suggestion BLURB on created rooms so the premise is richer than the title.
- migration 0023 used text user_id (inconsistent with uuid core) — fix in 0024.
- the_addict pursuit line parked in CODEX_DEPTH_NOTES.md (add only when circulating).
- Desk suggestions breadth + interview quality: judge post-codex-depth before more prompt surgery.
- ChatHome friends/growth/unread filter chips are cosmetic until friends+unreads exist.
- GOTO chips are stream-ephemeral (die on reload); CARDs persist. Unify later if Dev wants.
- Evening programme voicing floor fires too often — tighten VOICE when arming.
- Memory harvest writes kind/key/value; You now reads real memory; PWA parity later.

## DISCIPLINE (the short version — memories carry the rest)
Fresh clone → verify anchors → assert every edit → engine `npm run build` + `lint.mjs` +
`expo export --platform android` → zip with repo paths → grep INSIDE the zip → present_files →
commands with a `git status --short` checkpoint → OTA line: "You → check for updates" →
never claim it works until Dev's screen or a curl says so.
