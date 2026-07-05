// broadcast.ts — reliable realtime delivery for shared rooms.
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
