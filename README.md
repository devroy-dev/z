# DM speedup — REST broadcast + fire-and-forget (server-only, no OTA)

Fixes the human↔human chat lag. Verified: real `npm run build` (tsc) passes; transactional + idempotent.

## What it does
1. **`broadcast.ts` → HTTP REST broadcast.** The old code opened a Supabase Realtime
   channel, sent one broadcast, and tore it down (`removeChannel`) **per message** — a full
   WebSocket join/leave handshake every send. That was the lag. Now it POSTs to
   `{SUPABASE_URL}/realtime/v1/api/broadcast` (stateless, no handshake). Clients are unchanged
   — same `room-{threadId}` channel, same `msg` event.
2. **DM send path no longer awaits the fan-out.** `index.ts` fired `await broadcastRoomMessage`
   before replying to the sender; now it's fire-and-forget, so the sender's response returns
   immediately (broadcast is best-effort + the message is already persisted; the client has a
   `postgres_changes` fallback that dedups a missed broadcast).

Uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (already set — same as db.ts). No migration.

## Apply (repo root)
    unzip -o dm-speedup.zip
    python3 apply_dm_speedup.py
    npm run build
    git add -A && git commit -m "DM speedup: REST broadcast + fire-and-forget" && git push
    # Railway rebuilds. No OTA — pure server change.

## Verify
Open the same DM from two accounts (two devices / one device + a browser). Send a message —
it should land on the other side near-instantly, and your own send returns immediately.

## Not in this zip (optional follow-ons, client-side OTA)
- Optimistic send (sender's bubble renders instantly with a client-gen id; dedup the echo).
- Explicit gap-repair on reconnect (the pg_changes fallback already covers most of this).
- groupLoop's broadcasts still `await` (fast now via REST) — could also fire-and-forget.
This zip is fix #1, the biggest lever; #1 alone removes most of the lag.
