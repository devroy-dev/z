// ════════════════════════════════════════════════════════════════════════
//  yourZ — the app spine: bottom navigation + cross-app navigation.
//  Four worlds: Front Desk (home) · Gathering · Rooms · Play.
//  NIGHTFALL nav: solid moonlit-black bar, custom icons, candle-lit active.
// ════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { BackHandler } from 'react-native';
import { handleBack, useBackLayer } from './backbus';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { FONTS } from './theme';
import Stage from './stage/Stage';
import Bulletin from './Bulletin';
import Coach from './Coach';
import GMForge from './GMForge';   // [zip23] the Grand Master's front door
import Panel from './Panel';   // [zip31] the interviewer's front door
import Consult from './Consult';
import QuietRoom from './QuietRoom';
import Journal from './Journal';
import Chat from './Chat';
import RoomChat from './RoomChat';
import ChatHome, { MOON } from './ChatHome';
import You from './You';

const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)',
  navIdle: 'rgba(233,232,240,0.40)', silver: '#9E9DB0',
  candle: '#E7B07A', candleHot: '#F3CFA3',
};

const TABS = [
  { id: 'desk',      label: 'Desk' },
  { id: 'gathering', label: 'Gathering' },
  { id: 'rooms',     label: 'Rooms' },
  { id: 'play',      label: 'Play' },
];

// ── custom Nightfall icons — clean shapes, candle when active ──
function Icon({ id, active }) {
  const s = active ? N.candle : N.navIdle;
  const common = { stroke: s, strokeWidth: 1.6, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <Svg width="25" height="25" viewBox="0 0 24 24">
      {/* Desk = the concierge bell (someone's here, at the door) */}
      {id === 'desk' && <>
        <Path d="M5.5 17.5h13" {...common} />
        <Path d="M7 17.5v-4a5 5 0 0 1 10 0v4" {...common} />
        <Path d="M12 8.5V6.9M10.9 6.9h2.2" {...common} />
        {active && <Circle cx="12" cy="20" r="1.1" fill={N.candle} />}
      </>}
      {/* Gathering = a cluster of people (your people) */}
      {id === 'gathering' && <>
        <Circle cx="8" cy="9" r="2.3" {...common} />
        <Circle cx="16" cy="9" r="2.3" {...common} />
        <Path d="M4 17.5c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8" {...common} />
        <Path d="M12 17.5c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8" {...common} />
      </>}
      {/* Rooms = overlapping speech bubbles (together) */}
      {id === 'rooms' && <>
        <Path d="M3.5 8A1.6 1.6 0 0 1 5.1 6.4h6.8A1.6 1.6 0 0 1 13.5 8v3.2a1.6 1.6 0 0 1-1.6 1.6H7l-3 2.3v-2.3A1.6 1.6 0 0 1 3.5 11.2z" {...common} />
        <Path d="M15.4 9.4h3.5A1.6 1.6 0 0 1 20.5 11v3.2a1.6 1.6 0 0 1-1.6 1.6v2l-2.6-2h-2.1" {...common} />
      </>}
      {/* Play = a game controller */}
      {id === 'play' && <>
        <Path d="M7.5 8.5h9a4 4 0 0 1 4 4a2.6 2.6 0 0 1-4.7 1.5l-.5-.7H8.7l-.5.7A2.6 2.6 0 0 1 3.5 12.5a4 4 0 0 1 4-4z" {...common} />
        <Path d="M7 11.2v2M6 12.2h2" {...common} />
        <Circle cx="15.8" cy="11.6" r="0.75" fill={s} />
        <Circle cx="17.4" cy="13.1" r="0.75" fill={s} />
      </>}
      {/* You = single head + shoulders */}
      {id === 'you' && <>
        <Circle cx="12" cy="8" r="3.2" {...common} />
        <Path d="M6 19c0-3.3 2.7-6 6-6s6 2.7 6 6" {...common} />
      </>}
    </Svg>
  );
}

