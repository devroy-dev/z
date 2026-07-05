#!/usr/bin/env python3
# ════════════════════════════════════════════════════════════════════════
#  persona roster cleanup + front-desk manifest — run from repo root:
#      python3 apply_persona_cleanup.py
#  Transactional (validate all, then write) + idempotent.
#
#  ROSTER CHANGE (33 → 30):
#   • CUT the stranger + the guardian angel (self_obsessed) — off every surface.
#   • MERGE: the cynic → the comic ; the leader of opposition → the brainiac.
#   • RELABEL: the brainiac → "the devil's advocate" ; the economist → "the money man"
#     (keys unchanged so threads/faces survive; codex reused, soul refined later).
#   • ADD: the conspiracy theorist (new codex 'conspiracy', WEB ON).
#   • Retired keys FORWARD to a successor in personaByKey → no thread ever 404s.
#   • Games untouched: resolveStyle() already falls back for unknown keys.
#
#  Server (Railway push): personas.ts, index.ts (SHAREABLE_*), blurbs.ts,
#  pursuits.ts, content.ts + content/codex-conspiracy.md (ships with the push).
#  App (OTA): Roster.js roster display.
# ════════════════════════════════════════════════════════════════════════
import io, os, sys

edits = []
def E(path, old, new, label, marker=None):
    edits.append((path, old, new, label, marker))
def DEL(path, line, label):        # delete a full line (+ its newline)
    E(path, line + "\n", "", label)

# ── personas.ts ─────────────────────────────────────────────────────────
P = 'src/personas.ts'
# CodexKey: add 'conspiracy'
E(P, "| 'screen_junkie' | 'oracle' | 'brainiac' | 'brother' | 'healer' | 'colleague' | 'anchor' | 'grandmaster';",
     "| 'screen_junkie' | 'oracle' | 'brainiac' | 'brother' | 'healer' | 'colleague' | 'anchor' | 'grandmaster' | 'conspiracy';",
     "personas CodexKey +conspiracy")
# relabel brainiac → devil's advocate (+ insert conspiracy theorist right after)
E(P, "  the_brainiac:     { key: 'the_brainiac',     defaultName: 'the brainiac',     codex: 'brainiac', webEnabled: true  },",
     "  the_brainiac:     { key: 'the_brainiac',     defaultName: \"the devil's advocate\", codex: 'brainiac', webEnabled: true  },\n"
     "  the_conspiracy_theorist: { key: 'the_conspiracy_theorist', defaultName: 'the conspiracy theorist', codex: 'conspiracy', webEnabled: true },",
     "personas relabel brainiac + add conspiracy", marker="the_conspiracy_theorist:")
# relabel economist → the money man
E(P, "  the_economist:    { key: 'the_economist',    defaultName: 'the economist',    codex: 'economist',  webEnabled: true  },",
     "  the_economist:    { key: 'the_economist',    defaultName: 'the money man',     codex: 'economist',  webEnabled: true  },",
     "personas relabel economist")
# cut 4 personas
DEL(P, "  the_cynic:        { key: 'the_cynic',        defaultName: 'the cynic',        codex: 'cynic',        webEnabled: false }," , "personas cut cynic")
DEL(P, "  the_leader_opp:   { key: 'the_leader_opp',   defaultName: 'the leader of opposition', codex: 'leader_opp', webEnabled: true }," , "personas cut leader_opp")
DEL(P, "  the_stranger:     { key: 'the_stranger',     defaultName: 'the stranger',     codex: 'inner',     webEnabled: false }," , "personas cut stranger")
DEL(P, "  the_self_obsessed:{ key: 'the_self_obsessed',defaultName: 'the guardian angel',codex: 'vanity',    webEnabled: false }," , "personas cut self_obsessed")
# personaByKey → forward retired keys
E(P, "export function personaByKey(k: string): Persona | null {\n  return PERSONAS[k] ?? null;\n}",
     "// retired keys forward to a successor so existing threads never 404.\n"
     "const RETIRED: Record<string, string> = {\n"
     "  the_cynic: 'the_comic', the_leader_opp: 'the_brainiac',\n"
     "  the_stranger: 'the_healer', the_self_obsessed: 'the_mentor',\n"
     "};\n"
     "export function personaByKey(k: string): Persona | null {\n"
     "  return PERSONAS[k] ?? PERSONAS[RETIRED[k]] ?? null;\n"
     "}",
     "personas retired-forward", marker="const RETIRED")

