// yourZ — Composer · draft, mic, photo, send — lifted verbatim from RoomChat (R0).
// Owns its voice hook + pending image; hands the send upward as {text, image}.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Image, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { transcribeVoice } from './api';
import { useVoiceNote } from './voice';
import { N } from './roomTheme';

export default function Composer({ onSend, sending = false, placeholder = 'say something to the room…' }) {
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const voice = useVoiceNote();
  const [transcribing, setTranscribing] = useState(false);

  const onMic = async () => {
    if (voice.recording) {
      const clip = await voice.stop();
      if (!clip) return;
      setTranscribing(true);
      try {
        const r = await transcribeVoice(clip.uri, clip.mime);
        if (r.ok && r.transcript) setDraft((d) => (d ? d + ' ' : '') + r.transcript);
        else Alert.alert('couldn’t catch that', r.diag || 'no transcript came back — try again.');
      } catch (e) { Alert.alert('voice error', String(e?.message || e)); }
      setTranscribing(false);
    } else {
      await voice.start();
    }
  };

  const pickPhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5, base64: true });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      const b64 = res.assets[0].base64;
      setPendingImage({ data: b64, uri: `data:image/jpeg;base64,${b64}` });
    } catch (e) {}
  };

  const doSend = () => {
    const ok = onSend({ text: draft, image: pendingImage });
    if (ok !== false) { setDraft(''); setPendingImage(null); }
  };

  return (
    <>
      {pendingImage ? (
        <View style={styles.pendingStrip}>
          <Image source={{ uri: pendingImage.uri }} style={styles.pendingThumb} />
          <Pressable onPress={() => setPendingImage(null)} style={styles.pendingX} hitSlop={8}><Text style={styles.pendingXTxt}>✕</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.composer}>
        <View style={[styles.field, { flexDirection: 'row', alignItems: 'flex-end' }]}>
          <TextInput value={draft} onChangeText={setDraft} placeholder={voice.recording ? 'listening…' : placeholder} placeholderTextColor={N.moonFaint} style={[styles.input, { flex: 1 }]} multiline editable={!sending} />
          <Pressable style={styles.inlineBtn} onPress={pickPhoto} disabled={sending} hitSlop={6}>
            <Text style={styles.inlineBtnTxt}>＋</Text>
          </Pressable>
          <Pressable style={styles.inlineBtn} onPress={onMic} disabled={sending || transcribing} hitSlop={6}>
            <Text style={[styles.inlineMicTxt, voice.recording && styles.micBtnLive]}>{transcribing ? '…' : voice.recording ? '■' : '🎤'}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.send} onPress={doSend}>
          <Svg width="46" height="46" viewBox="0 0 46 46">
            <Defs><RadialGradient id="rsend" cx="42%" cy="36%" r="66%"><Stop offset="0%" stopColor={N.candleHot} /><Stop offset="52%" stopColor={N.candle} /><Stop offset="100%" stopColor="#c88a4f" /></RadialGradient></Defs>
            <Circle cx="23" cy="23" r="17" fill="url(#rsend)" />
            <Path d="M16 23 L30 17 L25.5 30 L22 24.5 Z" fill="#2a1c10" />
          </Svg>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 },
  inlineBtn: { paddingHorizontal: 8, paddingBottom: 10, alignItems: 'center', justifyContent: 'flex-end' },
  inlineBtnTxt: { fontSize: 23, color: '#F0A765', lineHeight: 25 },
  inlineMicTxt: { fontSize: 16, color: '#F0A765', lineHeight: 22 },
  micBtnLive: { color: '#FF6B5A', fontSize: 18 },
  pendingStrip: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row' },
  pendingThumb: { width: 60, height: 60, borderRadius: 10, resizeMode: 'cover' },
  pendingX: { position: 'absolute', left: 62, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center' },
  pendingXTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },
  field: { flex: 1, borderRadius: 22, borderWidth: 1, borderColor: N.hair, backgroundColor: N.night2 },
  input: { fontFamily: 'Figtree_400Regular', color: N.moon, fontSize: 15, paddingHorizontal: 16, paddingVertical: 12, maxHeight: 110 },
  send: { width: 46, height: 46 },
});
