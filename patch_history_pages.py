#!/usr/bin/env python3
# patch_history_pages.py — [HISTORY PAGES] scroll-up loads older messages.
# Server: ?before=<ISO> cursor + hasMore + real row ids. Client: top-edge
# detection, prepend with maintainVisibleContentPosition (RN 0.86 — no jump),
# dedupe by id AND content, quiet "fetching the past" pill.
# Idempotent + drift-refusing, per house law.
import io, sys
FAILS = []
def patch(path, old, new, name):
    s = io.open(path, encoding='utf-8').read()
    if new in s: print(f'  = {name}: already applied'); return
    if s.count(old) != 1: FAILS.append(f'{name}: anchor {"absent" if old not in s else "not unique"} in {path}'); return
    io.open(path, 'w', encoding='utf-8').write(s.replace(old, new)); print(f'  + {name}: applied')

# ── 1. SERVER: cursor + hasMore + ids ─────────────────────────────────────────
patch('src/index.ts',
"""    // [history-window] LAST 200, not first — ascending+limit froze long threads
    // in their oldest 200 messages forever (new messages could never load).
    // Fetch newest-first, then reverse so the client still renders oldest→newest.
    let q = supabase.from('messages')
      .select('role, content, persona_key, created_at, sender_user_id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (!thread.is_shared) q = q.eq('user_id', user.id);
    const { data: msgsDesc } = await q;
    const msgs = (msgsDesc ?? []).reverse();""",
"""    // [history-window] LAST 200, not first — ascending+limit froze long threads
    // in their oldest 200 messages forever (new messages could never load).
    // [history-pages] ?before=<ISO> pages backward through the past: newest-first
    // window strictly older than the cursor, reversed for the client. hasMore
    // tells the client whether another page exists. Row ids ride along so the
    // client can key pages without index collisions.
    const before = typeof req.query.before === 'string' && req.query.before ? req.query.before : null;
    let q = supabase.from('messages')
      .select('id, role, content, persona_key, created_at, sender_user_id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (before) q = q.lt('created_at', before);
    if (!thread.is_shared) q = q.eq('user_id', user.id);
    const { data: msgsDesc } = await q;
    const hasMore = (msgsDesc ?? []).length === 200;
    const msgs = (msgsDesc ?? []).reverse();""",
'index.ts: cursor + hasMore + ids')

patch('src/index.ts',
"res.json({ messages: out, is_group: !!thread.is_group, is_shared: !!thread.is_shared, roster, you: user.id });",
"res.json({ messages: out, hasMore, is_group: !!thread.is_group, is_shared: !!thread.is_shared, roster, you: user.id });   // [history-pages]",
'index.ts: hasMore in response')

# ── 2. API: the before param ──────────────────────────────────────────────────
patch('app/api.js',
"""  try { return await authedJSON('GET', `/threads/${roomId}/messages`); } catch (e) { return { messages: [], meId: null }; }""",
"""  try { return await authedJSON('GET', `/threads/${roomId}/messages${before ? ('?before=' + encodeURIComponent(before)) : ''}`); } catch (e) { return { messages: [], meId: null }; }""",
'api.js: before param (body)')
# widen the signature (anchor the function line right above — verify name)
s = io.open('app/api.js', encoding='utf-8').read()
import re
m = re.search(r"export async function (getRoomMessages|getMessages)\(roomId\)", s)
if m:
    io.open('app/api.js', 'w', encoding='utf-8').write(s.replace(m.group(0), m.group(0).replace('(roomId)', '(roomId, before)'), 1))
    print(f'  + api.js: {m.group(1)}(roomId, before): applied')
elif re.search(r"export async function (getRoomMessages|getMessages)\(roomId, before\)", s):
    print('  = api.js: signature: already applied')
else:
    FAILS.append('api.js: getRoomMessages signature not found (drift)')

# ── 3. CHAT: refs + capture + loader + top-edge + no-jump + pill ─────────────
patch('app/Chat.js',
"  const scrollRef = useRef(null);",
"""  const scrollRef = useRef(null);
  // [history-pages] the past, paged: cursor = oldest loaded created_at
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  const hasMoreRef = useRef(false);
  const oldestRef = useRef(null);""",
'Chat: pagination refs')

patch('app/Chat.js',
"""          .filter((m) => m.text);
        // [zip05] reconcile: fresh history wins; live entries sent after the cache""",
"""          .filter((m) => m.text);
        hasMoreRef.current = !!j.hasMore;                      // [history-pages]
        oldestRef.current = hist[0]?.at || null;
        // [zip05] reconcile: fresh history wins; live entries sent after the cache""",
'Chat: capture cursor on initial load')

patch('app/Chat.js',
"  const scrollDown = () => {",
"""  // [history-pages] scroll-up loads the previous page; ids are real row ids so
  // pages can never collide; content-dedupe guards the cache-painted overlap.
  const loadOlder = () => {
    if (loadingOlderRef.current || !hasMoreRef.current || !oldestRef.current || !threadId) return;
    loadingOlderRef.current = true; setLoadingOlder(true);
    getRoomMessages(threadId, oldestRef.current).then((j) => {
      const older = (j.messages || [])
        .map((m, i) => ({ id: 'h' + (m.id || ('p' + (m.created_at || i))), who: m.role === 'user' ? 'you' : 'them', text: m.content || '', at: m.created_at }))
        .filter((m) => m.text);
      hasMoreRef.current = !!j.hasMore;
      if (older.length) {
        oldestRef.current = older[0]?.at || oldestRef.current;
        setMessages((cur) => {
          const ids = new Set(cur.map((m) => m.id));
          const keys = new Set(cur.map((m) => m.who + '|' + m.text));
          return older.filter((m) => !ids.has(m.id) && !keys.has(m.who + '|' + m.text)).concat(cur);
        });
      }
    }).catch(() => {}).finally(() => { loadingOlderRef.current = false; setLoadingOlder(false); });
  };

  const scrollDown = () => {""",
'Chat: loadOlder')

patch('app/Chat.js',
"""              atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
            }}>""",
"""              atBottomRef.current = (contentSize.height - (contentOffset.y + layoutMeasurement.height)) < 120;
              if (contentOffset.y < 80) loadOlder();           // [history-pages] the top edge asks for the past
            }}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}>{/* [history-pages] prepend without the jump */}
            {loadingOlder && !empty ? (
              <Text style={{ alignSelf: 'center', color: 'rgba(228,234,242,0.35)', fontSize: 11, paddingVertical: 6 }}>· fetching the past ·</Text>
            ) : null}""",
'Chat: top edge + no-jump + pill')

if FAILS:
    print('\nREFUSED — fix drift first:')
    for f in FAILS: print('  ✗', f)
    sys.exit(1)
print('\nhistory-pages: all patches green.')
