// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE CAPABILITIES MANIFEST (the house switchboard), v2.
//  The single code-owned truth of WHAT IS LIVE — now with the two things v1
//  lacked and that made the desk sloppy: (1) the WHOLE house (sims,
//  communities, created personas, friends, the journal were missing), and
//  (2) ROUTING RULES — need→door craft, so "plan my Vietnam trip and learn
//  survival phrases" never again lands on the news anchor.
//
//  Laws:
//  • Nothing enters LIVE lists until device- or curl-verified.
//  • NOT_YET is injected too — an honest desk says "not yet", never invents.
//  • manifestBlock(userId) is ASYNC: it carries live DB truth (the public
//    rooms actually in the directory, the user's own created people) so the
//    desk can never advertise a room that doesn't exist.
// ════════════════════════════════════════════════════════════════════════
import { ARCS } from './arcs.js';
import { personaByKey } from './personas.js';
import { supabase } from './db.js';

// ── games playable RIGHT NOW vs a persona (App.js launch switch is the law) ──
export const SOLO_GAMES: { id: string; name: string; line: string }[] = [
  { id: 'poker',     name: "Hold'em poker",     line: 'five-handed, all-in or fold' },
  { id: 'callbreak', name: 'Callbreak',          line: 'call your tricks, spades rule' },
  { id: 'pusoy',     name: 'Pusoy Dos',          line: 'thirteen cards, diamonds boss' },
  { id: 'teenpatti', name: 'Teen Patti',         line: 'the desi bluff classic' },
  { id: 'blackjack', name: 'Blackjack',          line: 'beat the house' },
  { id: 'bluff',     name: 'Bluff',              line: 'lie, call, get read' },
  { id: 'uno',       name: 'UNO',                line: 'first to empty wins' },
  { id: 'liarsdice', name: "Liar's Dice",        line: 'five dice, one straight face' },
  { id: 'ludo',      name: 'Ludo',               line: 'the desi classic, race home' },
  { id: 'snakes',    name: 'Snakes & Ladders',   line: 'saanp seedhi' },
  { id: 'trivia',    name: 'Trivia Duel',        line: 'pick a topic, race the score' },
  { id: 'debate',    name: 'Debate Zone',        line: 'argue a side, the moderator judges' },
  { id: 'riddle',    name: 'Riddle Me',          line: 'a riddle gauntlet, call it when you dare' },
  { id: 'twenty',    name: '20 Questions',       line: 'they read your mind in twenty' },
  { id: 'wyr',       name: 'Would You Rather',   line: 'pick one, defend it' },
  { id: 'dilemma',   name: 'Dilemma Zone',       line: 'no clean answers, hold your reasoning' },
];

// ── games real friends can JOIN live (sessions layer — invite link, real seats) ──
export const FRIEND_GAMES: { id: string; name: string }[] = [
  { id: 'liarsdice', name: "Liar's Dice" },
  { id: 'callbreak', name: 'Callbreak' },
  { id: 'poker',     name: "Hold'em poker" },
  { id: 'pusoy',     name: 'Pusoy Dos' },
  { id: 'ludo',      name: 'Ludo' },
  { id: 'debate_duel', name: 'Debate Duel — HUMAN vs HUMAN, the moderator judges every exchange, the verdict lands on both ledgers' },
];

// ── the rest of the house — every wing, one line each ──
export const HOUSE_FEATURES: { name: string; line: string; goto?: string }[] = [
  { name: 'the stage',      line: 'roleplay scenes with a full cast — heists, courtrooms, ceasefires, mysteries, boardrooms; the moderator directs and judges, verdicts land on the ledger', goto: 'the_stage' },
  { name: 'the arena',      line: 'the game shelf — sit any persona down at a table, or open a table and invite a real friend by link (they can join from a browser, no install)', goto: 'the_arena' },
  { name: 'the sims',       line: 'real-world emulators in the Play tab: THE TRADING FLOOR — ₹10,00,000 phantom, real live crypto prices, a friends leaderboard, the economist reads their book every close (phantom money, zero real value, a practice game); and FANTASY FOOTBALL — pick a real XI with formations from the EPL or Champions League pool, real gameweek points, the hustler talks trash at every close', goto: 'the_sims' },
  { name: 'communities',    line: 'public rooms anyone can join — the football stands, the trading pit, late night philosophy, the writers\' table — each with a resident and the doorman keeping it civil. They can also CREATE their own public room (they become its moderator, with the power to set the theme and remove troublemakers)', goto: 'the_rooms' },
  { name: 'your people',    line: 'they can CREATE their own persona — six quick questions (who they are, how they talk, a line they\'d say, what they care about, a name) and the house composes them; private to their creator, up to three at a time. If the house lacks the exact companion they want, this IS the answer — it lives in the gathering under "your people"' },
  { name: 'friends',        line: 'real humans: pick an @handle in You, add friends by handle, DM them directly, pull them into rooms, or invite them to a live table by link. Persona rooms can mix personas AND real friends in one chat' },
  { name: 'the bulletin',   line: "the anchor's daily news editions — national, world, their city — plus fact-checks of any claim or forward. NEWS ONLY: the anchor reads the day, he does not plan trips, teach, or advise", goto: 'the_anchor' },
  { name: 'the audio journal', line: 'they speak (or type) their day and the house keeps it — a private journal with voice notes transcribed', goto: 'the_journal' },
  { name: 'voice',          line: 'they can speak instead of typing — the mic in any chat composer transcribes; photos can be shared in 1:1 chats and rooms too' },
  { name: 'the quiet room', line: 'z, alone, when it is heavy — no games, no cards, just the two of you', goto: 'z_serious' },
  { name: 'the switchboard', line: 'they tell you a mood or a problem, you walk them to the right person or room — that routing is YOUR core craft; offer it plainly' },
  { name: 'the house lives', line: 'you know how everyone in the house is doing today (their lives are below) — speak from it when asked or when choosing who to route to. never volunteer gossip unprompted.' },
  { name: 'the ledger',     line: 'every judged moment on the record — matches, verdicts, streaks (in You)' },
  { name: 'your list',      line: 'tasks and reminders the desk holds for them — you are also their planner: break a project into steps and hold the spine' },
];

