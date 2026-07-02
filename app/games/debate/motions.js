// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE MOTIONS LIBRARY. Debate Zone's repertoire: real clash in
//  every one, both sides arguable at strength. Global English register.
//  Categories keep the shelf browsable; shuffleMotions feeds the marquee.
// ════════════════════════════════════════════════════════════════════════

export const MOTION_CATS = [
  { id: 'tech',   label: 'machines & us' },
  { id: 'soc',    label: 'society' },
  { id: 'money',  label: 'money & work' },
  { id: 'phil',   label: 'big questions' },
  { id: 'pop',    label: 'culture' },
  { id: 'spice',  label: 'spicy & fun' },
];

export const MOTIONS = [
  // machines & us
  { id: 'ai_teachers',   c: 'tech',  text: 'AI tutors will do more for education than human teachers ever did.' },
  { id: 'social_ban16',  c: 'tech',  text: 'Social media should be banned for everyone under 16.' },
  { id: 'ai_art',        c: 'tech',  text: 'AI-generated art is real art.' },
  { id: 'phone_class',   c: 'tech',  text: 'Phones should be locked away during school and college hours.' },
  { id: 'anon_internet', c: 'tech',  text: 'Online anonymity does more harm than good.' },
  { id: 'space_money',   c: 'tech',  text: 'Space exploration is a luxury we cannot justify while people go hungry.' },
  { id: 'ai_friend',     c: 'tech',  text: 'An AI companion can be a real friend.' },
  // society
  { id: 'vote16',        c: 'soc',   text: 'The voting age should be lowered to 16.' },
  { id: 'exam_system',   c: 'soc',   text: 'High-stakes entrance exams do more damage than good.' },
  { id: 'city_village',  c: 'soc',   text: 'The future belongs to villages and small towns, not megacities.' },
  { id: 'english_ladder',c: 'soc',   text: 'English fluency matters more than any degree.' },
  { id: 'arranged_love', c: 'soc',   text: 'Arranged marriages are, on average, wiser than love marriages.' },
  { id: 'jury_public',   c: 'soc',   text: 'Cameras should be banned from courtrooms.' },
  { id: 'zoo_ethics',    c: 'soc',   text: 'Zoos should be abolished.' },
  // money & work
  { id: 'ubi',           c: 'money', text: 'A universal basic income is the only sane response to automation.' },
  { id: 'hustle',        c: 'money', text: 'Hustle culture has ruined a generation.' },
  { id: 'wfh',           c: 'money', text: 'The office is dead, and companies forcing a return are dinosaurs.' },
  { id: 'family_biz',    c: 'money', text: 'Joining the family business beats chasing a corporate career.' },
  { id: 'billionaires',  c: 'money', text: 'No one should be a billionaire.' },
  { id: 'college_worth', c: 'money', text: 'For most people, college is no longer worth it.' },
  // big questions
  { id: 'white_lies',    c: 'phil',  text: 'A world without lies would be unbearable.' },
  { id: 'luck_merit',    c: 'phil',  text: 'Success is mostly luck, and pretending otherwise is cruel.' },
  { id: 'forgive',       c: 'phil',  text: 'Some things should never be forgiven.' },
  { id: 'happy_pill',    c: 'phil',  text: 'If a pill guaranteed happiness, taking it would be a mistake.' },
  { id: 'know_future',   c: 'phil',  text: 'If you could know your future, you should refuse to look.' },
  { id: 'ambition',      c: 'phil',  text: 'Contentment is a nobler goal than ambition.' },
  { id: 'privacy_dead',  c: 'phil',  text: 'Privacy is already dead, and mourning it is a waste of time.' },
  // culture
  { id: 'remakes',       c: 'pop',   text: 'Remakes and sequels are strangling cinema.' },
  { id: 'cricket_t20',   c: 'pop',   text: 'T20 has ruined cricket.' },
  { id: 'spoilers',      c: 'pop',   text: 'Spoilers do not actually spoil anything.' },
  { id: 'award_shows',   c: 'pop',   text: 'Award shows are meaningless and should be ignored.' },
  { id: 'books_films',   c: 'pop',   text: 'The book is not always better than the film.' },
  { id: 'stan_culture',  c: 'pop',   text: 'Fan culture has become indistinguishable from religion.' },
  // spicy & fun
  { id: 'breakfast',     c: 'spice', text: 'Breakfast is a scam invented to sell cereal.' },
  { id: 'small_talk',    c: 'spice', text: 'Small talk is a social good and people who hate it are wrong.' },
  { id: 'pineapple',     c: 'spice', text: 'Pineapple belongs on pizza, and the backlash is pure snobbery.' },
  { id: 'early_bird',    c: 'spice', text: 'Night owls are more creative than early risers.' },
  { id: 'gift_cards',    c: 'spice', text: 'Giving cash beats giving gifts, always.' },
  { id: 'queue_jump',    c: 'spice', text: 'There is never a good reason to jump a queue.' },
];

export function shuffleMotions(n = 5) {
  const a = MOTIONS.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
