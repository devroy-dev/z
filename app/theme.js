// ════════════════════════════════════════════════════════════════════════
//  yourZ — the design language, in one place. Every screen pulls from here.
// ════════════════════════════════════════════════════════════════════════
export const C = {
  // the warm-dark ground (the GATHERING's depth — the chat now matches this)
  void:      '#0E0912',
  voidDeep:  '#0A0710',
  ground:    '#07050A',
  rise:      '#160F1C',

  cream:     '#F5ECE1',
  muted:     '#A1929B',
  faint:     '#6A5E69',

  // ember — the only "light"
  ember:     '#F3A85F',
  emberHot:  '#FF8A52',
  emberDeep: '#B5572E',
  accent:    '#F0A765',
  accentSoft:'#E9A98A',
};

// Nightfall — the void-black + candle + moonlight language that the chat, rooms,
// and desk already speak. Same semantic keys as C, so any screen can repaint by
// importing { NIGHT as C }. This is the finishing-gesture palette.
export const NIGHT = {
  void:      '#0B0A0F',
  voidDeep:  '#08070B',
  ground:    '#08070B',
  rise:      '#100E15',

  cream:     '#E9E8F0',   // moonlight text
  muted:     '#9E9DB0',   // silver
  faint:     '#6A6675',

  ember:     '#E7B07A',   // candle — the warm accent
  emberHot:  '#F0B77E',
  emberDeep: '#C88A4F',
  accent:    '#E7B07A',
  accentSoft:'#E9B98A',
};

// constellation light-temperatures (per group)
export const TONES = {
  gang:    '#F0A765',
  support: '#C99BE8',
  crazies: '#6FC9E0',
  wild:    '#F0708C',
  faculty: '#E0C088',
};

export const FONTS = {
  display:       'Fraunces_400Regular',
  displayItalic: 'Fraunces_400Regular_Italic',
  light:         'Figtree_300Light',
  body:          'Figtree_400Regular',
  medium:        'Figtree_500Medium',
  semibold:      'Figtree_600SemiBold',
};
