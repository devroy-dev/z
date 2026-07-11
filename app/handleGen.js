// ════════════════════════════════════════════════════════════════════════
//  yourZ — handleGen · adjective-animal aliases for the public floor (R1).
//  Suggested at the doorway, rerollable, hand-editable. The server is the
//  real gate (shape, doorman check, per-room uniqueness, first-message lock);
//  this just makes good first suggestions.
// ════════════════════════════════════════════════════════════════════════
const ADJ = [
  'quiet', 'amber', 'velvet', 'lunar', 'copper', 'wild', 'gentle', 'midnight',
  'golden', 'silver', 'crimson', 'dusty', 'electric', 'mellow', 'swift',
  'patient', 'clever', 'drowsy', 'radiant', 'stubborn', 'curious', 'humble',
  'restless', 'cosmic', 'monsoon', 'winter', 'saffron', 'indigo', 'jade',
  'smoky', 'salty', 'sunny', 'shadow', 'paper', 'neon', 'vintage',
];
const ANIMAL = [
  'tiger', 'sparrow', 'panther', 'mongoose', 'heron', 'lynx', 'otter',
  'falcon', 'tortoise', 'civet', 'macaw', 'panda', 'wolf', 'koel', 'gazelle',
  'badger', 'kingfisher', 'leopard', 'myna', 'ibis', 'fox', 'peacock',
  'drongo', 'marten', 'hare', 'hornbill', 'sambar', 'langur', 'crane', 'orca',
];

export function suggestHandle() {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const b = ANIMAL[Math.floor(Math.random() * ANIMAL.length)];
  return `${a}-${b}`;
}

// what the server accepts: 3–24 chars, lowercase letters/digits, up to two hyphens
export function handleValid(h) {
  const s = String(h || '').trim().toLowerCase();
  return s.length >= 3 && s.length <= 24 && /^[a-z0-9]+(-[a-z0-9]+){0,2}$/.test(s);
}
