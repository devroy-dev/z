// [zip79] identity: dusk amber on ink — the traveller's study at blue hour,
// one lantern lit, the map open, her trips laid out like a collection.
// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE TRAVEL DESK (the Wanderer's front door; her trips, surfaced)
//  The engine came first (zip71/73/74, curl-proven): trips file themselves from
//  the conversation and ride THE TRIP block on every turn. This room is the
//  engine made visible — THE TRIPS (the cards) · PLAN A NEW ONE (a place →
//  she builds it) · CONTINUE (open her thread). No search engine, no OTA — she
//  plans and points; bookable finds land as cards in her thread.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTrips, deleteTrip } from './api';
import { FONTS } from './theme';

const AMBER = '#D29650';
const SAND = '#E7C9A3';
const S = {
  ground: '#0C0A08',
  raise: 'rgba(210,150,80,0.06)',
  hair: 'rgba(210,150,80,0.16)',
  ink: '#F4EEE6',
  mist: 'rgba(244,238,230,0.55)',
  faint: 'rgba(244,238,230,0.30)',
};

// module scope — the keyboard lesson holds (zip54f)
function TripCard({ trip, onOpen, onDelete }) {
  const line = [trip.dates, trip.travelers].filter(Boolean).join(' · ');
  return (
    <Pressable style={st.card} onPress={() => onOpen(trip)}>
      <View style={{ flex: 1 }}>
        <Text style={st.cardDest} numberOfLines={1}>{trip.destination}</Text>
        {line ? <Text style={st.cardLine} numberOfLines={1}>{line}</Text> : null}
        {trip.notes ? <Text style={st.cardNotes} numberOfLines={2}>{trip.notes}</Text> : null}
      </View>
      <Pressable onPress={() => onDelete(trip.id)} hitSlop={10} style={st.cardX}>
        <Text style={st.cardXTxt}>✕</Text>
      </Pressable>
    </Pressable>
  );
}

export default function TravelDesk({ onBack = () => {}, onChat = () => {}, onAsk = () => {} }) {
  const [trips, setTrips] = useState(null);   // null=loading | []
  const [dest, setDest] = useState('');

  const load = useCallback(() => {
    getTrips().then((r) => setTrips(r?.trips || [])).catch(() => setTrips([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const removeTrip = async (id) => {
    setTrips((cur) => (cur || []).filter((t) => t.id !== id));
    try { await deleteTrip(id); } catch (e) { load(); }
  };

  const planNew = () => {
    const where = dest.trim();
    if (!where) return;
    setDest('');
    onAsk(`i'm thinking about ${where}. help me plan it — ask me what you need to know, then build the real version.`);
  };

  const openTrip = (trip) => {
    const line = [trip.destination, trip.dates, trip.travelers].filter(Boolean).join(', ');
    onAsk(`back to ${line}. where were we — pick it up and keep building.`);
  };

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={st.header}>
        <Pressable onPress={onBack} hitSlop={12}><Text style={st.back}>‹</Text></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>the travel desk</Text>
          <Text style={st.sub}>your trips, in the Wanderer's hands</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: 'https://callmez.app/rooms/travel-desk.jpg?v=1' }} style={{ width: '100%', height: 150, borderRadius: 14, marginBottom: 6 }} resizeMode="cover" />{/* [zip77] the desk */}

        {/* THE TRIPS */}
        {trips === null ? (
          <ActivityIndicator color={AMBER} style={{ marginVertical: 30 }} />
        ) : trips.length === 0 ? (
          <Text style={st.empty}>no trips yet. tell her where you're headed — or that you don't know yet. she'll take it from there.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {trips.map((t) => <TripCard key={t.id} trip={t} onOpen={openTrip} onDelete={removeTrip} />)}
          </View>
        )}

        {/* PLAN A NEW ONE */}
        <Text style={st.section}>plan a new one</Text>
        <View style={st.planRow}>
          <TextInput
            style={st.planInput}
            value={dest}
            onChangeText={setDest}
            placeholder="vietnam · a quiet week somewhere · rajasthan"
            placeholderTextColor={S.faint}
            onSubmitEditing={planNew}
            returnKeyType="send"
          />
          <Pressable onPress={planNew} style={st.planGo}><Text style={st.planGoTxt}>plan it →</Text></Pressable>
        </View>

        {/* CONTINUE */}
        <Pressable onPress={onChat} style={st.ghost}>
          <Text style={st.ghostTxt}>talk to the Wanderer →</Text>
          <Text style={st.ghostSub}>open her thread — ask anything about anywhere</Text>
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
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 15 },
  cardDest: { color: S.ink, fontFamily: FONTS.semi, fontSize: 16.5, letterSpacing: 0.2 },
  cardLine: { color: SAND, fontFamily: FONTS.light, fontSize: 12.5, marginTop: 3 },
  cardNotes: { color: S.mist, fontFamily: FONTS.light, fontSize: 12, marginTop: 3, lineHeight: 16 },
  cardX: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(12,10,8,0.6)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  cardXTxt: { color: S.mist, fontSize: 11 },
  section: { color: S.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginTop: 22, marginBottom: 8, textTransform: 'lowercase' },
  planRow: { flexDirection: 'row', gap: 8 },
  planInput: { flex: 1, backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: S.ink, fontFamily: FONTS.light, fontSize: 13.5 },
  planGo: { borderWidth: 1.5, borderColor: AMBER, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  planGoTxt: { color: AMBER, fontFamily: FONTS.semi, fontSize: 13 },
  ghost: { marginTop: 14, borderWidth: 1, borderColor: S.hair, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  ghostTxt: { color: S.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
  ghostSub: { color: S.faint, fontFamily: FONTS.light, fontSize: 11, marginTop: 3, lineHeight: 15 },
});
