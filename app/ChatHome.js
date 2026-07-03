// ════════════════════════════════════════════════════════════════════════
//  yourZ — CHAT MODE. The Moonlight register: cold ink where Play is warm
//  ember. WhatsApp grammar: the pinned trinity (News · Front Desk · Z),
//  then recents — personas and rooms as one list. Inner tabs: Chats ·
//  Updates · Groups · Rooms.
// ════════════════════════════════════════════════════════════════════════
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image, RefreshControl } from 'react-native';
import { FONTS } from './theme';
import { getThreads, listRooms, API_BASE } from './api';
import { personaMeta } from './games/personas';

// ── MOONLIGHT: the cold register ──
export const MOON = {
  ground: '#090C12',
  raise: '#0E1219',
  hair: 'rgba(159,194,232,0.10)',
  hairStrong: 'rgba(159,194,232,0.22)',
  porcelain: '#E4EAF2',
  mist: 'rgba(228,234,242,0.55)',
  faint: 'rgba(228,234,242,0.32)',
  moon: '#9FC2E8',
  moonDeep: '#6E93BD',
};

const dpFor = (k) => `${API_BASE}/faces/${k}.jpg`;
const nameOf = (k) => (personaMeta(k)?.name || k.replace(/^the_/, 'the ').replace(/_/g, ' '));
const ago = (t) => {
  if (!t) return '';
  const m = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'now'; if (m < 60) return m + 'm'; if (m < 1440) return Math.floor(m / 60) + 'h';
  return Math.floor(m / 1440) + 'd';
};

function Row({ face, glyph, tone, name, line, time, pinned, onPress }) {
  return (
    <Pressable style={st.row} onPress={onPress}>
      <View style={[st.ring, tone && { borderColor: tone }]}>
        {face ? <Image source={{ uri: face }} style={st.face} /> : <Text style={st.glyph}>{glyph}</Text>}
      </View>
      <View style={{ flex: 1, marginLeft: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={st.name} numberOfLines={1}>{name}</Text>
          <Text style={st.time}>{pinned ? '📌' : time}</Text>
        </View>
        <Text style={st.line} numberOfLines={1}>{line}</Text>
      </View>
    </Pressable>
  );
}

export default function ChatHome({ onOpen = () => {} }) {
  const [tab, setTab] = useState('chats');
  const [threads, setThreads] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([getThreads(), listRooms()]);
      setThreads(Array.isArray(t) ? t : []);
      setRooms(Array.isArray(r) ? r : (r?.rooms || []));
    } catch (e) {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const pull = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const recents = [
    ...threads.filter((t) => t.persona_key && !t.is_shared).map((t) => ({
      kind: 'persona', key: t.persona_key, name: t.companion_name || nameOf(t.persona_key),
      at: t.last_active, line: 'tap to continue',
    })),
    ...rooms.map((r) => ({ kind: 'room', room: r, name: r.name || 'a room', at: r.last_active || r.created_at, line: (r.personas || []).map((k) => nameOf(k).replace(/^the /, '')).join(' · ') || 'a shared room' })),
  ].sort((a, b) => (String(a.at || '') < String(b.at || '') ? 1 : -1));

  return (
    <View style={st.root}>
      {/* the trinity + the list */}
      {tab === 'chats' && (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pull} tintColor={MOON.moon} />}
          contentContainerStyle={{ paddingBottom: 90 }} showsVerticalScrollIndicator={false}>
          <Row glyph="📰" tone={MOON.hairStrong} face={dpFor('the_anchor')} name="the news" line="the bulletin, fact-checks, ask about anything" pinned onPress={() => onOpen({ kind: 'bulletin' })} />
          <Row glyph="🔔" tone={MOON.hairStrong} name="the front desk" line="set it down — i've got it" pinned onPress={() => onOpen({ kind: 'desk' })} />
          <Row glyph="🌙" tone={MOON.hairStrong} name="Z" line="the quiet room — for what's actually on your mind" pinned onPress={() => onOpen({ kind: 'z' })} />
          <View style={st.divider} />
          {recents.map((r, i) => (
            <Row key={i}
              face={r.kind === 'persona' ? dpFor(r.key) : null}
              glyph={r.kind === 'room' ? '👥' : null}
              tone={r.kind === 'persona' ? (personaMeta(r.key)?.tone || MOON.hair) : MOON.hair}
              name={r.name} line={r.line} time={ago(r.at)}
              onPress={() => onOpen(r.kind === 'persona' ? { kind: 'persona', key: r.key } : { kind: 'room', room: r.room })}
            />
          ))}
          {recents.length === 0 && <Text style={st.empty}>no conversations yet — tap ✎ to meet the house.</Text>}
        </ScrollView>
      )}
      {tab !== 'chats' && (
        <View style={st.soonWrap}>
          <Text style={st.soonTitle}>{tab === 'updates' ? 'updates' : tab === 'groups' ? 'groups' : 'rooms'}</Text>
          <Text style={st.soonLine}>{tab === 'updates' ? 'the house diaries, as stories — moving in next.' : tab === 'groups' ? 'your groups, gathered here — moving in next.' : 'the public rooms — opening soon.'}</Text>
        </View>
      )}

      {/* compose */}
      {tab === 'chats' && (
        <Pressable style={st.fab} onPress={() => onOpen({ kind: 'roster' })}>
          <Text style={st.fabTxt}>✎</Text>
        </Pressable>
      )}

      {/* the inner tabs */}
      <View style={st.tabs}>
        {[['chats', 'chats'], ['updates', 'updates'], ['groups', 'groups'], ['rooms', 'rooms']].map(([id, label]) => (
          <Pressable key={id} style={st.tabBtn} onPress={() => setTab(id)}>
            <Text style={[st.tabTxt, tab === id && st.tabOn]}>{label}</Text>
            {tab === id && <View style={st.tabDot} />}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: MOON.ground },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11 },
  ring: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.4, borderColor: MOON.hair, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: MOON.raise },
  face: { width: 44, height: 44, borderRadius: 22 },
  glyph: { fontSize: 20 },
  name: { fontFamily: FONTS.medium, color: MOON.porcelain, fontSize: 15.5, flex: 1, marginRight: 8 },
  time: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 11.5 },
  line: { fontFamily: FONTS.body, color: MOON.mist, fontSize: 13, marginTop: 2 },
  divider: { height: 1, backgroundColor: MOON.hair, marginVertical: 6, marginHorizontal: 16 },
  empty: { fontFamily: FONTS.body, color: MOON.faint, fontSize: 13.5, textAlign: 'center', paddingTop: 40 },
  fab: { position: 'absolute', right: 20, bottom: 78, width: 54, height: 54, borderRadius: 27, backgroundColor: MOON.moonDeep, alignItems: 'center', justifyContent: 'center', shadowColor: MOON.moon, shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  fabTxt: { color: '#0A0D12', fontSize: 22 },
  tabs: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: MOON.raise, borderTopWidth: 1, borderTopColor: MOON.hair, paddingBottom: 14, paddingTop: 9 },
  tabBtn: { flex: 1, alignItems: 'center', gap: 4 },
  tabTxt: { fontFamily: FONTS.medium, color: MOON.faint, fontSize: 12.5 },
  tabOn: { color: MOON.moon },
  tabDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: MOON.moon },
});
