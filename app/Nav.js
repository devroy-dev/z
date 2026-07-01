// ════════════════════════════════════════════════════════════════════════
//  yourZ — the app spine: bottom navigation + the Quiet Room pull-down.
//  Five worlds: Front Desk (home) · Gathering · Rooms · Arena · You.
//  The Quiet Room is NOT a tab — it's a deliberate pull-down gesture from
//  anywhere (drawing the curtain closed). Built in §13 style: designed calm.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { C, FONTS } from './theme';

// ── the five worlds ──
const TABS = [
  { id: 'desk',      label: 'Desk' },
  { id: 'gathering', label: 'Gathering' },
  { id: 'rooms',     label: 'Rooms' },
  { id: 'play',      label: 'Play' },
];

// ── minimal line icons (premium, not emoji) ──
function Icon({ id, active }) {
  const s = active ? C.ember : C.faint;
  const w = 1.7;
  const common = { stroke: s, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width="24" height="24" viewBox="0 0 24 24">
      {/* Desk = concierge BELL (someone's here to route you) */}
      {id === 'desk' && <>
        <Path d="M4 17h16M12 6a6 6 0 016 6v5H6v-5a6 6 0 016-6z" {...common} />
        <Path d="M12 6V4M11 4h2" {...common} />
      </>}
      {/* Gathering = a small constellation of people (a group) */}
      {id === 'gathering' && <>
        <Circle cx="7" cy="8" r="2.4" {...common} /><Circle cx="16.5" cy="7" r="2.4" {...common} /><Circle cx="12" cy="15" r="2.6" {...common} />
      </>}
      {/* Rooms = overlapping speech bubbles (a conversation together) */}
      {id === 'rooms' && <>
        <Path d="M3 8a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8l-3 2.5V14H5a2 2 0 01-2-2z" {...common} />
        <Path d="M16 9h3a2 2 0 012 2v3a2 2 0 01-2 2v2l-2.5-2H14" {...common} />
      </>}
      {/* Play = a game controller (unmistakably games) */}
      {id === 'play' && <>
        <Path d="M7 8h10a4 4 0 014 4v1a3 3 0 01-5.2 2H8.2A3 3 0 013 13v-1a4 4 0 014-4z" {...common} />
        <Path d="M7.5 11v2M6.5 12h2M16 11.5h.01M18 13h.01" {...common} />
      </>}
      {/* You = single head + shoulders */}
      {id === 'you' && <><Circle cx="12" cy="8" r="3.2" {...common} /><Path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" {...common} /></>}
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

// ── the shell: holds the active world + nav + cross-app navigation ──
export default function Nav({ screens }) {
  const [active, setActive] = useState('desk');   // the Front Desk is home
  const [target, setTarget] = useState(null);     // deep-link for the active tab (e.g. open a persona)
  const [overlay, setOverlay] = useState(null);   // full-screen, non-tab destinations (quiet/stage/journal)

  // the one navigator the Front Desk (and anyone) calls to move around the app.
  // dest can be a tab id string, or { tab, ...params } to deep-link into that world.
  const navigate = (dest) => {
    if (!dest) return;
    const tab = typeof dest === 'string' ? dest : dest.tab;
    if (tab === 'quiet' || tab === 'stage' || tab === 'journal') {
      setOverlay(typeof dest === 'string' ? { tab } : dest);
      return;
    }
    if (TABS.some((t) => t.id === tab)) {
      setActive(tab);
      setTarget(typeof dest === 'string' ? null : dest);
    }
  };

  if (overlay) {
    const titles = { quiet: 'The Quiet Room', stage: 'The Stage', journal: 'The Journal' };
    const lines = {
      quiet: 'a moonlit room where Z just listens. opening next.',
      stage: 'step into the scene. coming alive soon.',
      journal: 'a private place to set it down. coming alive soon.',
    };
    return (
      <View style={styles.root}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <Pressable style={styles.overlayBack} onPress={() => setOverlay(null)} hitSlop={12}>
            <Text style={styles.overlayBackTxt}>‹ back</Text>
          </Pressable>
          <WorldStub kicker="soon" title={titles[overlay.tab] || overlay.tab} line={lines[overlay.tab] || 'coming alive next.'} />
        </SafeAreaView>
      </View>
    );
  }

  const factory = screens[active];
  const content = factory
    ? factory({ navigate, target })
    : <WorldStub kicker="soon" title={active} line="coming alive next." />;

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>{content}</View>
      <BottomNav active={active} onChange={(tab) => { setActive(tab); setTarget(null); setOverlay(null); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },

  overlayBack: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  overlayBackTxt: { fontFamily: FONTS.body, color: C.muted, fontSize: 15 },

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
