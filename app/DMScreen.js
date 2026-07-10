// ════════════════════════════════════════════════════════════════════════
//  yourZ — DMScreen · 1:1 HUMAN DM, a thin shell on the chat core (R0).
//  What was nine isDM branches inside RoomChat is now this screen's nature:
//  steel gradient, peer DP header with delete + video call, no presence rail,
//  no typing bubble, speaker names hidden, DM placeholder + empty copy.
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Grain from './Grain';
import VideoCall from './VideoCall';
import { deleteRoomThread } from './api';
import useRoomFeed from './useRoomFeed';
import MessageList from './MessageList';
import Composer from './Composer';
import { PeerDP } from './Presences';
import { N } from './roomTheme';

export default function DMScreen({ room, onBack = () => {} }) {
  const roomId = room?.id;
  const feed = useRoomFeed(roomId, { personas: [], isDM: true });
  const [inCall, setInCall] = useState(false);

  const humans = Object.entries(feed.members).filter(([uid]) => uid !== feed.meId).map(([id, name]) => ({ id, name }));
  const peer = humans[0] || null;
  const peerName = (peer && peer.name) || room?.name || 'them';
  const peerAvatar = peer ? (feed.avatars[peer.id] || null) : null;

  const doDeleteDM = () => {
    Alert.alert('delete this chat?', 'this removes the conversation for you. it can’t be undone.',
      [{ text: 'cancel', style: 'cancel' },
       { text: 'delete', style: 'destructive', onPress: async () => { try { await deleteRoomThread(room.id); } catch (e) {} onBack(); } }]);
  };

  if (inCall) return <VideoCall persona={{ key: (peer && peer.id) || 'peer', name: peerName, customPhoto: peerAvatar }} onEnd={() => setInCall(false)} />;

  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(159,176,206,0.06)', 'rgba(159,176,206,0.02)', N.night]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Grain />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <View style={styles.topbar}>
            <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <PeerDP name={peerName} avatar={peerAvatar} />
              <Text style={styles.roomTitle} numberOfLines={1}>{peerName}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Pressable hitSlop={10} onPress={doDeleteDM}>
                <Svg width="19" height="19" viewBox="0 0 24 24" fill="none"><Path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" stroke={N.moonDim} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></Svg>
              </Pressable>
              <Pressable hitSlop={10} style={styles.callBtn} onPress={() => setInCall(true)}>
                <Svg width="20" height="20" viewBox="0 0 24 24" fill="none"><Path d="M15 10l4.5-3v10L15 14M4 7h9a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V9a2 2 0 012-2z" stroke="rgb(159,176,206)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/></Svg>
              </Pressable>
            </View>
          </View>

          {/* [zip56] the diagnostic pill — temporary, founder eyes only */}
          <Text style={{ fontFamily: 'Figtree_300Light', fontSize: 10, color: 'rgba(233,232,240,0.4)', paddingHorizontal: 18, paddingBottom: 2 }}>
            rt:{String(feed.rt)}  r:{feed.rtCount}  p:{feed.rtRendered}  last:{String(feed.rtLast)}
          </Text>
          <MessageList lines={feed.lines} booted={feed.booted} hideSpeaker emptyCopy="just the two of you — say hello." onRetry={feed.retrySend} />
          <Composer onSend={({ text, image }) => feed.send({ text, image })} sending={feed.sending} placeholder="message…" />{/* [H1] */}
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
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(159,176,206,0.35)', backgroundColor: 'rgba(255,255,255,0.02)' },
});
