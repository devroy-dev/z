// [zip54j] identity: blush on ink — the fitting room after hours, one lamp on,
// her eye already on what you brought in.
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE STYLIST (the diva's front door; the wardrobe under her eye)
//  The engine came first (zip54i, curl-proven): pieces file themselves with her
//  read; her counsel rides THE WARDROBE on every thread turn. This room is the
//  engine's four doors: THE WARDROBE (the grid) · ADD A PIECE (photo → filed
//  under her eye) · OCCASIONS (style me for X, from what I own) · FILL THE GAP
//  (she names what's missing, then hunts it live — her web, her taste).
//  Verdicts on a fit stay in her thread, where photos already flow.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getWardrobe, addWardrobePiece, deleteWardrobePiece } from './api';
import { FONTS } from './theme';

const BLUSH = '#E8A9B0';
const CHAMPAGNE = '#E7C9A3';
const S = {
  ground: '#0D0809',
  raise: 'rgba(232,169,176,0.06)',
  hair: 'rgba(232,169,176,0.16)',
  ink: '#F4EBEC',
  mist: 'rgba(244,235,236,0.55)',
  faint: 'rgba(244,235,236,0.30)',
};

// module scope — the keyboard lesson holds (zip54f)
function PieceTile({ piece, onDelete }) {
  return (
    <View style={st.tile}>
      {piece.url
        ? <Image source={{ uri: piece.url }} style={st.tileImg} resizeMode="cover" />
        : <View style={[st.tileImg, st.tileGhost]}><Text style={st.tileGhostTxt}>{piece.kind || 'piece'}</Text></View>}
      {piece.kind ? <Text style={st.tileKind} numberOfLines={1}>{piece.kind}</Text> : null}
      <Pressable onPress={() => onDelete(piece.id)} hitSlop={10} style={st.tileX}>
        <Text style={st.tileXTxt}>✕</Text>
      </Pressable>
    </View>
  );
}

export default function StylistRoom({ onBack = () => {}, onChat = () => {}, onAsk = () => {} }) {
  const [pieces, setPieces] = useState(null);   // null=loading | []
  const [filing, setFiling] = useState(false);
  const [occasion, setOccasion] = useState('');

  const load = useCallback(() => {
    getWardrobe().then((r) => setPieces(r?.pieces || [])).catch(() => setPieces([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const addPiece = async () => {
    if (filing) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, quality: 0.5, base64: true,
        allowsMultipleSelection: true, selectionLimit: 6,   // [zip65] the wardrobe fills faster
      });
      if (res.canceled || !res.assets || !res.assets.length) return;
      setFiling(true);
      for (const a of res.assets) {   // [zip65] each files under her eye in turn
        if (!a?.base64) continue;
        try { await addWardrobePiece({ media_type: 'image/jpeg', data: a.base64 }); } catch (e) {}
      }
      load();
    } catch (e) {} finally { setFiling(false); }
  };

  const removePiece = async (id) => {
    setPieces((cur) => (cur || []).filter((p) => p.id !== id));
    try { await deleteWardrobePiece(id); } catch (e) { load(); }
  };

  const askOccasion = () => {
    const what = occasion.trim();
    if (!what) return;
    setOccasion('');
    onAsk(`style me for: ${what} — from my wardrobe first, piece by piece. only then tell me what's missing.`);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>the stylist</Text>
          <Text style={st.sub}>your wardrobe, under her eye</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: 'https://callmez.app/rooms/stylist-wardrobe.jpg?v=1' }} style={{ width: '100%', height: 150, borderRadius: 14, marginBottom: 6 }} resizeMode="cover" />{/* [zip54l] her atelier */}
        {/* THE WARDROBE */}
        {pieces === null ? (
          <ActivityIndicator color={BLUSH} style={{ marginVertical: 30 }} />
        ) : pieces.length === 0 ? (
          <Text style={st.empty}>nothing filed yet. add the first piece — a photo is enough, she does the rest.</Text>
        ) : (
          <View style={st.grid}>
            {pieces.map((p) => <PieceTile key={p.id} piece={p} onDelete={removePiece} />)}
          </View>
        )}

        <Pressable onPress={addPiece} style={[st.cta, filing && { opacity: 0.6 }]}>
          <Text style={st.ctaTxt}>{filing ? 'filing under her eye…' : '+ add a piece'}</Text>
        </Pressable>

        {/* OCCASIONS */}
        <Text style={st.section}>an occasion</Text>
        <View style={st.occasionRow}>
          <TextInput
            style={st.occasionInput}
            value={occasion}
            onChangeText={setOccasion}
            placeholder="wedding friday · date night · office monday"
            placeholderTextColor={S.faint}
            onSubmitEditing={askOccasion}
            returnKeyType="send"
          />
          <Pressable onPress={askOccasion} style={st.occasionGo}><Text style={st.occasionGoTxt}>style me →</Text></Pressable>
        </View>

        {/* FILL THE GAP */}
        <Pressable
          onPress={() => onAsk("read my wardrobe and name the 2–3 missing pieces that would unlock the most outfits. then for the most important one, hunt real options I can buy right now — with prices — that go with what I already own.")}
          style={st.gap}>
          <Text style={st.gapTxt}>fill the gap →</Text>
          <Text style={st.gapSub}>she names what's missing, then hunts it — priced, matched to what you own</Text>
        </Pressable>

        {/* HER VERDICT */}
        <Pressable onPress={onChat} style={st.ghost}>
          <Text style={st.ghostTxt}>her verdict on a fit →</Text>
          <Text style={st.gapSub}>open her thread, send the photo — she'll tell you the truth</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: S.ground },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, gap: 12 },
  back: { color: S.ink, fontSize: 30, fontFamily: FONTS.light, marginTop: -4 },
  title: { color: S.ink, fontSize: 19, fontFamily: FONTS.semi, letterSpacing: 0.2 },
  sub: { color: S.mist, fontSize: 12, fontFamily: FONTS.light, marginTop: 1 },
  empty: { color: S.mist, fontSize: 13, fontFamily: FONTS.light, lineHeight: 19, marginVertical: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '31.5%', aspectRatio: 0.85, borderRadius: 12, overflow: 'hidden', backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair },
  tileImg: { width: '100%', height: '78%' },
  tileGhost: { alignItems: 'center', justifyContent: 'center' },
  tileGhostTxt: { color: S.faint, fontFamily: FONTS.light, fontSize: 11 },
  tileKind: { color: CHAMPAGNE, fontFamily: FONTS.light, fontSize: 10.5, paddingHorizontal: 7, paddingTop: 4, textTransform: 'lowercase' },
  tileX: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(13,8,9,0.7)', alignItems: 'center', justifyContent: 'center' },
  tileXTxt: { color: S.mist, fontSize: 10 },
  cta: { marginTop: 14, backgroundColor: BLUSH, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaTxt: { color: '#2A1215', fontFamily: FONTS.semi, fontSize: 14.5, letterSpacing: 0.3 },
  section: { color: S.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginTop: 22, marginBottom: 8, textTransform: 'lowercase' },
  occasionRow: { flexDirection: 'row', gap: 8 },
  occasionInput: { flex: 1, backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: S.ink, fontFamily: FONTS.light, fontSize: 13.5 },
  occasionGo: { borderWidth: 1.5, borderColor: BLUSH, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  occasionGoTxt: { color: BLUSH, fontFamily: FONTS.semi, fontSize: 13 },
  gap: { marginTop: 14, borderWidth: 1.5, borderColor: CHAMPAGNE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  gapTxt: { color: CHAMPAGNE, fontFamily: FONTS.semi, fontSize: 13.5 },
  gapSub: { color: S.faint, fontFamily: FONTS.light, fontSize: 11, marginTop: 3, lineHeight: 15 },
  ghost: { marginTop: 10, borderWidth: 1, borderColor: S.hair, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  ghostTxt: { color: S.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
});
