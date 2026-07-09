#!/usr/bin/env python3
# patch_desk_alive.py — [DESK COMES ALIVE] surgical edits, idempotent + drift-refusing.
# New files (src/deskRooms.ts, app/DeskPane.js) arrive via the zip's deploy/ tree;
# this script wires them in: the route, the api helper, and the pane swap.
import sys, io

FAILS = []
def patch(path, old, new, name):
    with io.open(path, encoding='utf-8') as f: s = f.read()
    if new in s:
        print(f'  = {name}: already applied'); return
    if old not in s:
        FAILS.append(f'{name}: anchor not found in {path} (drift — refusing)'); return
    if s.count(old) != 1:
        FAILS.append(f'{name}: anchor not unique in {path} (refusing)'); return
    with io.open(path, 'w', encoding='utf-8') as f: f.write(s.replace(old, new))
    print(f'  + {name}: applied')

# ── 1. src/index.ts — import + GET /desk/rooms (additive, beside /desk/brief) ──
patch('src/index.ts',
"""app.get('/desk/brief', async (req, res) => {""",
"""// [DESK COMES ALIVE] per-room live lines for the desk pane. Pure SELECTs.
app.get('/desk/rooms', async (req, res) => {
  try {
    const authId = await authUser(req);
    if (!authId) return res.status(401).json({ error: 'unauthorized' });
    const user = await resolveUser(authId);
    res.json({ rooms: await assembleDeskRooms(user.id) });
  } catch (e: any) { res.status(500).json({ error: e?.message || String(e) }); }
});

app.get('/desk/brief', async (req, res) => {""",
'index.ts: /desk/rooms route')

patch('src/index.ts',
"""import { assembleDeskBrief }""",
"""import { assembleDeskRooms } from './deskRooms.js';   // [DESK COMES ALIVE]
import { assembleDeskBrief }""",
'index.ts: deskRooms import')

# ── 2. app/api.js — the helper, beside getDeskBrief ───────────────────────────
patch('app/api.js',
"""// [0058] the house brief — real state for the desk marquee + Z's mouth""",
"""// [DESK COMES ALIVE] per-room live lines for the desk pane
export async function getDeskRooms() {
  try { const j = await authedJSON('GET', '/desk/rooms'); return j.rooms || null; } catch (e) { return null; }
}

// [0058] the house brief — real state for the desk marquee + Z's mouth""",
'api.js: getDeskRooms')

# ── 3. app/ChatHome.js — import, casing sweep, the pane swap, pull-to-refresh ──
patch('app/ChatHome.js',
"""import { FONTS } from './theme';""",
"""import { FONTS } from './theme';
import DeskPane from './DeskPane';   // [DESK COMES ALIVE] the desk shows the work""",
'ChatHome: DeskPane import')

# casing law: the house voice is lowercase; The Consultant keeps its letterhead T.
for old_name, new_name, tag in [
    ("name: 'the Host'", "name: 'the host'", 'casing: host'),
    ("name: 'the Newsroom'", "name: 'the newsroom'", 'casing: newsroom'),
    ("name: 'the Coaching hub'", "name: 'the coaching hub'", 'casing: coaching hub'),
    ("name: 'the Grand Master'", "name: 'the grand master'", 'casing: grand master'),
    ("name: 'the Media Manager'", "name: 'the media manager'", 'casing: media manager'),
]:
    patch('app/ChatHome.js', old_name, new_name, tag)

# the pane swap: the static list becomes the living desk (search keeps DeskRow).
patch('app/ChatHome.js',
"""            DESK_ROOMS.map((r, ri) => <DeskRow key={'room' + ri} item={r} />)""",
"""            <DeskPane rooms={DESK_ROOMS} onOpen={onOpen} consultLogo={<ConsultLogo />} bump={deskBump} />""",
'ChatHome: pane swap')

# pull-to-refresh on the desk scroll (bump re-pulls the live lines).
patch('app/ChatHome.js',
"""export default function ChatHome({ onOpen: rawOnOpen = () => {}, initialTab = 'thedesk' }) {   // [zip81]
  const [tab, setTab] = useState(initialTab);   // [zip61][zip81] restore the tab we came back to""",
"""export default function ChatHome({ onOpen: rawOnOpen = () => {}, initialTab = 'thedesk' }) {   // [zip81]
  const [tab, setTab] = useState(initialTab);   // [zip61][zip81] restore the tab we came back to
  const [deskBump, setDeskBump] = useState(0);            // [DESK COMES ALIVE]
  const [deskRefreshing, setDeskRefreshing] = useState(false);
  const deskRefresh = () => { setDeskRefreshing(true); setDeskBump((b) => b + 1); setTimeout(() => setDeskRefreshing(false), 700); };""",
'ChatHome: refresh state')

patch('app/ChatHome.js',
"""        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{/* [zip68] the Desk, all chat */}""",
"""        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={deskRefreshing} onRefresh={deskRefresh} tintColor="rgba(159,194,232,0.6)" />}>{/* [zip68] the Desk, all chat · [DESK COMES ALIVE] */}""",
'ChatHome: RefreshControl on desk scroll')

# ensure RefreshControl is imported from react-native (skip if already there)
with io.open('app/ChatHome.js', encoding='utf-8') as f: _s = f.read()
if 'RefreshControl' in _s.split('\n', 40)[0:40] and False:
    pass
import re
head = _s[:2000]
if re.search(r"from 'react-native'", head) and 'RefreshControl' not in head:
    m = re.search(r"import \{([^}]*)\} from 'react-native';", _s)
    if m and 'RefreshControl' not in m.group(1):
        new_imports = m.group(0).replace('} from', ', RefreshControl } from')
        _s = _s.replace(m.group(0), new_imports, 1)
        with io.open('app/ChatHome.js', 'w', encoding='utf-8') as f: f.write(_s)
        print('  + ChatHome: RefreshControl import: applied')
    elif m:
        print('  = ChatHome: RefreshControl import: already present')
    else:
        FAILS.append('ChatHome: react-native import block not found (drift)')
else:
    print('  = ChatHome: RefreshControl import: already present')

if FAILS:
    print('\nREFUSED — fix drift first:')
    for f in FAILS: print('  ✗', f)
    sys.exit(1)
print('\ndesk-alive: all patches green.')
