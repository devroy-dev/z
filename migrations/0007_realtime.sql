-- 0007_realtime.sql
-- Enable Supabase Realtime on z.messages so room members get live message pushes.
-- RLS still governs WHAT each subscriber receives (the messages_room_members policy
-- from 0006 means a member only ever sees rows for rooms they belong to).

alter publication supabase_realtime add table z.messages;

-- realtime needs replica identity to emit row data
alter table z.messages replica identity full;
