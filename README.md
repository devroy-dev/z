# Z — engine

One Haiku agent. Soul + persona Codex cached; shared per-user memory in the
dynamic tail. Separate Supabase (schema `z`), RLS on every table.

## env (Railway)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`   (server only — bypasses RLS)
- `SUPABASE_ANON_KEY`           (to verify caller JWTs)
- `ANTHROPIC_API_KEY`
- `PORT` (Railway sets this)

## run
- `npm install`
- `npm run build`   → compiles to dist/ and copies content/
- `npm start`       → node dist/index.js

## schema
Apply `migrations/0001_spine.sql` to the Z Supabase project first.

## surface
HTTP: `POST /threads` (create companion), `GET /threads` (roster),
`POST /chat` (SSE turn), `GET /healthz`.
