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
import MediaRoom from './MediaRoom';   // [zip54d] the Media Manager's front door
import StylistRoom from './StylistRoom';   // [zip54j] the stylist's front door
import TravelDesk from './TravelDesk';   // [zip79] the Wanderer's front door
import Consult from './Consult';
import QuietRoom from './QuietRoom';
import Journal from './Journal';
import Chat from './Chat';
import DMScreen from './DMScreen';   // [zip49] the dismantle: RoomChat died here
import CuratedRoomScreen from './CuratedRoomScreen';
import ChatHome, { MOON } from './ChatHome';
import PublicDoorway from './PublicDoorway';       // [R1] the floor's threshold
import PublicRoomScreen from './PublicRoomScreen'; // [R1] the floor's register
import SessionScreen from './SessionScreen';       // [R4] the sitting's room
import FoldBar, { FOLD_TABS } from './FoldBar';    // [audit-3] the ONE bar, both worlds
import You from './You';

const N = {
  night: '#0B0A0F', night2: '#100E15',
  moon: '#E9E8F0', moonDim: 'rgba(233,232,240,0.56)',
  navIdle: 'rgba(233,232,240,0.40)', silver: '#9E9DB0',
  candle: '#E7B07A', candleHot: '#F3CFA3',
};

// [audit-3] TABS / Icon / BottomNav died here — FoldBar.js is the one bar.

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
    if (FOLD_TABS.some(([id]) => id === tab)) {   // [audit-3] deep-link fallback rides the one bar's ids
      setActive(tab);
      setTarget(typeof dest === 'string' ? null : dest);
    }
  };

  // ── CHAT world: the Moonlight surface. deep-links open the right thing ──
  const openFromChat = (dest) => {
    if (dest && dest.returnTab) setReturnTab(dest.returnTab);   // [zip81] remember where we came from
    if (dest.kind === 'bulletin') return setOverlay({ tab: 'bulletin' });
    if (dest.kind === 'coach') return setOverlay({ tab: 'coach' });
    if (dest.kind === 'forge') return setOverlay({ tab: 'forge' });   // [zip23]
    if (dest.kind === 'mmroom') return setOverlay({ tab: 'mmroom' });   // [zip54d]
    if (dest.kind === 'stylist') return setOverlay({ tab: 'stylist' });   // [zip54j]
    if (dest.kind === 'wanderer') return setOverlay({ tab: 'wanderer' });   // [zip79]
    if (dest.kind === 'panel') return setOverlay({ tab: 'panel' });   // [zip31]
    if (dest.kind === 'consult') return setOverlay({ tab: 'consult' });
    if (dest.kind === 'desk') return setChatOpen({ kind: 'persona', key: 'the_front_desk' });
    if (dest.kind === 'z') return setOverlay({ tab: 'quiet' });
    if (dest.kind === 'persona') return setChatOpen(dest);
    if (dest.kind === 'play') { setChatOpen(null); setWorld('play'); setActive('play'); return; }   // [R3] play is a noun in the one nav
    if (dest.kind === 'publicDoorway') return setChatOpen(dest);   // [R1] every public entry passes the threshold
    if (dest.kind === 'session') return setChatOpen(dest);   // [R4] the sitting
    if (dest.kind === 'room') {
      // [R3] a FLOOR room reaching this router (recents row, the Gathering's
      // list, desk search) always enters through its doorway — the threshold
      // is mandatory, every entry (v1 §4). listRooms rows carry id=threadId +
      // publicRoomId; the doorway wants the public id up front.
      const r = dest.room || {};
      if (r.publicRoomId && r.id !== undefined && !r.handle) {
        return setChatOpen({ kind: 'publicDoorway', room: { id: r.publicRoomId, threadId: r.id, name: r.name, personas: (r.personas || []).filter((k) => k !== 'the_moderator'), youCreated: !!r.youCreated } });
      }
      return setChatOpen(dest);
    }
    if (dest.kind === 'dm') return setChatOpen({ kind: 'room', room: { id: dest.threadId, name: dest.name, personas: [] } });
    if (dest.kind === 'roster') return setChatOpen(dest);
  };
  const [chatOpen, setChatOpen] = useState(null);
  const [returnTab, setReturnTab] = useState('thedesk');   // [zip81] which Desk-tab to restore on back
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
    if (overlay.tab === 'mmroom') return <MediaRoom onBack={() => setOverlay(null)} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_media_manager', from: 'mmroom' }); }} onAsk={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_media_manager', draft, autoSend: true, from: 'mmroom' }); }} />;   // [zip54d][§5.4]
    if (overlay.tab === 'stylist') return <StylistRoom onBack={() => setOverlay(null)} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_diva', from: 'stylist' }); }} onAsk={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_diva', draft, autoSend: true, from: 'stylist' }); }} />;   // [zip54j]
    if (overlay.tab === 'wanderer') return <TravelDesk onBack={() => setOverlay(null)} onChat={() => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_wanderer', from: 'wanderer' }); }} onAsk={(draft) => { setOverlay(null); navigate({ tab: 'gathering', persona: 'the_wanderer', draft, autoSend: true, from: 'wanderer' }); }} onStylist={() => setOverlay({ tab: 'stylist' })} />;   // [zip79][0054b]
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
      : chatOpen.kind === 'session' ? (
          <SessionScreen session={chatOpen.session} onBack={() => setChatOpen(null)} />
        )
      : chatOpen.kind === 'publicDoorway' ? (
          // [R1] the mandatory threshold — consent, 18+, the handle — then the register
          <PublicDoorway room={chatOpen.room} onBack={() => setChatOpen(null)}
            onEnter={(r) => setChatOpen({ kind: 'room', room: r })} />
        )
      : chatOpen.kind === 'room' ? (
          chatOpen.room?.publicRoomId
            ? <PublicRoomScreen room={chatOpen.room} onBack={() => setChatOpen(null)} />   // [R1] the third thin shell
            : ((chatOpen.room?.personas && chatOpen.room.personas.length) || chatOpen.room?.persona)
              ? <CuratedRoomScreen room={chatOpen.room} onBack={() => setChatOpen(null)} />
              : <DMScreen room={chatOpen.room} onBack={() => setChatOpen(null)} />
        )
      : <Chat key={chatOpen.key} personaKey={chatOpen.key} initialDraft={chatOpen.draft || ''} autoSend={!!chatOpen.autoSend} onBack={() => { if (chatOpen.from) { setChatOpen(null); setOverlay({ tab: chatOpen.from }); } else { setChatOpen(null); } }} onRoute={navigate} diag={diag} onCost={(inr) => setSessCost((c) => c + (inr || 0))} />)
    : <ChatHome onOpen={openFromChat} initialTab={returnTab} diag={diag} />;   // [zip81] [H1c] probe rides the founder flag

  const playFactory = screens[active === 'play' ? 'play' : 'play'];
  const content = world === 'chat' ? chatContent : playFactory({ navigate, target });

  return (
    <View style={[styles.root, world === 'chat' && { backgroundColor: MOON.ground }]}>
      {/* the shell header — [R3] THE PILL IS DEAD. One nav, four nouns; the mark and ⋮ remain. */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: world === 'chat' ? MOON.ground : 'transparent' }}>
        {!chatOpen && (
          <View style={styles.shellBar}>
            <Pressable onLongPress={() => setDiag((d) => { if (!d) setSessCost(0); return !d; })} delayLongPress={600}><Text style={[styles.shellMark, world === 'chat' && { color: MOON.porcelain }]}>callme<Text style={{ color: world === 'chat' ? MOON.moon : '#E7B07A' }}>Z</Text></Text></Pressable>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {diag ? <Text style={styles.sessCost}>₹{sessCost.toFixed(2)}</Text> : null}
            <Pressable hitSlop={10} onPress={() => setOverlay({ tab: 'you' })}>
              <Text style={{ color: world === 'chat' ? MOON.mist : 'rgba(245,236,225,0.6)', fontSize: 21, marginTop: -2 }}>⋮</Text>
            </Pressable>
            </View>
          </View>
        )}
      </SafeAreaView>
      <View style={{ flex: 1 }}>{content}</View>
      {/* [R3] in the play world the same four nouns sit at the bottom — one nav
          everywhere; tapping a chat-world noun walks home to that tab. */}
      {world === 'play' && (
        <FoldBar dark active="play" onChange={(id) => {
          if (id === 'play') return;
          setWorld('chat'); setActive('desk'); setReturnTab(id);
        }} />
      )}
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
