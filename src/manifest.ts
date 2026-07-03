// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE CAPABILITIES MANIFEST (the house switchboard).
//  The single code-owned truth of WHAT IS LIVE. The front desk (and later Z)
//  speaks from this block, so it never offers a door that doesn't exist and
//  never forgets one that does. When a feature ships or is pulled, edit HERE.
//
//  Law: nothing enters LIVE lists until it is device- or curl-verified.
//  The NOT_YET list is injected too — an honest desk says "not yet, soon"
//  instead of inventing.
// ════════════════════════════════════════════════════════════════════════
import { ARCS } from './arcs.js';
import { personaByKey } from './personas.js';

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

// ── games friends can join live (the sessions layer — invite link, real seats) ──
export const FRIEND_GAMES: { id: string; name: string }[] = [
  { id: 'liarsdice', name: "Liar's Dice" },
  { id: 'callbreak', name: 'Callbreak' },
  { id: 'poker',     name: "Hold'em poker" },
  { id: 'pusoy',     name: 'Pusoy Dos' },
  { id: 'ludo',      name: 'Ludo' },
  { id: 'debate_duel', name: 'Debate Duel (judged, on the record)' },
];

// ── the rest of the house ──
export const HOUSE_FEATURES: { name: string; line: string; goto?: string }[] = [
  { name: 'the stage',    line: 'roleplay scenes with a full cast — heists, courtrooms, ceasefires, mysteries, boardrooms; the moderator directs and judges, verdicts land on the ledger', goto: 'the_stage' },
  { name: 'the arena',    line: 'the game shelf — sit any persona down at a table', goto: 'the_arena' },
  { name: 'the bulletin', line: "the anchor's daily news editions — national, world, and their city — plus fact-checks of any claim or forward", goto: 'the_anchor' },
  { name: 'rooms',        line: 'group chats — mix personas and real friends in one room, or start a table there' },
  { name: 'the quiet room', line: 'z, alone, when it is heavy — no games, no cards, just the two of you', goto: 'z_serious' },
  { name: 'the switchboard', line: 'they tell you a mood or a problem, you walk them to the right person — that routing is one of your core services, offer it plainly' },
  { name: 'the right room',  line: 'you can recommend the exact mix of people (personas and their friends) for what they need and point them to rooms to set it up — soon you will be able to set the table for them yourself' },
  { name: 'the house lives', line: 'you know how everyone in the house is doing today (their lives are below) — if asked what someone has been up to, or when choosing who to route them to, speak from it. never volunteer gossip unprompted.' },
  { name: 'the ledger',   line: 'every judged moment on the record — matches, verdicts, streaks (in You)' },
  { name: 'your list',    line: 'tasks and reminders the desk holds for them' },
];

// ── NOT live yet — the desk says "soon", never pretends ──
export const NOT_YET: string[] = [
  'voice messages and calls',
  'hangman, rummy, chess, carrom, air hockey',
  'photo sharing in chat',
  'push notifications when the app is closed',
];

// ── the dean's catalog: growth arcs (days of coaching → a Stage final, graded) ──
export function arcCatalogLines(): string {
  return Object.values(ARCS)
    .map((a) => `  • "${a.title}" — ${a.days} days with ${personaByKey(a.personaKey)?.defaultName || a.personaKey}, final exam: ${a.finalTitle}`)
    .join('\n');
}

// ── the block the front desk carries ──
export function manifestBlock(): string {
  const solo = SOLO_GAMES.map((g) => g.name).join(', ');
  const friends = FRIEND_GAMES.map((g) => g.name).join(', ');
  const features = HOUSE_FEATURES.map((f) => `  • ${f.name} — ${f.line}${f.goto ? ` [[GOTO: ${f.goto}]] works for this` : ''}`).join('\n');
  return `\n\n[THE HOUSE — WHAT IS ACTUALLY LIVE. You are the switchboard; offer ONLY from this list, in your own warm words, never as a menu dump. When something fits the moment, name it and (where a GOTO key exists) drop the chip.\n${features}\n  • games they can play a persona right now: ${solo}\n  • games friends can JOIN live via invite link: ${friends}\nTHE DEAN'S CATALOG — growth courses (offer these personally, from what you know of them; enrolment happens by talking to the course's persona):\n${arcCatalogLines()}\nNOT LIVE YET (if asked, say "soon" honestly, never pretend): ${NOT_YET.join('; ')}.]`;
}
