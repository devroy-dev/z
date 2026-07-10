// ════════════════════════════════════════════════════════════════════════
//  yourZ — CuratedRoomScreen · THE SHARED ROOM, a thin shell on the chat core
//  (R0). Persona-tinted gradient, the risen-speaker rail (tap a face to
//  address), games overlays + menu, invite + manage (creator's 24h kick sheet —
//  the member sheet proper lands in R0's final zip). All realtime behavior
//  lives in useRoomFeed; this screen is composition.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Share, KeyboardAvoidingView, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Grain from './Grain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import { startGameSession, getLiveGame, kickFromRoom, inviteToRoom, reportInRoom, blockUser, getMyBlocks, deletePublicRoom, leaveRoom } from './api';
import useRoomFeed from './useRoomFeed';
import MessageList from './MessageList';
import Composer from './Composer';
import { RoomPresence, HumanPresence } from './Presences';
import { N, nameOf, rgbOf } from './roomTheme';
const faceUrl = (k) => `https://callmez.app/faces/${k}.jpg?v=6`;

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

  const isPublic = !!room?.publicRoomId;
  const [blocked, setBlocked] = useState(new Set());
  const [muted, setMuted] = useState(new Set());
  const [acting, setActing] = useState(null);
  React.useEffect(() => {
    if (!isPublic) return;
    getMyBlocks().then((r) => setBlocked(new Set(r?.blocked || []))).catch(() => {});
    AsyncStorage.getItem('z_room_mute_' + roomId).then((v) => { try { setMuted(new Set(JSON.parse(v || '[]'))); } catch (e) {} }).catch(() => {});
  }, [isPublic, roomId]);
  const doReport = async (t) => {
    if (acting) return; setActing(t.id || t.key);
    await reportInRoom(roomId, t.isPersona ? { targetPersona: t.key } : { targetUserId: t.id });
    setActing(null); alert('reported to the doorman. thanks for keeping it civil.');
  };
  const doBlock = (uid, name) => {
    Alert.alert('block ' + (name || 'them') + '?', "you won't see each other's messages in any room.", [
      { text: 'cancel', style: 'cancel' },
      { text: 'block', style: 'destructive', onPress: () => { blockUser(uid); setBlocked((s) => new Set(s).add(uid)); } },
    ]);
  };
  const doMute = (uid) => {
    setMuted((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); AsyncStorage.setItem('z_room_mute_' + roomId, JSON.stringify([...n])).catch(() => {}); return n; });
  };
  const doDeleteRoom = () => {
    Alert.alert('delete this room?', 'it disappears for everyone. this cannot be undone.', [
      { text: 'cancel', style: 'cancel' },
      { text: 'delete', style: 'destructive', onPress: async () => { setActing('__del'); const r = await deletePublicRoom(room.publicRoomId); setActing(null); if (r && r.ok) { setRosterOpen(false); onBack(); } else alert((r && r.error) || 'could not delete the room'); } },
    ]);
  };
  const doLeave = () => {
    Alert.alert('leave this room?', 'you can rejoin from communities anytime.', [
      { text: 'cancel', style: 'cancel' },
      { text: 'leave', style: 'destructive', onPress: async () => { setActing('__leave'); await leaveRoom(roomId); setActing(null); setRosterOpen(false); onBack(); } },
    ]);
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
        {rosterOpen && isPublic && (
          <Pressable style={styles.rosterScrim} onPress={() => setRosterOpen(false)}>
            <Pressable style={styles.rosterSheet} onPress={(e) => e.stopPropagation?.()}>
              <Text style={styles.rosterTitle} numberOfLines={1}>{title}</Text>
              <Text style={styles.rosterSub}>{canModerate ? 'you host this room.' : 'report or block anyone who crosses the line.'}</Text>
              <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
                {personas.map((k) => (
                  <View key={k} style={styles.memRow}>
                    <View style={styles.memTop}>
                      <Image source={{ uri: faceUrl(k) }} style={styles.memAvatar} />
                      <Text style={styles.rosterName} numberOfLines={1}>{nameOf(k)}</Text>
                    </View>
                    <View style={styles.memActions}>
                      <Pressable style={styles.actBtn} onPress={() => doReport({ key: k, isPersona: true })}><Text style={styles.actTxt}>{acting === k ? '…' : 'report'}</Text></Pressable>
                    </View>
                  </View>
                ))}
                {humans.map((h) => (
                  <View key={h.id} style={styles.memRow}>
                    <View style={styles.memTop}>
                      <View style={styles.memInitial}><Text style={styles.memInitialTxt}>{((h.name || '?').trim()[0] || '?').toUpperCase()}</Text></View>
                      <Text style={styles.rosterName} numberOfLines={1}>{h.name || 'someone'}{muted.has(h.id) ? '  · muted' : ''}</Text>
                    </View>
                    <View style={styles.memActions}>
                      <Pressable style={styles.actGhost} onPress={() => doMute(h.id)}><Text style={styles.actGhostTxt}>{muted.has(h.id) ? 'unmute' : 'mute'}</Text></Pressable>
                      <Pressable style={styles.actBtn} onPress={() => doReport({ id: h.id })}><Text style={styles.actTxt}>{acting === h.id ? '…' : 'report'}</Text></Pressable>
                      <Pressable style={styles.actDanger} onPress={() => doBlock(h.id, h.name)}><Text style={styles.actDangerTxt}>block</Text></Pressable>
                      {canModerate ? <Pressable style={styles.actDanger} onPress={() => doKick(h.id, h.name)}><Text style={styles.actDangerTxt}>{kicking === h.id ? '…' : 'kick'}</Text></Pressable> : null}
                    </View>
                  </View>
                ))}
                {!humans.length ? <Text style={styles.rosterEmpty}>no one else here yet — you and the room.</Text> : null}
              </ScrollView>
              <View style={styles.sheetFooter}>
                <Pressable style={styles.leaveBtn} onPress={doLeave}><Text style={styles.leaveTxt}>{acting === '__leave' ? '…' : 'leave room'}</Text></Pressable>
                {canModerate ? <Pressable style={styles.delBtn} onPress={doDeleteRoom}><Text style={styles.delTxt}>{acting === '__del' ? '…' : 'delete room'}</Text></Pressable> : null}
              </View>
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
          {isPublic ? (
            <Pressable hitSlop={8} style={[styles.inviteBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>
              <Text style={{ fontSize: 12 }}>👥</Text>
              <Text style={styles.inviteText}>members</Text>
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

        <MessageList lines={(isPublic && (blocked.size || muted.size)) ? feed.lines.filter((l) => !(l.uid && (blocked.has(l.uid) || muted.has(l.uid)))) : feed.lines} booted={feed.booted} mentionables={mentionables} flatFeed={!!room?.publicRoomId} onRetry={feed.retrySend} />
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
  memRow: { paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: N.hair },
  memTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memAvatar: { width: 32, height: 32, borderRadius: 16 },
  memInitial: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(159,176,206,0.18)', alignItems: 'center', justifyContent: 'center' },
  memInitialTxt: { fontFamily: 'Figtree_600SemiBold', color: N.moon, fontSize: 14 },
  memActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 42 },
  actBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: N.hair },
  actTxt: { fontFamily: 'Figtree_500Medium', color: N.moonDim, fontSize: 12 },
  actGhost: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(233,232,240,0.06)' },
  actGhostTxt: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 12 },
  actDanger: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(224,138,138,0.4)' },
  actDangerTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 12 },
  sheetFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: N.hair },
  leaveBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: N.hair },
  leaveTxt: { fontFamily: 'Figtree_500Medium', color: N.moonDim, fontSize: 13 },
  delBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, backgroundColor: 'rgba(224,138,138,0.14)', borderWidth: 1, borderColor: 'rgba(224,138,138,0.5)' },
  delTxt: { fontFamily: 'Figtree_600SemiBold', color: '#E08A8A', fontSize: 13 },
});
