// broadcast.ts — reliable realtime delivery for shared rooms.
// Instead of relying on postgres_changes (fragile: WAL/replication/RLS dependent),
// the server explicitly broadcasts each saved room message to a channel. Clients
// subscribe to 'room-{threadId}' and receive a 'msg' event. This is Supabase's
// robust pub/sub path — no DB replication, no RLS-on-socket surprises.
import { supabase } from './db.js';

export async function broadcastRoomMessage(threadId: string, msg: {
  role: string;
  content: string;
  persona_key?: string | null;
  sender_user_id?: string | null;
  sender_name?: string | null;
  created_at?: string;
}): Promise<void> {
  try {
    const channel = supabase.channel(`room-${threadId}`, { config: { broadcast: { ack: false } } });
    await channel.send({
      type: 'broadcast',
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
    });
    // a transient send-only channel; remove it so we don't leak channels
    await supabase.removeChannel(channel);
  } catch {
    // broadcast is best-effort; the message is already persisted, so a missed
    // broadcast just means the other client sees it on next load, never data loss.
  }
}
