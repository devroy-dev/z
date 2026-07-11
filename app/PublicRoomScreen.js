// ════════════════════════════════════════════════════════════════════════
//  yourZ — PublicRoomScreen · THE FLOOR'S REGISTER (R1 · ROOMS_SPEC v1 §7.2)
//  The third thin shell on the chat core: useRoomFeed + MessageList +
//  Composer, same parts as DMScreen and CuratedRoomScreen — compose, don't
//  fork. The guest register: lean head (name · host · live members · menu),
//  NO photo-presence row, flat feed of handles in aura colour, member sheet
//  (report · block · mute · creator's kick), one-tap leave, house rules a
//  tap away. Handles arrive from the server — real identity never renders
//  here (the wall is server-side; this screen simply has nothing to leak).
//  The topbar is a VARIANT of the surviving surface's pattern, never a new
//  header (ROOMS_STATUS ruling 3 — the invariant).
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, KeyboardAvoidingView, Image, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Grain from './Grain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import { startGameSession, getLiveGame, kickFromRoom, reportInRoom, blockUser, getMyBlocks, deletePublicRoom, leaveRoom, getThreadPrefs, setThreadPrefs } from './api';   // [R2] prefs pair
import useRoomFeed from './useRoomFeed';
import MessageList from './MessageList';
import Composer from './Composer';
import { N, nameOf, rgbOf } from './roomTheme';

const faceUrl = (k) => `https://callmez.app/faces/${k}.jpg?v=6`;
const HOUSE_RULES = "Open rooms are public and 18+ — you'll be talking with strangers. Keep it civil: the doorman removes slurs, harassment, and doxxing. Don't share anything you wouldn't hand a stranger.";

