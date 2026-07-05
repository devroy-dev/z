#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  DM speedup — run from repo root: python3 apply_dm_speedup.py
#  Server-only (Railway push, NO OTA). Transactional + idempotent.
#
#  ROOT CAUSE: broadcastRoomMessage opened a Supabase Realtime CHANNEL, sent one
#  broadcast, and tore it down (removeChannel) PER MESSAGE — a full WebSocket
#  join/leave handshake on every send. That handshake is the DM lag.
#
#  FIX (both):
#   1) broadcast.ts → publish via the stateless HTTP broadcast endpoint
#      (POST {SUPABASE_URL}/realtime/v1/api/broadcast). No channel, no handshake.
#      Clients still subscribe to 'room-{threadId}' / event 'msg' — unchanged.
#   2) the DM send path (index.ts) no longer AWAITS the fan-out before replying to
#      the sender — fire-and-forget (already best-effort + persisted; client has a
#      postgres_changes fallback that dedups a missed broadcast).
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

NEW_BROADCAST = '''// broadcast.ts — reliable realtime delivery for shared rooms.
// The server publishes each saved room message via Supabase Realtime's HTTP
// broadcast endpoint: a stateless POST, no channel join/teardown per message.
// (The old path opened a WS channel, sent once, and removeChannel'd EVERY time —
// a full handshake per send, which was the DM lag.) Clients are unchanged: they
// still subscribe to 'room-{threadId}' and receive a 'msg' event.
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function broadcastRoomMessage(threadId: string, msg: {
  role: string;
  content: string;
  persona_key?: string | null;
  sender_user_id?: string | null;
  sender_name?: string | null;
  created_at?: string;
}): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{
          topic: `room-${threadId}`,
          event: 'msg',
          payload: {
            thread_id: threadId,
            role: msg.role,
            content: msg.content,
            persona_key: msg.persona_key ?? null,
            sender_user_id: msg.sender_user_id ?? null,
            sender_name: msg.sender_name ?? null,
            created_at: msg.created_at ?? new Date().toISOString(),
          },
        }],
      }),
    });
  } catch {
    // best-effort; the message is already persisted (client pg_changes fallback).
  }
}
'''

def main():
    if not os.path.isdir('src'):
        print("Run from repo root."); sys.exit(1)

    # 1) broadcast.ts — full swap to REST (idempotent via marker)
    bpath = 'src/broadcast.ts'
    b = io.open(bpath, encoding='utf-8').read()
    b_done = 'realtime/v1/api/broadcast' in b
    if not b_done and 'supabase.channel(' not in b:
        print(f"  ! {bpath}: neither REST nor the known WS channel found — ABORT (unexpected content)"); sys.exit(1)

    # 2) index.ts — DM path fire-and-forget (anchored)
    ipath = 'src/index.ts'
    i = io.open(ipath, encoding='utf-8').read()
    old_block = (
        "      try {\n"
        "        await broadcastRoomMessage(threadId, {\n"
        "          role: 'user', content: String(message), sender_user_id: user.id,\n"
        "          sender_name: user.display_name || 'someone',\n"
        "        });\n"
        "      } catch (e) { /* broadcast best-effort; message is persisted */ }"
    )
    new_block = (
        "      // fire-and-forget: don't make the sender wait on the fan-out (REST broadcast,\n"
        "      // best-effort + already persisted; client has a pg_changes fallback).\n"
        "      void broadcastRoomMessage(threadId, {\n"
        "        role: 'user', content: String(message), sender_user_id: user.id,\n"
        "        sender_name: user.display_name || 'someone',\n"
        "      });"
    )
    i_done = new_block in i

    # validate both before writing either
    if not i_done and i.count(old_block) != 1:
        print(f"  ! index DM block: anchor x{i.count(old_block)} (need 1) — ABORT (nothing written)"); sys.exit(1)

    wrote = []
    if not b_done:
        io.open(bpath, 'w', encoding='utf-8').write(NEW_BROADCAST); wrote.append("broadcast.ts → REST")
    else:
        print("  = broadcast.ts (already REST)")
    if not i_done:
        io.open(ipath, 'w', encoding='utf-8').write(i.replace(old_block, new_block)); wrote.append("index.ts DM fire-and-forget")
    else:
        print("  = index.ts DM (already fire-and-forget)")

    for w in wrote: print(f"  + {w}")
    print(f"\nStaged {len(wrote)}. Server-only: npm run build → commit/push. No OTA.")

main()
