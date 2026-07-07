#!/usr/bin/env python3
# zip54d (client) — THE MEDIA MANAGER'S ROOM
#   1) app/MediaRoom.js (payload) — the client brief, dirty-white + fluoro, the lit room
#   2) app/api.js — getMmBrief / saveMmBrief
#   3) app/Nav.js — import + dest.kind 'mmroom' + overlay render (panel pattern)
#   4) app/ChatHome.js — the_media_manager pinned under the GM cluster + PINNED_KEYS
# Anchored, idempotent, atomic. Run from repo root with MediaRoom.js alongside.
import sys, shutil, pathlib

FILES = {p: pathlib.Path(p).read_text(encoding='utf-8') for p in ('app/api.js', 'app/Nav.js', 'app/ChatHome.js')}

if 'zip54d' in FILES['app/Nav.js']:
    print('zip54d client already applied — nothing to do.'); sys.exit(0)

HERE = pathlib.Path(__file__).parent
if not (HERE / 'MediaRoom.js').exists():
    print('MISSING PAYLOAD: MediaRoom.js'); sys.exit(1)

EDITS = {
 'app/api.js': [
  (
   "export async function getBattlefieldMotions(tier) {\n"
   "  return authedJSON('GET', '/battlefield/motions' + (tier ? ('?tier=' + tier) : ''));\n"
   "}",
   "export async function getBattlefieldMotions(tier) {\n"
   "  return authedJSON('GET', '/battlefield/motions' + (tier ? ('?tier=' + tier) : ''));\n"
   "}\n"
   "// [zip54d] the client brief — the Media Manager's file on you\n"
   "export async function getMmBrief() { return authedJSON('GET', '/mm/brief'); }\n"
   "export async function saveMmBrief(brief) { return authedJSON('POST', '/mm/brief', brief); }"
  ),
 ],
 'app/Nav.js': [
  (
   "import Panel from './Panel';   // [zip31] the interviewer's front door",
   "import Panel from './Panel';   // [zip31] the interviewer's front door\n"
   "import MediaRoom from './MediaRoom';   // [zip54d] the Media Manager's front door"
  ),
  (
   "    if (dest.kind === 'forge') return setOverlay({ tab: 'forge' });   // [zip23]",
   "    if (dest.kind === 'forge') return setOverlay({ tab: 'forge' });   // [zip23]\n"
   "    if (dest.kind === 'mmroom') return setOverlay({ tab: 'mmroom' });   // [zip54d]"
  ),
  (
   "    if (overlay.tab === 'panel') return <Panel onBack={() => setOverlay(null)} onStart={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', draft, autoSend: true, from: 'panel' }); }} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', from: 'panel' }); }} />;   // [zip31]",
   "    if (overlay.tab === 'panel') return <Panel onBack={() => setOverlay(null)} onStart={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', draft, autoSend: true, from: 'panel' }); }} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', from: 'panel' }); }} />;   // [zip31]\n"
   "    if (overlay.tab === 'mmroom') return <MediaRoom onBack={() => setOverlay(null)} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_media_manager', from: 'mmroom' }); }} />;   // [zip54d]"
  ),
 ],
 'app/ChatHome.js': [
  (
   "  const PINNED_KEYS = new Set(['the_front_desk', 'z', 'z_serious', 'the_grandmaster', 'the_interviewer']);   // [zip28]",
   "  const PINNED_KEYS = new Set(['the_front_desk', 'z', 'z_serious', 'the_grandmaster', 'the_interviewer', 'the_media_manager']);   // [zip28] [zip54d]"
  ),
  (
   "          <Row face={`https://callmez.app/faces/the_interviewer.jpg?v=1`} tone={'rgba(138,160,196,0.35)'} name=\"the interviewer\" line=\"name the company and the chair. i'll run the room the way they will.\" pinned onPress={() => onOpen({ kind: 'panel' /* [zip28][zip31] */ })} />",
   "          <Row face={`https://callmez.app/faces/the_interviewer.jpg?v=1`} tone={'rgba(138,160,196,0.35)'} name=\"the interviewer\" line=\"name the company and the chair. i'll run the room the way they will.\" pinned onPress={() => onOpen({ kind: 'panel' /* [zip28][zip31] */ })} />\n"
   "          <Row face={`https://callmez.app/faces/the_media_manager.jpg?v=1`} tone={'rgba(215,245,60,0.30)'} name=\"the Media Manager\" line=\"file the brief once. i run your career like a business.\" pinned onPress={() => onOpen({ kind: 'mmroom' /* [zip54d] */ })} />"
  ),
 ],
}

for path, edits in EDITS.items():
    for old, _ in edits:
        n = FILES[path].count(old)
        if n != 1:
            print(f'ANCHOR FAIL in {path} (count={n}): {old[:70]!r}...'); sys.exit(1)

for path, edits in EDITS.items():
    for old, new in edits:
        FILES[path] = FILES[path].replace(old, new)

shutil.copyfile(HERE / 'MediaRoom.js', pathlib.Path('app') / 'MediaRoom.js')

for path, text in FILES.items():
    p = pathlib.Path(path); tmp = p.with_suffix(p.suffix + '.tmp')
    tmp.write_text(text, encoding='utf-8'); tmp.replace(p)

print('zip54d client applied: the Media Manager has his room — the lit floor, the open file, the door under the GM.')