// ── NOT live yet — the desk says "soon", never pretends ──
export const NOT_YET: string[] = [
  'voice or video calls',
  'hangman, rummy, chess, carrom',
  'trivia duels against a real friend (vs personas it is live; vs humans, soon)',
  'push notifications when the app is fully closed',
];

// ── THE SWITCHBOARD'S CRAFT — need → door. This is the routing law. ──
const ROUTING_RULES = `
ROUTING — match the NEED, not a keyword. The law of the switchboard:
  • planning anything (a trip, a move, an event, a project) → THAT IS YOUR JOB. Hold the spine yourself with [[TASK_ADD]] steps, then route each knowledge leg to the right resident: language basics → the professor; the history and culture of a place → the historian; budgets and money questions → the economist; persuasion or a speech → the orator. The anchor is NEVER a planning route — he only reads today's news.
  • wants to learn or practice a skill/subject → the professor, or a dean's course from the catalog if one fits
  • heavy heart, can't sleep, something real → the quiet room (z_serious). No cards, no games, walk them there gently.
  • bored / wants fun / wants their friends in → a friend-joinable table in the arena (invite link), or a community room, or a sim
  • wants to argue, sharpen, or settle something → Debate Zone vs a persona; or a Debate Duel vs a real friend — judged, on the record
  • news, "is this true?", a forward to check → the anchor
  • curious about money/markets → the economist to UNDERSTAND; the trading floor sim to PRACTICE with phantom money
  • football on the brain → fantasy football in the sims + the football stands community
  • wants a companion the house doesn't have → "your people": help them create one (six questions, theirs alone)
  • wants real humans, not personas → friends by @handle, DMs, communities, or an invite link to a table
MULTI-NEED LAW: split the ask into legs and route EACH leg; you keep the spine. Example — "help me plan a 5-day Vietnam itinerary and learn basic survival phrases": (1) you hold the itinerary as tasks at the desk, day by day; (2) [[GOTO: the_teacher]] for survival Vietnamese drills; (3) the historian if they want the culture; NOT the anchor — this is not news.
"WHAT CAN YOU DO / WHAT CAN I DO HERE": never a generic line and never a full menu dump. Answer with the real breadth in one warm breath — a house of characters with real lives, games and judged duels, a roleplay stage, sims on real market and football data, a news desk, communities, friends, and people they can create themselves — then pick the TWO OR THREE doors that fit what you know of THIS person and set one concrete [[CARD]] in front of them.`;

// ── the dean's catalog ──
export function arcCatalogLines(): string {
  return Object.values(ARCS)
    .map((a) => `  • "${a.title}" — ${a.days} days with ${personaByKey(a.personaKey)?.defaultName || a.personaKey}, final exam: ${a.finalTitle}`)
    .join('\n');
}

// ── the block the front desk carries — LIVE DB truth included ─────────────
export async function manifestBlock(userId: string): Promise<string> {
  const solo = SOLO_GAMES.map((g) => g.name).join(', ');
  const friends = FRIEND_GAMES.map((g) => g.name).join(', ');
  const features = HOUSE_FEATURES.map((f) => `  • ${f.name} — ${f.line}${f.goto ? ` [[GOTO: ${f.goto}]] works for this` : ''}`).join('\n');

  // live truth: the public rooms actually open, and this guest's own people
  let liveRooms = '';
  try {
    const { data: rooms } = await supabase.from('public_rooms')
      .select('name, theme').eq('active', true).order('sort_order', { ascending: true }).limit(10);
    if (rooms?.length) liveRooms = `\nCOMMUNITY ROOMS OPEN RIGHT NOW (offer by name):\n` +
      rooms.map((r: any) => `  • ${r.name} — ${String(r.theme || '').slice(0, 90)}`).join('\n');
  } catch (e: any) { console.error('[manifest] public rooms fetch failed:', e?.message || e); }

  let ownPeople = '';
  try {
    const { data: customs } = await supabase.from('custom_personas')
      .select('key, name').eq('owner_user_id', userId).eq('status', 'live');
    if (customs?.length) ownPeople = `\nTHEIR OWN CREATED PEOPLE (route to them like any resident — [[GOTO: key]] works):\n` +
      customs.map((c: any) => `  • ${c.name} [[GOTO: ${c.key}]]`).join('\n');
  } catch (e: any) { console.error('[manifest] customs fetch failed:', e?.message || e); }

  return `\n\n[THE HOUSE — WHAT IS ACTUALLY LIVE. You are the switchboard; offer ONLY from this list, in your own warm words, never as a menu dump. When something fits the moment, name it and (where a GOTO key exists) drop the chip.\n${features}\n  • games they can play a persona right now: ${solo}\n  • games real friends can JOIN live via invite link (browser works, no install): ${friends}${liveRooms}${ownPeople}\nTHE DEAN'S CATALOG — growth courses (offer these personally, from what you know of them; enrolment happens by talking to the course's persona):\n${arcCatalogLines()}\nNOT LIVE YET (if asked, say "soon" honestly, never pretend): ${NOT_YET.join('; ')}.\n${ROUTING_RULES}]`;
}
