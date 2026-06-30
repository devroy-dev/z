// ════════════════════════════════════════════════════════════════════════
//  yourZ — the app spine: bottom navigation + the Quiet Room pull-down.
//  Five worlds: Front Desk (home) · Gathering · Rooms · Arena · You.
//  The Quiet Room is NOT a tab — it's a deliberate pull-down gesture from
//  anywhere (drawing the curtain closed). Built in §13 style: designed calm.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { C, FONTS } from './theme';
import { QuietRoom, QuietPull } from './QuietRoom';

// ── the five worlds ──
const TABS = [
  { id: 'desk',      label: 'Desk' },
  { id: 'gathering', label: 'Gathering' },
  { id: 'rooms',     label: 'Rooms' },
  { id: 'play',      label: 'Play' },
  { id: 'you',       label: 'You' },
];

// ── minimal line icons (premium, not emoji) ──
function Icon({ id, active }) {
  const s = active ? C.ember : C.faint;
  const w = 1.7;
  const common = { stroke: s, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      {id === 'desk' && <Path d="M4 11l8-6 8 6M6 10v9h12v-9" {...common} />}
      {id === 'gathering' && <>
        <Circle cx="8" cy="9" r="3" {...common} /><Circle cx="16.5" cy="10.5" r="2.3" {...common} />
        <Path d="M3 19c0-2.8 2.2-5 5-5s5 2.2 5 5M13.5 19c.2-2 1.8-3.6 3.8-3.6" {...common} />
      </>}
      {id === 'rooms' && <>
        <Circle cx="9" cy="10" r="2.2" {...common} /><Circle cx="15" cy="10" r="2.2" {...common} />
        <Path d="M5 18c0-2.2 1.8-4 4-4M15 14c2.2 0 4 1.8 4 4M9.5 17h5" {...common} />
      </>}
      {id === 'play' && <Path d="M12 3l2.5 5 5.5.8-4 3.9.95 5.5L12 16.5 7.1 18.1 8 12.6l-4-3.9 5.5-.8z" {...common} />}
      {id === 'you' && <><Circle cx="12" cy="8" r="3.4" {...common} /><Path d="M5.5 19c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" {...common} /></>}
    </Svg>
  );
}

function BottomNav({ active, onChange }) {
  return (
    <View style={styles.navWrap}>
      <View style={styles.nav}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <Pressable key={t.id} style={styles.tab} onPress={() => onChange(t.id)} hitSlop={6}>
              {on && <View style={styles.tabGlow} />}
              <Icon id={t.id} active={on} />
              <Text style={[styles.tabLabel, on && { color: C.ember }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── a simple "coming alive" stub for worlds not built yet ──
export function WorldStub({ title, kicker, line }) {
  return (
    <View style={styles.stub}>
      <View style={styles.stubOrb}>
        <Svg width="70" height="70" viewBox="0 0 70 70">
          <Defs><RadialGradient id="stubOrb" cx="38%" cy="33%" r="70%">
            <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="40%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
          </RadialGradient></Defs>
          <Circle cx="35" cy="35" r="22" fill="url(#stubOrb)" opacity="0.5" />
        </Svg>
      </View>
      <Text style={styles.stubKicker}>{kicker}</Text>
      <Text style={styles.stubTitle}>{title}</Text>
      <Text style={styles.stubLine}>{line}</Text>
    </View>
  );
}

// ── the shell: holds the active world + nav + the Quiet Room gesture ──
export default function Nav({ screens }) {
  const [active, setActive] = useState('gathering');
  const [quietOpen, setQuietOpen] = useState(false);

  const Active = screens[active] || (() => <WorldStub kicker="soon" title={active} line="coming alive next." />);

  return (
    <View style={styles.root}>
      {/* the quiet-room pull tab at the very top — the gesture lives here */}
      <QuietPull onOpen={() => setQuietOpen(true)} />

      <View style={{ flex: 1 }}>
        <Active />
      </View>

      <BottomNav active={active} onChange={setActive} />

      {/* the quiet room, when called — a curtain drawn over everything */}
      {quietOpen && <QuietRoom onClose={() => setQuietOpen(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },

  navWrap: { backgroundColor: 'transparent' },
  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingTop: 10, paddingBottom: 26, paddingHorizontal: 8,
    backgroundColor: 'rgba(10,7,16,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(243,168,95,0.10)',
  },
  tab: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, minWidth: 56 },
  tabGlow: {
    position: 'absolute', top: -2, width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.ember, opacity: 0.12,
  },
  tabLabel: { fontFamily: FONTS.body, fontSize: 10.5, color: C.faint, marginTop: 3, letterSpacing: 0.3 },

  stub: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  stubOrb: { marginBottom: 20, opacity: 0.9 },
  stubKicker: { fontFamily: FONTS.body, color: C.faint, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  stubTitle: { fontFamily: FONTS.display, color: C.cream, fontSize: 30, marginTop: 4, textTransform: 'capitalize' },
  stubLine: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },
});