function BottomNav({ active, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <Pressable key={t.id} style={styles.tab} onPress={() => onChange(t.id)} hitSlop={6}>
            {on && <View style={styles.tabGlow} />}
            <Icon id={t.id} active={on} />
            <Text style={[styles.tabLabel, on && { color: N.candle }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── a simple "coming alive" stub for worlds not built yet ──
export function WorldStub({ title, kicker, line }) {
  return (
    <View style={styles.stub}>
      <View style={styles.stubOrb}>
        <Svg width="70" height="70" viewBox="0 0 70 70">
          <Defs><RadialGradient id="stubOrb" cx="42%" cy="38%" r="64%">
            <Stop offset="0%" stopColor={N.candleHot} /><Stop offset="46%" stopColor={N.candle} /><Stop offset="100%" stopColor="#8a5a30" />
          </RadialGradient></Defs>
          <Circle cx="35" cy="35" r="20" fill="url(#stubOrb)" opacity="0.55" />
        </Svg>
      </View>
      <Text style={styles.stubKicker}>{kicker}</Text>
      <Text style={styles.stubTitle}>{title}</Text>
      <Text style={styles.stubLine}>{line}</Text>
    </View>
  );
}

// ── the shell: holds the active world + nav + cross-app navigation ──
export default function Nav({ screens, onLogout = () => {} }) {
  const [world, setWorld] = useState('chat');     // chat | play — the two registers
  const [active, setActive] = useState('desk');   // legacy tab id for PLAY internals
  const [target, setTarget] = useState(null);     // deep-link for the active tab
  const [overlay, setOverlay] = useState(null);   // full-screen, non-tab destinations

  // Android back walks inward before it ever exits: layers first (chat, scene,
  // panel…), then overlay, then non-desk tab → desk, then bare desk → system.
  useBackLayer(!!overlay, React.useCallback(() => { setOverlay(null); return true; }, []));
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (handleBack()) return true;
      if (world === 'play') { setWorld('chat'); return true; }
      return false;                       // bare desk → the system may exit
    });
    return () => sub.remove();
  }, [world]);

  const navigate = (dest) => {
    if (!dest) return;
    // [zip15] kind-shaped destinations ({kind:'dm'|'persona'|'room'|...}) belong to the
    // chat opener — without this, dest.tab is undefined, every branch below falls
    // through, and the caller's overlay has already closed: the silent dump-to-home.
    if (typeof dest === 'object' && dest.kind) return openFromChat(dest);
    const tab = typeof dest === 'string' ? dest : dest.tab;
    if (tab === 'quiet' || tab === 'stage' || tab === 'journal' || tab === 'bulletin' || tab === 'coach') {
      setOverlay(typeof dest === 'string' ? { tab } : dest);
      return;
    }
    if (tab === 'gathering' || tab === 'desk' || tab === 'rooms') {
      setWorld('chat');
      setTarget(typeof dest === 'string' ? null : dest);
      return;
    }
    if (tab === 'play') { setChatOpen(null); setWorld('play'); setActive('play'); setTarget(typeof dest === 'string' ? null : dest); return; }
    if (TABS.some((t) => t.id === tab)) {
      setActive(tab);
      setTarget(typeof dest === 'string' ? null : dest);
    }
  };

  // ── CHAT world: the Moonlight surface. deep-links open the right thing ──
  const openFromChat = (dest) => {
    if (dest.kind === 'bulletin') return setOverlay({ tab: 'bulletin' });
    if (dest.kind === 'coach') return setOverlay({ tab: 'coach' });
    if (dest.kind === 'forge') return setOverlay({ tab: 'forge' });   // [zip23]
    if (dest.kind === 'panel') return setOverlay({ tab: 'panel' });   // [zip31]
    if (dest.kind === 'consult') return setOverlay({ tab: 'consult' });
    if (dest.kind === 'desk') return setChatOpen({ kind: 'persona', key: 'the_front_desk' });
    if (dest.kind === 'z') return setOverlay({ tab: 'quiet' });
    if (dest.kind === 'persona') return setChatOpen(dest);
    if (dest.kind === 'room') return setChatOpen(dest);
    if (dest.kind === 'dm') return setChatOpen({ kind: 'room', room: { id: dest.threadId, name: dest.name, personas: [] } });
    if (dest.kind === 'roster') return setChatOpen(dest);
  };
  const [chatOpen, setChatOpen] = useState(null);
  const [diag, setDiag] = useState(false);           // founder cost-diagnostic (long-press callmeZ)
  const [sessCost, setSessCost] = useState(0);
  useBackLayer(!!chatOpen, React.useCallback(() => { if (chatOpen && chatOpen.from) { setChatOpen(null); setOverlay({ tab: chatOpen.from }); } else { setChatOpen(null); } return true; }, [chatOpen]));
  // persona deep-links (door cards, drop-ins) land here from navigate()
  useEffect(() => { if (world === 'chat' && target?.persona) { setChatOpen({ kind: 'persona', key: target.persona, draft: target.draft, autoSend: target.autoSend, from: target.from }); } }, [target, world]);

  // ── full-screen overlays: rendered AFTER every hook has run. this block
  // once sat above the chatOpen hooks as an early return — tapping ⋮ then
  // rendered fewer hooks than the previous pass and crashed the app. ──
  if (overlay) {
    if (overlay.tab === 'stage') return <Stage onBack={() => setOverlay(null)} />;
    if (overlay.tab === 'consult') return <Consult onBack={() => setOverlay(null)} />;
    if (overlay.tab === 'you') return <You onBack={() => setOverlay(null)} onLogout={onLogout} onOpenChat={navigate} />;
    if (overlay.tab === 'quiet') return <QuietRoom onBack={() => setOverlay(null)} onJournal={() => setOverlay({ tab: 'journal' })} />;
    if (overlay.tab === 'journal') return <Journal onBack={() => setOverlay({ tab: 'quiet' })} />;
    if (overlay.tab === 'coach') return <Coach onBack={() => setOverlay(null)} onAskCoach={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_coach', from: 'coach' }); }} onInterview={() => setOverlay({ tab: 'panel' })} />;   // [zip26][zip31] one front door everywhere
    if (overlay.tab === 'forge') return <GMForge onBack={() => setOverlay(null)} onSpar={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_grandmaster', draft, autoSend: true, from: 'forge' }); }} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_grandmaster', from: 'forge' }); }} onArena={() => { setOverlay(null); navigate('play'); }} />;   // [zip23]
    if (overlay.tab === 'panel') return <Panel onBack={() => setOverlay(null)} onStart={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', draft, autoSend: true, from: 'panel' }); }} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_interviewer', from: 'panel' }); }} />;   // [zip31]
    if (overlay.tab === 'bulletin') return (
      <Bulletin
        onBack={() => setOverlay(null)}
        onAskAnchor={(text, send) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_anchor', draft: text, autoSend: !!send, from: 'bulletin' }); }}
      />
    );
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

  const chatContent = chatOpen
    ? (chatOpen.kind === 'desk' ? screens.desk({ navigate, target })
      : chatOpen.kind === 'roster' ? screens.gathering({ navigate, target: null })
      : chatOpen.kind === 'room' ? <RoomChat room={chatOpen.room} onBack={() => setChatOpen(null)} />
      : <Chat key={chatOpen.key} personaKey={chatOpen.key} initialDraft={chatOpen.draft || ''} autoSend={!!chatOpen.autoSend} onBack={() => { if (chatOpen.from) { setChatOpen(null); setOverlay({ tab: chatOpen.from }); } else { setChatOpen(null); } }} onRoute={navigate} diag={diag} onCost={(inr) => setSessCost((c) => c + (inr || 0))} />)
    : <ChatHome onOpen={openFromChat} />;

  const playFactory = screens[active === 'play' ? 'play' : 'play'];
  const content = world === 'chat' ? chatContent : playFactory({ navigate, target });

  return (
    <View style={[styles.root, world === 'chat' && { backgroundColor: MOON.ground }]}>
      {/* the shell header: the pill between worlds */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: world === 'chat' ? MOON.ground : 'transparent' }}>
        {!chatOpen && (
          <View style={styles.shellBar}>
            <Pressable onLongPress={() => setDiag((d) => { if (!d) setSessCost(0); return !d; })} delayLongPress={600}><Text style={[styles.shellMark, world === 'chat' && { color: MOON.porcelain }]}>callme<Text style={{ color: world === 'chat' ? MOON.moon : '#E7B07A' }}>Z</Text></Text></Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {diag ? <Text style={styles.sessCost}>₹{sessCost.toFixed(2)}</Text> : null}
            <View style={[styles.pill, world === 'chat' && { borderColor: MOON.hairStrong }]}>
              {[['chat', 'chat'], ['play', '✦ play']].map(([id, label]) => (
                <Pressable key={id} onPress={() => setWorld(id)} style={[styles.pillSeg, world === id && (id === 'chat' ? styles.pillOnCool : styles.pillOnWarm)]}>
                  <Text style={[styles.pillTxt, world === id && { color: id === 'chat' ? MOON.moon : '#F0C990' }]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable hitSlop={10} onPress={() => setOverlay({ tab: 'you' })}>
              <Text style={{ color: world === 'chat' ? MOON.mist : 'rgba(245,236,225,0.6)', fontSize: 21, marginTop: -2 }}>⋮</Text>
            </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
      <View style={{ flex: 1 }}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shellBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  shellMark: { fontFamily: 'Fraunces_400Regular', color: '#F5ECE1', fontSize: 22, letterSpacing: 0.3 },
  sessCost: { fontFamily: 'Fraunces_400Regular', color: 'rgba(240,167,101,0.85)', fontSize: 12, letterSpacing: 0.3 },
  pill: { flexDirection: 'row', borderWidth: 1, borderColor: 'rgba(231,176,122,0.3)', borderRadius: 999, padding: 3 },
  pillSeg: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  pillOnCool: { backgroundColor: 'rgba(159,194,232,0.12)' },
  pillOnWarm: { backgroundColor: 'rgba(231,176,122,0.14)' },
  pillTxt: { fontFamily: 'Figtree_500Medium', color: 'rgba(228,234,242,0.45)', fontSize: 10.5, letterSpacing: 2.5, textTransform: 'uppercase' },
  root: { flex: 1, backgroundColor: N.night },

  overlayBack: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  overlayBackTxt: { fontFamily: FONTS.body, color: N.moonDim, fontSize: 15 },

  nav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingTop: 12, paddingHorizontal: 8,
    backgroundColor: N.night,                       // fully opaque — nothing bleeds through
    borderTopWidth: 1, borderTopColor: 'rgba(233,232,240,0.07)',
  },
  tab: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, minWidth: 56 },
  tabGlow: {
    position: 'absolute', top: -3, width: 38, height: 38, borderRadius: 19,
    backgroundColor: N.candle, opacity: 0.13,
  },
  tabLabel: { fontFamily: FONTS.body, fontSize: 10.5, color: N.navIdle, marginTop: 4, letterSpacing: 0.3 },

  stub: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  stubOrb: { marginBottom: 20, opacity: 0.9 },
  stubKicker: { fontFamily: FONTS.body, color: N.navIdle, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  stubTitle: { fontFamily: FONTS.display, color: N.moon, fontSize: 30, marginTop: 4, textTransform: 'capitalize' },
  stubLine: { fontFamily: FONTS.displayItalic, color: N.moonDim, fontSize: 14, marginTop: 10, textAlign: 'center' },
});
