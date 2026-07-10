// broadcast.ts — reliable realtime delivery for shared rooms.
import { supabase } from './db.js';   // [zip48] membership read for the inbox bumps
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
  client_id?: string | null;   // [H1] the sender's own id — echo dedupe + sent-tick
  id?: string | null;          // [H1b] the DB row id — identical on both transports; the dedupe key
}): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_KEY) return;
  try {
    const createdAt = msg.created_at ?? new Date().toISOString();
    const roomPayload = {
      thread_id: threadId,
      role: msg.role,
      content: msg.content,
      persona_key: msg.persona_key ?? null,
      sender_user_id: msg.sender_user_id ?? null,
      sender_name: msg.sender_name ?? null,
      created_at: createdAt,
      client_id: msg.client_id ?? null,   // [H1]
      id: msg.id ?? null,                 // [H1b]
    };
    const messages: any[] = [{ topic: `room-${threadId}`, event: 'msg', payload: roomPayload }];

    // [zip48] THE LIVE LIST — per-member inbox bumps ride the SAME batched POST.
    // The chats list was deaf (realtime is room-scoped); now every fan-out also
    // whispers {thread, when, preview} to each member's own channel. The bump IS
    // the reappear signal for hidden DMs — the client upserts the row. Sender
    // included on purpose: their other devices update too. Best-effort like the
    // rest of this file; membership read failure just means no bumps this turn.
    try {
      const { data: mem } = await supabase.from('room_members')
        .select('user_id').eq('thread_id', threadId).limit(200);
      const preview = String(msg.content || '').slice(0, 120);
      for (const m of (mem ?? [])) {
        if (!m?.user_id) continue;
        messages.push({
          topic: `user-${m.user_id}`,
          event: 'inbox',
          payload: {
            thread_id: threadId,
            last_active: createdAt,
            preview,
            persona_key: msg.persona_key ?? null,
            sender_user_id: msg.sender_user_id ?? null,
            sender_name: msg.sender_name ?? null,
          },
        });
      }
    } catch { /* bumps are garnish; the room message still goes */ }

    await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });
  } catch {
    // best-effort; the message is already persisted (client pg_changes fallback).
  }
}