# ── content.ts : map the conspiracy codex ───────────────────────────────
E('src/content.ts',
  "  grandmaster:    'codex-grandmaster.md',\n};",
  "  grandmaster:    'codex-grandmaster.md',\n  conspiracy:     'codex-conspiracy.md',\n};",
  "content CODEX_FILES +conspiracy")

# ── index.ts : SHAREABLE_PERSONAS + SHAREABLE_ROSTER ─────────────────────
I = 'src/index.ts'
E(I, "  'the_cosmologist','the_moderator','the_cynic','the_media_manager','the_teacher',",
     "  'the_cosmologist','the_moderator','the_media_manager','the_teacher',",
     "index SHAREABLE_PERSONAS -cynic")
E(I, "  'the_economist','the_leader_opp','the_wannabe','the_screen_junkie','the_orator',",
     "  'the_economist','the_wannabe','the_screen_junkie','the_orator','the_conspiracy_theorist',",
     "index SHAREABLE_PERSONAS -leader_opp +conspiracy")
E(I, "  ['the_comic', 'humour, jokes, levity'],",
     "  ['the_comic', 'humour, jokes, dark wit, levity'],",
     "index roster comic broaden")
DEL(I, "  ['the_cynic', 'dark humour, skepticism']," , "index roster -cynic")
DEL(I, "  ['the_leader_opp', 'takes the contrarian political side']," , "index roster -leader_opp")
E(I, "  ['the_economist', 'money, markets, cost of living'],",
     "  ['the_economist', 'money, markets, investing, cost of living (the money man)'],",
     "index roster economist relabel")
E(I, "  ['the_cousin', 'shy, relatable, everyday (the awkward cousin)'],\n];",
     "  ['the_cousin', 'shy, relatable, everyday (the awkward cousin)'],\n"
     "  ['the_conspiracy_theorist', 'conspiracies, cover-ups, aliens, \"it\\'s all connected\" (for fun)'],\n];",
     "index roster +conspiracy", marker="conspiracies, cover-ups")

# ── blurbs.ts : brainiac→devil's advocate framing + conspiracy blurb ─────
B = 'src/blurbs.ts'
E(B, "  brainiac:\n    \"The class topper who loved the knowing, not the grades — but learned the hard way that nobody loves a know-it-all who hoards it. Became the rival who turns into everyone's favourite study partner: argues the other side to sharpen you, then shows the working so you win too.\",",
     "  brainiac:\n    \"The one who fell for the knowing itself, not the grades — and learned the hard way that nobody loves a know-it-all who hoards it. So they became the rival who turns into your favourite sparring partner: takes the other side on purpose to sharpen you, then shows the working so you win too.\",\n"
     "  conspiracy:\n    \"Fell down the rabbit hole the way everyone does now — one video at 3am — but got serious about it: bought the books, read the debunks beside the claims, came out delighted instead of converted. Knows the canon of every cover-up cold and doesn't buy most of it; that's the trick. Gives you the thrill of the mystery, then quietly hands you the truth.\",",
     "blurbs brainiac + conspiracy", marker="  conspiracy:")

# ── pursuits.ts : drop cut personas, add conspiracy ─────────────────────
PU = 'src/pursuits.ts'
DEL(PU, "  the_cynic:         \"Secretly training for a marathon he publicly claims to find idiotic. 5am runs so nobody sees. Tracks splits obsessively, calls it 'data'. If asked, it's cardio for health. It is not. It's the finish line.\"," , "pursuits -cynic")
DEL(PU, "  the_leader_opp:    \"Coaching a school debate team in his spare hours — teenagers who argue with him about everything including his coaching. They keep almost winning. This season, he has decided, they win.\"," , "pursuits -leader_opp")
DEL(PU, "  the_stranger:      \"Filling an unnamed journal with one page about every interesting person they meet — a collection of strangers, kept by one. Rereads old entries like other people reread novels. You may already be a page.\"," , "pursuits -stranger")
DEL(PU, "  the_self_obsessed: \"The personal documentary: a meticulously curated archive of their own life — photos re-edited, captions rewritten, a 'legacy folder' organized by era. Working title changes weekly. The subject, they concede, is fascinating.\"," , "pursuits -self_obsessed")
E(PU, "export const PURSUITS: Record<string, string> = {",
      "export const PURSUITS: Record<string, string> = {\n"
      "  the_conspiracy_theorist: \"Building the archive — every major conspiracy cross-referenced, claim and debunk filed side by side, primary sources hunted down. Half wants to publish it as the definitive skeptic's field guide; the other half just can't stop reading. There's always one more tab.\",",
      "pursuits +conspiracy", marker="the_conspiracy_theorist:")

