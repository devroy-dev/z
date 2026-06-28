// db.ts — Supabase client for the Z engine.
// SERVICE-ROLE key: bypasses RLS. This is trusted server code that scopes every
// query by user_id itself; RLS is the floor for every OTHER path (browser, anon
// key, mistakes). NEVER ship the service-role key to a browser.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: 'z' },          // Z's own schema — NOT 'engine'
});
