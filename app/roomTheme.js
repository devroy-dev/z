// yourZ — roomTheme · the room world's shared palette + persona map (R0).
// Lifted verbatim from RoomChat so every room-shaped surface names and tints
// personas identically. (Pre-lock names ride until the relabel pass.)
export const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)', moonFaint: 'rgba(233,232,240,0.30)',
  silver: '#9E9DB0', hair: 'rgba(233,232,240,0.10)',
  candle: '#E7B07A', candleHot: '#F3CFA3',
  human: '#9FB0CE',
};
export const faceFor = (k) => `https://callmez.app/faces/${k}.jpg?v=6`;   // [zip54r] v=5 poisoned on-device during the stale window; v=6 grep-verified virgin
export const P = {
  the_guru:['the guru','230,190,90'], the_oracle:['the oracle','110,200,200'], the_brainiac:['the smug brainiac','90,200,230'],
  the_brother:['the brother','200,120,80'], the_healer:['the healer','124,92,220'], the_comic:['the comic','240,180,70'],
  the_mentor:['the motivator','230,190,110'], the_colleague:['the colleague','190,160,110'], the_philosopher:['the philosopher','180,160,210'],
  the_historian:['the historian','200,160,110'], the_cosmologist:['the cosmologist','120,140,230'], the_moderator:['the moderator','120,180,150'],
  the_cynic:['the cynic','150,150,150'], the_media_manager:['the media manager','230,140,170'], the_teacher:['the professor','120,190,170'],
  the_economist:['the economist','110,170,140'], the_leader_opp:['the leader of opposition','200,120,110'], the_wannabe:['the wannabe hustler','235,180,90'],
  the_screen_junkie:['the screen junkie','120,150,230'], the_orator:['the orator','210,150,90'], the_hippie:['the hippie','120,170,120'],
  the_diva:['the diva','210,90,150'], the_cousin:['the awkward cousin','150,160,190'],
};
export const nameOf = (k) => (P[k] ? P[k][0] : (k || 'someone'));
export const rgbOf = (k) => (P[k] ? P[k][1] : '231,176,122');
export const fmtTime = (at) => { const d = at ? new Date(at) : null; return d && !isNaN(d) ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : ''; };
