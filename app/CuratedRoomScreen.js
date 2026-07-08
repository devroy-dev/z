// ════════════════════════════════════════════════════════════════════════
//  yourZ — CuratedRoomScreen · THE SHARED ROOM, a thin shell on the chat core
//  (R0). Persona-tinted gradient, the risen-speaker rail (tap a face to
//  address), games overlays + menu, invite + manage (creator's 24h kick sheet —
//  the member sheet proper lands in R0's final zip). All realtime behavior
//  lives in useRoomFeed; this screen is composition.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Grain from './Grain';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import { startGameSession, getLiveGame, kickFromRoom, inviteToRoom } from './api';
import useRoomFeed from './useRoomFeed';
import MessageList from './MessageList';
import Composer from './Composer';
import { RoomPresence, HumanPresence } from './Presences';
import { N, nameOf, rgbOf } from './roomTheme';

// [zip50] the room's mentionables: personas with their aura colors + human members in blue.

export default function CuratedRoomScreen({ room, onBack = () => {} }) {
  const roomId = room?.id;
  const personas = (room?.personas && room.personas.length) ? room.personas : (room?.persona ? [room.persona] : []);
  const title = room?.name || 'the room';
  const feed = useRoomFeed(roomId, { personas, isDM: false });
  const [addressed, setAddressed] = useState([]);

  // ── live game session in this room ──
  const [liveSession, setLiveSession] = useState(null);
  const [liveAvail, setLiveAvail] = useState(null);
  React.useEffect(() => {
    let on = true;
    const check = async () => {
      try { const j = await getLiveGame(room.id); if (on && j?.id && j.status === 'live') setLiveAvail(j); else if (on) setLiveAvail(null); } catch (e) {}
    };
    check();
    const t = setInterval(check, 5000);
    return () => { on = false; clearInterval(t); };
  }, [room.id]);
  const [gameMenu, setGameMenu] = useState(false);
  const startLive = async (game) => {
    setGameMenu(false);
    try {
      const roomPersonas = (room.personas || []).slice(0, 3);
      const j = await startGameSession(room.id, game, roomPersonas);
      if (j?.sessionId) setLiveSession({ id: j.sessionId, game });
    } catch (e) {}
  };

  const doInvite = async () => {
    const r = await inviteToRoom(roomId);
    if (r && r.token) {
      const link = 'https://callmez.app/?join=' + r.token;
      try { await Share.share({ message: `come chat with me in "${title}" on yourZ: ${link}`, url: link }); } catch (e) {}
    }
  };

  const humans = Object.entries(feed.members).filter(([uid]) => uid !== feed.meId).map(([id, name]) => ({ id, name }));
  const canModerate = !!room?.youCreated && !!room?.publicRoomId;
  const [rosterOpen, setRosterOpen] = useState(false);
  const [kicking, setKicking] = useState(null);
  const doKick = async (uid, name) => {
    if (kicking) return;
    setKicking(uid);
    const r = await kickFromRoom(room.publicRoomId, uid);
    setKicking(null);
    if (r && r.ok) {
      feed.setMembers((m) => { const n = { ...m }; delete n[uid]; return n; });
      setRosterOpen(false);
    } else {
      alert((r && r.error) || 'could not remove them');
    }
  };

  const mentionables = [
    ...personas.map((k) => ({ key: k, label: nameOf(k), color: rgbOf(k), type: 'persona' })),
    ...humans.map((h) => ({ key: h.id, label: (h.name || 'someone'), color: '159,176,206', type: 'human' })),
  ];

  const onSend = ({ text, image }) => {
    const ok = feed.send({ text, image, addressed });
    if (ok !== false) setAddressed([]);
    return ok;
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`rgba(${rgbOf(personas[0])},0.14)`, `rgba(${rgbOf(personas[0])},0.04)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      {liveSession ? (
        liveSession.game === 'debate_duel' ? <DebateDuelLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'callbreak' ? <CallbreakLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'poker' ? <PokerLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'pusoy' ? <PusoyLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : liveSession.game === 'ludo' ? <LudoLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
        : <LiarsDiceLive sessionId={liveSession.id} onExit={() => setLiveSession(null)} />
      ) : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
      <SafeAreaView style={{ flex: 1, display: liveSession ? 'none' : 'flex' }} edges={['top', 'bottom']}>

        {gameMenu && !liveSession && (
          <View style={{ position: 'absolute', right: 16, top: 96, zIndex: 31, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(14,11,9,0.97)', overflow: 'hidden' }}>
            {[['debate_duel', '⚖️ debate duel'], ['liarsdice', "liar's dice"], ['callbreak', 'callbreak'], ['poker', "hold'em"], ['pusoy', 'pusoy dos'], ['ludo', 'ludo']].map(([id, name]) => (
              <Pressable key={id} onPress={() => startLive(id)} style={{ paddingHorizontal: 18, paddingVertical: 11, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                <Text style={{ fontFamily: 'Figtree_500Medium', color: 'rgba(245,236,225,0.9)', fontSize: 13 }}>{name}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {rosterOpen && canModerate && (
          <Pressable style={styles.rosterScrim} onPress={() => setRosterOpen(false)}>
            <Pressable style={styles.rosterSheet} onPress={(e) => e.stopPropagation?.()}>
              <Text style={styles.rosterTitle}>your room</Text>
              <Text style={styles.rosterSub}>tap someone to remove them for 24 hours.</Text>
              {humans.length ? humans.map((h) => (
                <View key={h.id} style={styles.rosterRow}>
                  <Text style={styles.rosterName} numberOfLines={1}>{h.name || 'someone'}</Text>
                  <Pressable style={styles.rosterKick} onPress={() => doKick(h.id, h.name)}>
                    <Text style={styles.rosterKickTxt}>{kicking === h.id ? '…' : 'remove'}</Text>
                  </Pressable>
                </View>
              )) : <Text style={styles.rosterEmpty}>no one else here yet.</Text>}
            </Pressable>
          </Pressable>
        )}
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            {personas.length ? (
              <Text style={styles.roomSub} numberOfLines={1}>
                {personas.map((k) => nameOf(k).replace('the ', '')).join(' · ')}
                {humans.length ? `  +  ${humans.map((h) => (h.name || '').split(' ')[0]).join(', ')}` : ''}
              </Text>
            ) : null}
          </View>
          {canModerate ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>
              <Text style={{ fontSize: 12 }}>🛡️</Text>
              <Text style={styles.inviteText}>manage</Text>
            </Pressable>
          ) : null}
          <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]}
            onPress={liveAvail ? () => setLiveSession({ id: liveAvail.id, game: liveAvail.game }) : () => setGameMenu((v) => !v)}>
            <Text style={{ fontSize: 12 }}>🎲</Text>
            <Text style={styles.inviteText}>{liveAvail ? 'join game' : 'play'}</Text>
          </Pressable>
          <Pressable hitSlop={8} style={styles.inviteBtn} onPress={doInvite}>
            <Svg width="13" height="13" viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke={N.candle} strokeWidth="2" strokeLinecap="round" /></Svg>
            <Text style={styles.inviteText}>invite</Text>
          </Pressable>
        </View>

        {/* the presences — lit one rises (curated only; public rooms are a flat feed) */}
        {!room?.publicRoomId && (
        <View style={styles.stage}>
          {personas.map((k) => (
            <Pressable key={k} onPress={() => setAddressed((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])}>
              <RoomPresence pkey={k} active={feed.floor === k} targeted={addressed.includes(k)} />
            </Pressable>
          ))}
          {humans.map((h) => <HumanPresence key={h.id} name={h.name} active={feed.floor === h.id} />)}
        </View>
        )}

        <MessageList lines={feed.lines} booted={feed.booted} mentionables={mentionables} flatFeed={!!room?.publicRoomId} />
        <Composer onSend={onSend} sending={feed.sending} mentionables={mentionables} addressed={addressed} onAddressed={setAddressed} />
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  chev: { color: N.moonDim, fontSize: 30, width: 26, marginTop: -3 },
  roomTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 19 },
  roomSub: { fontFamily: 'Figtree_300Light', color: N.moonDim, fontSize: 12, marginTop: 1 },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(231,176,122,0.3)', backgroundColor: 'rgba(231,176,122,0.06)' },
  inviteText: { fontFamily: 'Figtree_500Medium', color: N.candle, fontSize: 12 },
  stage: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', minHeight: 112, paddingHorizontal: 12, paddingTop: 8 },
  rosterScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  rosterSheet: { width: '100%', borderRadius: 18, backgroundColor: N.night2, borderWidth: 1, borderColor: N.hair, padding: 18 },
  rosterTitle: { fontFamily: 'Fraunces_400Regular', color: N.moon, fontSize: 20 },
  rosterSub: { fontFamily: 'Figtree_400Regular', color: N.moonDim, fontSize: 13, marginTop: 3, marginBottom: 14 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: N.hair },
  rosterName: { fontFamily: 'Figtree_500Medium', color: N.moon, fontSize: 15, flex: 1 },
  rosterKick: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(220,120,120,0.5)' },
  rosterKickTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 12.5 },
  rosterEmpty: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 13, paddingVertical: 12, textAlign: 'center' },
});
