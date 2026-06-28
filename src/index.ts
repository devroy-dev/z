// index.ts — the Z engine HTTP surface. Express. Verifies the Supabase Auth JWT
// the PWA sends, resolves the z.users row, and exposes:
//   POST /threads          create a named companion (persona instance)
//   GET  /threads          list the user's roster
//   POST /chat             one turn (SSE stream of tokens)
//   GET  /healthz          liveness
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { resolveUser, isRestricted } from './zAccess.js';
import { runZTurn } from './loop.js';
import { personaByKey } from './personas.js';
import { supabase } from './db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '256kb' }));

// verify the caller's Supabase JWT → auth_user_id. Uses anon client just to read the token's user.
const authClient = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!);
async function authUser(req: express.Request): Promise<string | null> {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return null;
  const { data, error } = await authClient.auth.getUser(h.slice(7));
  if (error || !data?.user) return null;
  return data.user.id;
}

app.get('/healthz', (_req, res) => res.json({ ok: true }));

// create a companion
app.post('/threads', async (req, res) => {
  const authId = await authUser(req);
  if (!authId) return res.status(401).json({ error: 'unauthorized' });
  const user = await resolveUser(authId);
  const { personaKey, name, gender, avatarUrl, accent } = req.body ?? {};
  const persona = personaByKey(personaKey);
  if (!persona) return res.status(400).json({ error: 'unknown persona' });
  const { data, error } = await supabase.from('threads').insert({
    user_id: user.id,
    persona_key: persona.key,
    codex_key: persona.codex,
    companion_name: name || persona.defaultName,
    companion_gender: gender ?? null,
    avatar_url: avatarUrl ?? null,
    accent: accent ?? null,
  }).select('id, persona_key, companion_name, avatar_url, accent').single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// list roster
app.get('/threads', async (req, res) => {
  const authId = await authUser(req);
  if (!authId) return res.status(401).json({ error: 'unauthorized' });
  const user = await resolveUser(authId);
  const { data } = await supabase.from('threads')
    .select('id, persona_key, companion_name, avatar_url, accent, last_active')
    .eq('user_id', user.id).is('deleted_at', null)
    .order('last_active', { ascending: false });
  res.json(data ?? []);
});

// one turn — SSE stream
app.post('/chat', async (req, res) => {
  const authId = await authUser(req);
  if (!authId) return res.status(401).json({ error: 'unauthorized' });
  const user = await resolveUser(authId);
  if (await isRestricted(user.id)) return res.status(403).json({ error: 'restricted' });

  const { threadId, message } = req.body ?? {};
  if (!threadId || !message) return res.status(400).json({ error: 'threadId and message required' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const result = await runZTurn({
      userId: user.id, threadId, message,
      onToken: (t) => res.write(`data: ${JSON.stringify({ token: t })}\n\n`),
    });
    res.write(`data: ${JSON.stringify({ done: true, usage: result.usage })}\n\n`);
    res.end();
  } catch (e: any) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`[z] engine on :${port}`));
