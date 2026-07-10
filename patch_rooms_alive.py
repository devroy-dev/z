#!/usr/bin/env python3
# patch_rooms_alive.py — [DESK ALIVE, HOUSE-WIDE] wire roomCache into the four
# rooms: hydrate before first paint (useLayoutEffect), persist on fresh data.
# Idempotent + drift-refusing, per house law.
import io, sys
FAILS = []
def patch(path, old, new, name):
    s = io.open(path, encoding='utf-8').read()
    if new in s: print(f'  = {name}: already applied'); return
    if s.count(old) != 1: FAILS.append(f'{name}: anchor {"absent" if old not in s else "not unique"} in {path}'); return
    io.open(path, 'w', encoding='utf-8').write(s.replace(old, new)); print(f'  + {name}: applied')

# ── MEDIA MANAGER ─────────────────────────────────────────────────────────────
patch('app/MediaRoom.js',
"import React, { useEffect, useState, useCallback } from 'react';",
"import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';\nimport { roomCache, saveRoomCache } from './roomCache';   // [rooms-alive]",
'mm: imports')
patch('app/MediaRoom.js',
"  useEffect(() => { load(); }, [load]);",
"""  // [rooms-alive] paint the last known desk BEFORE first frame; network refreshes behind
  useLayoutEffect(() => {
    const c = roomCache('mm'); if (!c) return;
    if (c.notes) setNotes(c.notes); if (c.timeline) setTimeline(c.timeline);
    if (c.brief) setBrief(c.brief); if (c.tasks) setTasks(c.tasks);
    if (c.ideas) setIdeas(c.ideas); if (c.rate) setRate(c.rate);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {   // [rooms-alive] write-through whenever fresh data lands (sentinels guarded in saveRoomCache)
    if (notes === null || tasks === null) return;
    saveRoomCache('mm', { notes, timeline, brief, tasks, ideas, rate });
  }, [notes, timeline, brief, tasks, ideas, rate]);""",
'mm: hydrate + persist')

# ── STYLIST ───────────────────────────────────────────────────────────────────
patch('app/StylistRoom.js',
"import React, { useEffect, useState, useCallback } from 'react';",
"import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';\nimport { roomCache, saveRoomCache } from './roomCache';   // [rooms-alive]",
'stylist: imports')
patch('app/StylistRoom.js',
"  useEffect(() => { load(); }, [load]);",
"""  // [rooms-alive] the closet paints from memory before first frame
  useLayoutEffect(() => {
    const c = roomCache('stylist'); if (!c) return;
    if (c.pieces) setPieces(c.pieces); if (c.outfits) setOutfits(c.outfits); if (c.gaps) setGaps(c.gaps);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {   // [rooms-alive]
    if (pieces === null) return;
    saveRoomCache('stylist', { pieces, outfits, gaps });
  }, [pieces, outfits, gaps]);""",
'stylist: hydrate + persist')

# ── TRAVEL DESK ───────────────────────────────────────────────────────────────
patch('app/TravelDesk.js',
"import React, { useEffect, useState, useCallback } from 'react';",
"import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';\nimport { roomCache, saveRoomCache } from './roomCache';   // [rooms-alive]",
'travel: imports')
patch('app/TravelDesk.js',
"  useEffect(() => { load(); }, [load]);",
"""  // [rooms-alive] the trips paint from memory before first frame
  useLayoutEffect(() => { const c = roomCache('travel'); if (c?.trips) setTrips(c.trips); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (trips !== null) saveRoomCache('travel', { trips }); }, [trips]);   // [rooms-alive]""",
'travel: hydrate + persist')

# ── NEWSROOM ──────────────────────────────────────────────────────────────────
patch('app/Bulletin.js',
"import React, { useEffect, useState } from 'react';",
"import React, { useEffect, useLayoutEffect, useState } from 'react';\nimport { roomCache, saveRoomCache } from './roomCache';   // [rooms-alive]",
'bulletin: imports')
patch('app/Bulletin.js',
"  useEffect(() => { load(); }, []);",
"""  // [rooms-alive] the edition paints from memory before first frame
  useLayoutEffect(() => {
    const c = roomCache('bulletin'); if (!c) return;
    if (c.feed) setFeed(c.feed); if (c.wireItems?.length) setWireItems(c.wireItems);
    if (c.follows?.length) setFollows(c.follows); if (c.deskItems?.length) setDeskItems(c.deskItems);
    if (c.factHistory?.length) setFactHistory(c.factHistory);
  }, []);
  useEffect(() => { load(); }, []);
  useEffect(() => {   // [rooms-alive]
    if (!feed) return;
    saveRoomCache('bulletin', { feed, wireItems, follows, deskItems, factHistory });
  }, [feed, wireItems, follows, deskItems, factHistory]);""",
'bulletin: hydrate + persist')

# ── NEWSROOM latency: feed → wire → desk were SEQUENTIAL awaits; run concurrent ──
patch('app/Bulletin.js',
"""    try { const f = await getBulletinFeed(); setFeed(f || { local: [], national: [], city: null }); setFeedErr(false); }
    catch (e) { setFeedErr(true); }
    try { const w = await getWireFeed(null, true); if (w?.items?.length) setWireItems(w.items); } catch (e) {}   // [zip67] refresh ALWAYS moves the wire
    loadDesk();""",
"""    await Promise.all([   // [rooms-alive] three sequential awaits were a third of the felt delay
      getBulletinFeed().then((f) => { setFeed(f || { local: [], national: [], city: null }); setFeedErr(false); }).catch(() => setFeedErr(true)),
      getWireFeed(null, true).then((w) => { if (w?.items?.length) setWireItems(w.items); }).catch(() => {}),   // [zip67] refresh ALWAYS moves the wire
      loadDesk(),
    ]);""",
'bulletin: concurrent load')

if FAILS:
    print('\nREFUSED — fix drift first:')
    for f in FAILS: print('  ✗', f)
    sys.exit(1)
print('\nrooms-alive: all patches green.')
