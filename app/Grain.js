// ════════════════════════════════════════════════════════════════════════
//  yourZ — film grain. The premium tell. A tiny noise texture tiled across
//  the screen (GPU-tiled via resizeMode="repeat" — no per-pixel work, no
//  perf hit), sitting above the background light but below everything else.
//  pointerEvents="none" so it never eats a touch. Drop <Grain/> just after a
//  screen's background gradient.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { Image, StyleSheet } from 'react-native';

export default function Grain({ opacity = 0.04 }) {
  return (
    <Image
      source={require('./assets/grain.png')}
      resizeMode="repeat"
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { opacity }]}
    />
  );
}
