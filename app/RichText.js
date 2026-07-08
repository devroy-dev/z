// ════════════════════════════════════════════════════════════════════════
//  yourZ — RichText: renders engine markdown in the chat bubble, styled to
//  Lamplight (Figtree body, brighter-cream bold lead-ins, ember bullets).
//  No dependency (OTA-safe). Shared across every chat surface — persona chat,
//  Front Desk, rooms, quiet room. Parse logic lives in mdparse.js (unit-tested).
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { parseInline, parseBlocks } from './mdparse';

// inline runs → nested <Text> (bold / italic / code), inheriting size + line-height
function runs(str) {
  return parseInline(str).map((r, i) => (
    <Text key={i} style={[r.b && S.bold, r.i && S.italic, r.code && S.code]}>{r.t}</Text>
  ));
}

export default function RichText({ text, style }) {
  const blocks = parseBlocks(text);
  return (
    <View>
      {blocks.map((blk, bi) => {
        const last = bi === blocks.length - 1;
        if (blk.type === 'p') {
          return (
            <Text key={bi} style={[S.p, style, !last && S.gap]}>{runs(blk.text)}</Text>
          );
        }
        return (
          <View key={bi} style={!last && S.gap}>
            {blk.items.map((it, ii) => (
              <View key={ii} style={S.li}>
                <Text style={S.marker}>{blk.type === 'ol' ? `${ii + 1}.` : '•'}</Text>
                <Text style={[S.p, style, S.liText]}>{runs(it)}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

const S = StyleSheet.create({
  // matches bubbleText in Chat.js so mixed content lines up
  p:      { fontFamily: 'Figtree_400Regular', color: '#F1E7DC', fontSize: 15, lineHeight: 22 },
  gap:    { marginBottom: 9 },              // breathing room between paragraphs / lists
  bold:   { fontFamily: 'Figtree_600SemiBold', color: '#FCE9D6' },  // lead-ins glow a touch brighter
  italic: { fontStyle: 'italic' },
  code:   { fontFamily: 'monospace', color: '#F3A85F', fontSize: 14 },
  li:     { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4, paddingRight: 6 },
  marker: { fontFamily: 'Figtree_600SemiBold', color: '#F3A85F', fontSize: 15, lineHeight: 22, width: 20 },
  liText: { flexShrink: 1 },   // [zip54q] flex:1 has zero intrinsic width in an auto-width bubble — THE shatter
});
