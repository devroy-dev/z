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
import React, { useEffect, useLayoutEffect, useState, useCallback } from 'react';
import { roomCache, saveRoomCache } from './roomCache';   // [rooms-alive]
import { View, Text, StyleSheet, StatusBar, Pressable, TextInput, ScrollView, Image, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getTrips, deleteTrip, buildTrip, buildPacklist, checkTripItem } from './api';
import { FONTS } from './theme';

// [fixes-A X2] a failed fetch is not an empty desk — the sentinel lets her say so.
const ERR = '__err';

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

// [fixes-A X2] failure, said quietly and in her voice — tap or pull to try again.
function QuietError({ line, onRetry }) {
  return (
    <Pressable onPress={onRetry} style={st.quietErr} hitSlop={6}>
      <Text style={st.quietErrTxt}>{line}</Text>
    </Pressable>
  );
}

// module scope — the keyboard lesson holds (zip54f)
function StatusChip({ status }) {
  const s = status || 'dreaming';
  return <Text style={[st.chip, st['chip_' + s] || st.chip_dreaming]}>{s}</Text>;
}
function TripCard({ trip, onOpen, onDelete, onBuild, building, expanded, onToggle, onPacklist, packing, onStylist, onCheck }) {
  const line = [trip.dates, trip.travelers].filter(Boolean).join(' · ');
  const planning = trip.status === 'planning' || building;
  const planned = trip.status && trip.status !== 'dreaming' && trip.status !== 'planning';
  const itin = Array.isArray(trip.itinerary) ? trip.itinerary : [];
  const allCheck = Array.isArray(trip.checklist) ? trip.checklist : [];
  const pack = allCheck.filter((c) => c && c.pack);
  const todo = allCheck.filter((c) => c && !c.pack);
  const openCount = todo.filter((c) => !c.done).length;
  // [0055] §4.5 in-trip mode — the card flips to "day N — today's title"
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  const live = trip.status === 'live';
  let dayN = 0, todayTitle = '';
  if (live && trip.start_date) {
    dayN = Math.floor((Date.parse(today + 'T00:00:00Z') - Date.parse(String(trip.start_date) + 'T00:00:00Z')) / 86400000) + 1;
    const d = itin.find((x) => Number(x.day) === dayN);
    todayTitle = (d && d.title) || '';
  }
  return (
    <View style={[st.card, live && st.cardLive]}>
      <Pressable style={st.cardTop} onPress={() => onToggle(trip.id)}>
        <View style={{ flex: 1 }}>
          <View style={st.cardHead}>
            <Text style={st.cardDest} numberOfLines={1}>{trip.destination}</Text>
            <StatusChip status={planning ? 'planning' : trip.status} />
          </View>
          {line ? <Text style={st.cardLine} numberOfLines={1}>{line}</Text> : null}
          {live ? (
            <Text style={st.liveMeta} numberOfLines={1}>day {dayN > 0 ? dayN : 1}{todayTitle ? ` — ${todayTitle}` : ' — enjoy it'}</Text>
          ) : planning ? (
            <Text style={st.cardMeta} numberOfLines={1}>building your plan…</Text>
          ) : planned ? (
            <Text style={st.cardMeta} numberOfLines={1}>
              {itin.length ? `${itin.length}-day plan` : 'planned'}{openCount ? ` · ${openCount} to sort` : ''}{pack.length ? ` · ${pack.length} to pack` : ''}
            </Text>
          ) : (trip.notes ? <Text style={st.cardNotes} numberOfLines={2}>{trip.notes}</Text> : null)}
        </View>
        <Pressable onPress={() => onDelete(trip.id)} hitSlop={10} style={st.cardX}>
          <Text style={st.cardXTxt}>✕</Text>
        </Pressable>
      </Pressable>

      {expanded ? (
        <View style={st.detail}>
          {/* [fixes-A X3·T2] the collapsed card clips dates·travelers to one line; here they read in full */}
          {(trip.dates || trip.travelers) ? (
            <View style={st.fullMeta}>
              {trip.dates ? <Text style={st.fullMetaLine}>{trip.dates}</Text> : null}
              {trip.travelers ? <Text style={st.fullMetaLine}>{trip.travelers}</Text> : null}
            </View>
          ) : null}
          {planning ? (
            <View style={st.buildingRow}>
              <ActivityIndicator color={AMBER} />
              <Text style={st.buildingTxt}>she's building your plan — about 20 seconds. leave this open.</Text>
            </View>
          ) : !planned ? (
            <View>
              {/* [fixes-A X3·T1] the dreaming card clips her notes to 2 lines; expanded shows them whole */}
              {trip.notes ? <Text style={st.fullNotes}>{trip.notes}</Text> : null}
              <Pressable onPress={() => onBuild(trip)} style={st.buildBtn}>
                <Text style={st.buildTxt}>build the plan →</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {live && todayTitle ? (
                <View style={st.todayBox}>
                  <Text style={st.todayHead}>today · day {dayN}</Text>
                  <Text style={st.todayTitle}>{todayTitle}</Text>
                  {((itin.find((x) => Number(x.day) === dayN) || {}).items || []).map((it, i) => <Text key={i} style={st.dayItem}>· {it}</Text>)}
                </View>
              ) : null}
              {itin.map((d) => (
                <View key={d.day} style={[st.dayRow, live && Number(d.day) === dayN && st.dayRowNow]}>
                  <Text style={st.dayNum}>day {d.day}</Text>
                  <View style={{ flex: 1 }}>
                    {d.title ? <Text style={st.dayTitle}>{d.title}</Text> : null}
                    {(d.items || []).map((it, i) => <Text key={i} style={st.dayItem}>· {it}</Text>)}
                  </View>
                </View>
              ))}
              {/* §4.4 the packing list — owned pieces (with photos) + generics */}
              <View style={st.checkBox}>
                <View style={st.packHead}>
                  <Text style={st.checkHead}>packing</Text>
                  <Pressable onPress={() => onPacklist(trip)} disabled={packing} style={[st.packBtn, packing && { opacity: 0.6 }]}>
                    <Text style={st.packBtnTxt}>{packing ? 'building…' : pack.length ? 'rebuild' : 'build from my wardrobe'}</Text>
                  </Pressable>
                </View>
                {pack.length ? (
                  <View>
                    {pack.filter((c) => c.piece_id).map((c, i) => (
                      <View key={`o${i}`} style={st.packOwned}>
                        {c.url ? <Image source={{ uri: c.url }} style={st.packThumb} resizeMode="cover" /> : <View style={[st.packThumb, st.packThumbGhost]} />}
                        <Text style={[st.packOwnedTxt, c.done && st.checkDone]} numberOfLines={2}>{c.item}</Text>
                      </View>
                    ))}
                    {pack.filter((c) => !c.piece_id).map((c, i) => (
                      <Pressable key={`g${i}`} onPress={() => onCheck(trip.id, c.item, true, !c.done)} hitSlop={4}>
                        <Text style={[st.checkItem, c.done && st.checkDone]}>{c.done ? '✓' : '○'}  {c.item}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : <Text style={st.packEmpty}>she'll pack you from your own closet, and flag what's missing.</Text>}
              </View>
              {/* the Wanderer → Stylist handoff: the misses are waiting in her room */}
              {trip.gap_count > 0 ? (
                <Pressable onPress={onStylist} style={st.stylistHandoff}>
                  <Text style={st.stylistHandoffTxt}>the stylist has {trip.gap_count} piece{trip.gap_count === 1 ? '' : 's'} for this trip →</Text>
                  <Text style={st.stylistHandoffSub}>what you're missing, priced and ready to shop</Text>
                </Pressable>
              ) : null}
              {todo.length ? (
                <View style={st.checkBox}>
                  <Text style={st.checkHead}>before you go</Text>
                  {todo.map((c, i) => (
                    <Pressable key={i} onPress={() => onCheck(trip.id, c.item, false, !c.done)} hitSlop={4}>
                      <Text style={[st.checkItem, c.done && st.checkDone]}>{c.done ? '✓' : '○'}  {c.item}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable onPress={() => onOpen(trip)} style={st.openThread}>
                <Text style={st.openThreadTxt}>pick it up with her →</Text>
              </Pressable>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function TravelDesk({ onBack = () => {}, onChat = () => {}, onAsk = () => {}, onStylist = () => {} }) {
  const [trips, setTrips] = useState(null);   // null=loading | []
  const [dest, setDest] = useState('');
  const [buildingId, setBuildingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [packingId, setPackingId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);   // [fixes-A X1] pull-to-refresh

  const load = useCallback(() => getTrips().then((r) => setTrips(r?.trips || [])).catch(() => setTrips(ERR)), []);
  // [rooms-alive] the trips paint from memory before first frame
  useLayoutEffect(() => { const c = roomCache('travel'); if (c?.trips) setTrips(c.trips); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (trips !== null) saveRoomCache('travel', { trips }); }, [trips]);   // [rooms-alive]
  const onRefresh = useCallback(() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }, [load]);

  const removeTrip = async (id) => {
    setTrips((cur) => (cur || []).filter((t) => t.id !== id));
    try { await deleteTrip(id); } catch (e) { load(); }
  };
  // [fixes-B T4/T5] tick a checklist item — optimistic, reconcile on failure.
  // Writes the same jsonb the [[CHECK]] chat tag writes; match by item text + pack flag.
  const toggleCheck = async (tripId, item, pack, nextDone) => {
    setTrips((cur) => (Array.isArray(cur) ? cur : []).map((t) => (t.id === tripId
      ? { ...t, checklist: (Array.isArray(t.checklist) ? t.checklist : []).map((c) => (c.item === item && !!c.pack === !!pack ? { ...c, done: nextDone } : c)) }
      : t)));
    try { await checkTripItem(tripId, item, nextDone, pack); } catch (e) { load(); }
  };

  // [0055] build the plan — the server returns instantly with status 'planning' and
  // builds in the background; we poll the list until it flips to 'planned'.
  const doBuild = async (trip) => {
    if (buildingId) return;
    setBuildingId(trip.id);
    setTrips((cur) => (cur || []).map((t) => (t.id === trip.id ? { ...t, status: 'planning' } : t)));
    try {
      await buildTrip(trip.id);   // returns at once (status 'planning')
    } catch (e) { setBuildingId(null); load(); return; }
    let tries = 0;
    const poll = async () => {
      tries++;
      const r = await getTrips().catch(() => null);
      const fresh = r?.trips?.find((t) => t.id === trip.id);
      if (fresh && fresh.status !== 'planning') {
        setTrips((cur) => (cur || []).map((t) => (t.id === trip.id ? { ...t, ...fresh } : t)));
        setBuildingId(null);
        return;
      }
      if (tries >= 15) { setBuildingId(null); load(); return; }   // ~60s ceiling
      setTimeout(poll, 4000);
    };
    setTimeout(poll, 4000);
  };
  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  // [0055] §4.4 build the packing list from their wardrobe (synchronous ~12s)
  const doPacklist = async (trip) => {
    if (packingId) return;
    setPackingId(trip.id);
    try {
      await buildPacklist(trip.id);
      const r = await getTrips().catch(() => null);
      const fresh = r?.trips?.find((t) => t.id === trip.id);
      if (fresh) setTrips((cur) => (cur || []).map((t) => (t.id === trip.id ? { ...t, ...fresh } : t)));
    } catch (e) {} finally { setPackingId(null); }
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AMBER} />}>
        <Image source={{ uri: 'https://callmez.app/rooms/travel-desk.jpg?v=1' }} style={{ width: '100%', height: 150, borderRadius: 14, marginBottom: 6 }} resizeMode="cover" />{/* [zip77] the desk */}

        {/* THE TRIPS */}
        {trips === null ? (
          <ActivityIndicator color={AMBER} style={{ marginVertical: 30 }} />
        ) : trips === ERR ? (
          <QuietError line={'the desk didn\u2019t answer \u2014 pull to refresh'} onRetry={onRefresh} />
        ) : trips.length === 0 ? (
          <Text style={st.empty}>no trips yet. tell her where you're headed — or that you don't know yet. she'll take it from there.</Text>
        ) : (
          <View style={{ gap: 8 }}>
            {trips.map((t) => (
              <TripCard key={t.id} trip={t} onOpen={openTrip} onDelete={removeTrip}
                onBuild={doBuild} building={buildingId === t.id}
                expanded={expandedId === t.id} onToggle={toggleExpand}
                onPacklist={doPacklist} packing={packingId === t.id} onStylist={onStylist} onCheck={toggleCheck} />
            ))}
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
  card: { backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair, borderRadius: 12, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 15 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardDest: { color: S.ink, fontFamily: FONTS.semi, fontSize: 16.5, letterSpacing: 0.2, flexShrink: 1 },
  cardLine: { color: SAND, fontFamily: FONTS.light, fontSize: 12.5, marginTop: 3 },
  cardMeta: { color: S.mist, fontFamily: FONTS.light, fontSize: 12, marginTop: 3 },
  cardNotes: { color: S.mist, fontFamily: FONTS.light, fontSize: 12, marginTop: 3, lineHeight: 16 },
  cardX: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(12,10,8,0.6)', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  cardXTxt: { color: S.mist, fontSize: 11 },
  chip: { fontFamily: FONTS.semi, fontSize: 9.5, letterSpacing: 0.5, textTransform: 'uppercase', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  chip_dreaming: { color: S.mist, backgroundColor: 'rgba(244,238,230,0.08)' },
  chip_planning: { color: '#191206', backgroundColor: SAND },
  chip_planned: { color: '#191206', backgroundColor: AMBER },
  chip_booked: { color: '#191206', backgroundColor: SAND },
  chip_live: { color: '#08120A', backgroundColor: '#7BD88F' },
  chip_done: { color: S.faint, backgroundColor: 'rgba(244,238,230,0.06)' },
  detail: { borderTopWidth: 1, borderTopColor: S.hair, paddingHorizontal: 15, paddingVertical: 12, gap: 10 },
  fullMeta: { gap: 2 },
  fullMetaLine: { color: SAND, fontFamily: FONTS.light, fontSize: 12.5, lineHeight: 18 },
  fullNotes: { color: S.mist, fontFamily: FONTS.light, fontSize: 13, lineHeight: 19, marginBottom: 4 },
  quietErr: { marginVertical: 20 },
  quietErrTxt: { color: S.mist, fontSize: 13, fontFamily: FONTS.light, lineHeight: 19 },
  buildBtn: { borderWidth: 1.5, borderColor: AMBER, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  buildTxt: { color: AMBER, fontFamily: FONTS.semi, fontSize: 13.5 },
  buildingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  buildingTxt: { flex: 1, color: S.mist, fontFamily: FONTS.light, fontSize: 12.5, lineHeight: 18 },
  dayRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  dayNum: { color: AMBER, fontFamily: FONTS.semi, fontSize: 11, width: 42, marginTop: 2, textTransform: 'lowercase' },
  dayTitle: { color: S.ink, fontFamily: FONTS.semi, fontSize: 13 },
  dayItem: { color: S.mist, fontFamily: FONTS.light, fontSize: 12.5, lineHeight: 18, marginTop: 1 },
  checkBox: { marginTop: 4, borderTopWidth: 1, borderTopColor: S.hair, paddingTop: 10 },
  checkHead: { color: S.faint, fontFamily: FONTS.semi, fontSize: 10, letterSpacing: 0.4, textTransform: 'lowercase', marginBottom: 6 },
  checkItem: { color: S.ink, fontFamily: FONTS.light, fontSize: 12.5, lineHeight: 20 },
  checkDone: { color: S.faint, textDecorationLine: 'line-through' },
  cardLive: { borderColor: AMBER, borderWidth: 1.5 },
  liveMeta: { color: AMBER, fontFamily: FONTS.semi, fontSize: 12.5, marginTop: 3 },
  todayBox: { backgroundColor: 'rgba(210,150,80,0.10)', borderWidth: 1, borderColor: 'rgba(210,150,80,0.30)', borderRadius: 10, padding: 12, marginBottom: 10 },
  todayHead: { color: AMBER, fontFamily: FONTS.semi, fontSize: 10, letterSpacing: 0.5, textTransform: 'lowercase', marginBottom: 3 },
  todayTitle: { color: S.ink, fontFamily: FONTS.semi, fontSize: 14 },
  dayRowNow: { backgroundColor: 'rgba(210,150,80,0.06)', borderRadius: 8, paddingVertical: 2 },
  packHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  packBtn: { borderWidth: 1, borderColor: AMBER, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  packBtnTxt: { color: AMBER, fontFamily: FONTS.semi, fontSize: 11 },
  packEmpty: { color: S.faint, fontFamily: FONTS.light, fontSize: 12, lineHeight: 17 },
  packOwned: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  packThumb: { width: 30, height: 40, borderRadius: 6, backgroundColor: S.hair },
  packThumbGhost: { borderWidth: 1, borderColor: S.hair },
  packOwnedTxt: { flex: 1, color: S.ink, fontFamily: FONTS.light, fontSize: 12.5, lineHeight: 17 },
  stylistHandoff: { marginTop: 8, borderWidth: 1, borderColor: 'rgba(232,169,176,0.35)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: 'rgba(232,169,176,0.06)' },
  stylistHandoffTxt: { color: '#E8A9B0', fontFamily: FONTS.semi, fontSize: 13 },
  stylistHandoffSub: { color: S.faint, fontFamily: FONTS.light, fontSize: 11, marginTop: 2 },
  openThread: { marginTop: 4, alignItems: 'center', paddingVertical: 8, borderWidth: 1, borderColor: S.hair, borderRadius: 10 },
  openThreadTxt: { color: S.ink, fontFamily: FONTS.semi, fontSize: 12.5 },
  section: { color: S.ink, fontSize: 12, fontFamily: FONTS.semi, letterSpacing: 0.4, marginTop: 22, marginBottom: 8, textTransform: 'lowercase' },
  planRow: { flexDirection: 'row', gap: 8 },
  planInput: { flex: 1, backgroundColor: S.raise, borderWidth: 1, borderColor: S.hair, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: S.ink, fontFamily: FONTS.light, fontSize: 13.5 },
  planGo: { borderWidth: 1.5, borderColor: AMBER, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  planGoTxt: { color: AMBER, fontFamily: FONTS.semi, fontSize: 13 },
  ghost: { marginTop: 14, borderWidth: 1, borderColor: S.hair, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  ghostTxt: { color: S.ink, fontFamily: FONTS.semi, fontSize: 13.5 },
  ghostSub: { color: S.faint, fontFamily: FONTS.light, fontSize: 11, marginTop: 3, lineHeight: 15 },
});