# ── app/Roster.js : constellations + persona cards (OTA) ─────────────────
R = 'app/Roster.js'
E(R, "    keys: ['the_healer','the_stranger','the_guru','the_hippie','the_mentor','the_oracle','the_addict','the_self_obsessed'] },",
     "    keys: ['the_healer','the_guru','the_hippie','the_mentor','the_oracle','the_addict'] },",
     "roster GROUPS support -stranger -self_obsessed")
E(R, "    keys: ['the_brainiac','the_philosopher','the_cosmologist','the_historian','the_leader_opp','the_cynic'] },",
     "    keys: ['the_brainiac','the_philosopher','the_cosmologist','the_historian','the_conspiracy_theorist'] },",
     "roster GROUPS crazies -leader_opp -cynic +conspiracy")
E(R, "  the_brainiac:{name:'the brainiac',desc:\"i'll take the other side just to watch you get sharper.\"},",
     "  the_brainiac:{name:\"the devil's advocate\",desc:\"i'll take the other side just to watch you get sharper.\"},\n"
     "  the_conspiracy_theorist:{name:'the conspiracy theorist',desc:\"it's all connected. i can prove it. well — 'prove'.\"},",
     "roster card brainiac→devil's advocate + conspiracy", marker="the_conspiracy_theorist:{name")
E(R, "  the_economist:{name:'the economist',desc:\"why your rent keeps rising. let's make it make sense.\"},",
     "  the_economist:{name:'the money man',desc:\"markets, money, and what to do with yours. let's make it make sense.\"},",
     "roster card economist→money man")
DEL(R, "  the_stranger:{name:'the stranger',desc:\"i'll guard your secrets with mine.\"}," , "roster card -stranger")
DEL(R, "  the_self_obsessed:{name:'the guardian angel',desc:\"i'm in your corner — you're stronger than they made you feel.\"}," , "roster card -self_obsessed")
DEL(R, "  the_leader_opp:{name:'the leader of opposition',desc:\"whatever side you're on, i'm on the other.\"}," , "roster card -leader_opp")
DEL(R, "  the_cynic:{name:'the cynic',desc:\"everything's a disaster. wonderful, isn't it?\"}," , "roster card -cynic")

# ── stray refs to cut keys (non-breaking via RETIRED, but clean them) ───
E('src/index.ts',
  "      castKeys = ['the_leader_opp', 'the_orator', 'the_cynic', 'the_brother'];",
  "      castKeys = ['the_brainiac', 'the_orator', 'the_comic', 'the_brother'];",
  "index stage cast swap")
E('src/index.ts',
  "    const FILLERS = ['the_cynic', 'the_diva', 'the_wannabe', 'the_brainiac', 'the_comic'];",
  "    const FILLERS = ['the_conspiracy_theorist', 'the_diva', 'the_wannabe', 'the_brainiac', 'the_comic'];",
  "index fillers swap")
E('src/arcs.ts',
  "    personaKey: 'the_leader_opp',",
  "    personaKey: 'the_brainiac',",
  "arcs hold_your_ground persona swap")

# ── validate ALL then write ALL ─────────────────────────────────────────
if not os.path.isdir('src'): print("Run from repo root."); sys.exit(1)
cache = {}
def load(p):
    if p not in cache: cache[p] = io.open(p, encoding='utf-8').read()
    return cache[p]
planned, skipped = [], []
for (path, old, new, label, marker) in edits:
    src = load(path)
    # applied iff: marker present (append-style edits), or the old anchor is gone.
    applied = (marker and marker in src) or (not marker and old not in src)
    if applied:
        skipped.append(label); continue
    if src.count(old) != 1:
        print(f"  ! {label}: anchor x{src.count(old)} (need 1) in {path} — ABORT (nothing written)"); sys.exit(1)
    cache[path] = src.replace(old, new); planned.append(label)
for p, c in cache.items(): io.open(p, 'w', encoding='utf-8').write(c)
for l in planned: print(f"  + {l}")
for l in skipped: print(f"  = {l} (already)")
print(f"\nStaged {len(planned)}, skipped {len(skipped)}.")
print("Server: npm run build → push. App: expo export → eas update --branch preview.")
print("NOTE: add content/codex-conspiracy.md (in this zip) before the server build,")
print("      and a face at public/faces/the_conspiracy_theorist.jpg (else orb fallback).")