export default function PublicRoomScreen({ room, onBack = () => {} }) {
  const roomId = room?.id;
  const personas = (room?.personas && room.personas.length) ? room.personas : (room?.persona ? [room.persona] : []);
  const title = room?.name || 'the room';
  const feed = useRoomFeed(roomId, { personas, isDM: false });
  const [addressed, setAddressed] = useState([]);

  // ── live game session in this room (shipped behavior, carried over) ──
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

  const [blocked, setBlocked] = useState(new Set());
  const [muted, setMuted] = useState(new Set());
  const [acting, setActing] = useState(null);
  React.useEffect(() => {
    getMyBlocks().then((r) => setBlocked(new Set(r?.blocked || []))).catch(() => {});
    AsyncStorage.getItem('z_room_mute_' + roomId).then((v) => { try { setMuted(new Set(JSON.parse(v || '[]'))); } catch (e) {} }).catch(() => {});
  }, [roomId]);
  const doReport = async (t) => {
    if (acting) return; setActing(t.id || t.key || '__room');
    await reportInRoom(roomId, t.room ? { room: true } : (t.isPersona ? { targetPersona: t.key } : { targetUserId: t.id }));
    setActing(null); alert(t.room ? 'the room is reported. the house will look at it.' : 'reported to the doorman. thanks for keeping it civil.');
  };
  // [R2] mute room = a thread pref (kills its notifications only). Real state
  // from the server; toggle posts through the whitelisted prefs route.
  const [roomMuted, setRoomMuted] = useState(false);
  React.useEffect(() => { getThreadPrefs(roomId).then((p) => { if (p) setRoomMuted(!!p.muted); }).catch(() => {}); }, [roomId]);
  const toggleRoomMute = () => {
    setRoomMuted((m) => { setThreadPrefs(roomId, { muted: !m }); return !m; });
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
    Alert.alert('leave this room?', 'you can rejoin from the doorway anytime — your handle waits for you.', [
      { text: 'cancel', style: 'cancel' },
      { text: 'leave', style: 'destructive', onPress: async () => { setActing('__leave'); await leaveRoom(roomId); setActing(null); setRosterOpen(false); onBack(); } },
    ]);
  };
  const showRules = () => Alert.alert('the house rules', HOUSE_RULES, [{ text: 'got it' }]);

  const mentionables = [
    ...personas.map((k) => ({ key: k, label: nameOf(k), color: rgbOf(k), type: 'persona' })),
    ...humans.map((h) => ({ key: h.id, label: (h.name || 'someone'), color: '159,176,206', type: 'human' })),
  ];

  const onSend = ({ text, image }) => {
    const ok = feed.send({ text, image, addressed });
    if (ok !== false) setAddressed([]);
    return ok;
  };

  const host = personas[0] || null;
  const liveCount = Object.keys(feed.members || {}).length;

  return (
    <View style={styles.root}>
      <LinearGradient colors={[`rgba(${rgbOf(host)},0.12)`, `rgba(${rgbOf(host)},0.03)`, N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
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
        {rosterOpen && (
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
                      {/* handles only — a tone-tinted monogram, never a DP (the wall) */}
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
                <Pressable style={styles.rulesBtn} onPress={showRules}><Text style={styles.rulesTxt}>house rules</Text></Pressable>
                <Pressable style={styles.rulesBtn} onPress={toggleRoomMute}><Text style={styles.rulesTxt}>{roomMuted ? 'unmute room' : 'mute room'}</Text></Pressable>
                <Pressable style={styles.rulesBtn} onPress={() => doReport({ room: true })}><Text style={styles.rulesTxt}>{acting === '__room' ? '…' : 'report room'}</Text></Pressable>
              </View>
              <View style={styles.sheetFooter}>
                <Pressable style={styles.leaveBtn} onPress={doLeave}><Text style={styles.leaveTxt}>{acting === '__leave' ? '…' : 'leave room'}</Text></Pressable>
                {canModerate ? <Pressable style={styles.delBtn} onPress={doDeleteRoom}><Text style={styles.delTxt}>{acting === '__del' ? '…' : 'delete room'}</Text></Pressable> : null}
              </View>
            </Pressable>
          </Pressable>
        )}

        {/* the lean head — a variant of the room topbar, never a fork */}
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          {host ? <Image source={{ uri: faceUrl(host) }} style={styles.hostFace} /> : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.roomTitle} numberOfLines={1}>{title}</Text>
            <Text style={styles.roomSub} numberOfLines={1}>
              {host ? `${nameOf(host).replace('the ', '')} hosting` : 'open room'}
              {liveCount ? `  ·  ${liveCount} inside` : ''}
            </Text>
          </View>
          <Pressable hitSlop={8} style={[styles.headBtn, { marginRight: 8 }]} onPress={() => setRosterOpen(true)}>
            <Text style={{ fontSize: 12 }}>👥</Text>
            <Text style={styles.headBtnTxt}>members</Text>
          </Pressable>
          <Pressable hitSlop={8} style={styles.headBtn}
            onPress={liveAvail ? () => setLiveSession({ id: liveAvail.id, game: liveAvail.game }) : () => setGameMenu((v) => !v)}>
            <Text style={{ fontSize: 12 }}>🎲</Text>
            <Text style={styles.headBtnTxt}>{liveAvail ? 'join game' : 'play'}</Text>
          </Pressable>
        </View>

        {/* NO presence row — the public floor is a flat feed of handles */}
        <MessageList
          lines={(blocked.size || muted.size) ? feed.lines.filter((l) => !(l.uid && (blocked.has(l.uid) || muted.has(l.uid)))) : feed.lines}
          booted={feed.booted} mentionables={mentionables} flatFeed onRetry={feed.retrySend}
          emptyCopy="the floor is yours — say something and see who answers." />
        <Composer onSend={onSend} sending={feed.sending} mentionables={mentionables} addressed={addressed} onAddressed={setAddressed} />
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: N.night },
  topbar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10, gap: 10 },
  chev: { color: 'rgba(233,232,240,0.6)', fontSize: 28, lineHeight: 30, fontFamily: 'Figtree_400Regular' },
  hostFace: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(201,155,232,0.45)' },
  roomTitle: { color: '#E9E8F0', fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  roomSub: { color: 'rgba(233,232,240,0.45)', fontSize: 11.5, marginTop: 1, fontFamily: 'Figtree_400Regular' },
  headBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(231,176,122,0.4)', paddingHorizontal: 11, paddingVertical: 6 },
  headBtnTxt: { color: '#E7B07A', fontSize: 11.5, fontFamily: 'Figtree_500Medium' },
  rosterScrim: { position: 'absolute', inset: 0, zIndex: 40, backgroundColor: 'rgba(5,4,8,0.72)', justifyContent: 'flex-end' },
  rosterSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#12101A', borderWidth: 1, borderColor: 'rgba(233,232,240,0.1)', paddingHorizontal: 18, paddingTop: 18, paddingBottom: 26 },
  rosterTitle: { color: '#E9E8F0', fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  rosterSub: { color: 'rgba(233,232,240,0.5)', fontSize: 12, marginTop: 4, marginBottom: 12, fontFamily: 'Figtree_400Regular' },
  memRow: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(233,232,240,0.07)' },
  memTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memAvatar: { width: 30, height: 30, borderRadius: 15 },
  memInitial: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(159,176,206,0.18)', alignItems: 'center', justifyContent: 'center' },
  memInitialTxt: { color: 'rgba(199,213,235,0.9)', fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  rosterName: { color: 'rgba(233,232,240,0.88)', fontSize: 13.5, flex: 1, fontFamily: 'Figtree_500Medium' },
  memActions: { flexDirection: 'row', gap: 8, marginTop: 8, marginLeft: 40 },
  actBtn: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(233,232,240,0.2)', paddingHorizontal: 12, paddingVertical: 5 },
  actTxt: { color: 'rgba(233,232,240,0.75)', fontSize: 11.5, fontFamily: 'Figtree_500Medium' },
  actGhost: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  actGhostTxt: { color: 'rgba(233,232,240,0.55)', fontSize: 11.5, fontFamily: 'Figtree_500Medium' },
  actDanger: { borderRadius: 999, borderWidth: 1, borderColor: 'rgba(229,140,140,0.4)', paddingHorizontal: 12, paddingVertical: 5 },
  actDangerTxt: { color: '#E58C8C', fontSize: 11.5, fontFamily: 'Figtree_500Medium' },
  rosterEmpty: { color: 'rgba(233,232,240,0.45)', fontSize: 12.5, paddingVertical: 16, textAlign: 'center', fontFamily: 'Figtree_400Regular' },
  sheetFooter: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'center' },
  rulesBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  rulesTxt: { color: 'rgba(233,232,240,0.6)', fontSize: 12.5, fontFamily: 'Figtree_500Medium' },
  leaveBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,140,140,0.4)', paddingVertical: 10, alignItems: 'center' },
  leaveTxt: { color: '#E58C8C', fontSize: 13, fontFamily: 'Figtree_500Medium' },
  delBtn: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(229,140,140,0.6)', paddingVertical: 10, alignItems: 'center', backgroundColor: 'rgba(229,140,140,0.08)' },
  delTxt: { color: '#E58C8C', fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
});
