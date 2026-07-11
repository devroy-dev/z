// ════════════════════════════════════════════════════════════════════════
//  yourZ — FoldBar · THE ONE BOTTOM NAV (audit-3 fix)
//  Four nouns, one bar, everywhere. Extracted from ChatHome's inner bar —
//  the play world mounts THIS same component (dark ground tint only; the
//  bar's shape, icons, type and active treatment never change between
//  worlds). Nav's old BottomNav/Icon/TABS are dead.
//  Tokens are kept LOCAL to avoid an import cycle with ChatHome (the
//  DeskPane precedent).
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';

const T = {
  raise: '#141218',                       // chat-world bar ground (MOON.raise)
  night: '#0B0A0F',                       // play-world ground (N.night)
  hair: 'rgba(233,232,240,0.10)',
  moon: '#E9E8F0',
  faint: 'rgba(233,232,240,0.30)',
  medium: 'Figtree_500Medium',
};

export const FOLD_TABS = [
  ['thedesk', 'the Desk'],
  ['chats', 'chats'],
  ['rooms', 'rooms'],
  ['play', 'play'],
];

export default function FoldBar({ active, onChange = () => {}, dark = false }) {
  return (
    <View style={[styles.tabs, dark && { backgroundColor: T.night, borderTopColor: 'rgba(233,232,240,0.07)' }]}>
      {FOLD_TABS.map(([id, label]) => {
        const on = active === id;
        const stroke = on ? T.moon : T.faint;
        return (
          <Pressable key={id} style={styles.tabBtn} onPress={() => onChange(id)}>
            <Svg width="22" height="22" viewBox="0 0 24 24">
              {id === 'chats' && <><Circle cx="12" cy="11" r="7.5" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M7 20 L9 15.5" stroke={stroke} strokeWidth="1.6" fill="none" strokeLinecap="round" /></>}
              {id === 'thedesk' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" strokeDasharray="4 3" /><Circle cx="12" cy="12" r="3" fill={stroke} /></>}
              {id === 'rooms' && <><Circle cx="12" cy="12" r="8" stroke={stroke} strokeWidth="1.6" fill="none" /><SvgPath d="M4.5 12 H19.5 M12 4.5 C9 8, 9 16, 12 19.5 M12 4.5 C15 8, 15 16, 12 19.5" stroke={stroke} strokeWidth="1.2" fill="none" /></>}
              {id === 'play' && <><SvgPath d="M7.5 8.5h9a4 4 0 0 1 4 4a2.6 2.6 0 0 1-4.7 1.5l-.5-.7H8.7l-.5.7A2.6 2.6 0 0 1 3.5 12.5a4 4 0 0 1 4-4z" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /><SvgPath d="M7 11.2v2M6 12.2h2" stroke={stroke} strokeWidth="1.4" fill="none" strokeLinecap="round" /><Circle cx="15.8" cy="11.6" r="0.75" fill={stroke} /><Circle cx="17.4" cy="13.1" r="0.75" fill={stroke} /></>}
            </Svg>
            <Text style={[styles.tabTxt, on && { color: T.moon }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: T.raise, borderTopWidth: 1, borderTopColor: T.hair, paddingBottom: 22, paddingTop: 14 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabTxt: { fontFamily: T.medium, color: T.faint, fontSize: 13.5 },
});
