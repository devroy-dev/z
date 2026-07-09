// DeskPane.js — [DESK COMES ALIVE] the most important screen in the house,
// rebuilt on two laws:
//   1. chats show faces; the desk shows PLACES. chats show people; the desk
//      shows THE STATE OF THE WORK. Every card's line is live when the room
//      has something for you, and the soul-line survives only as fallback.
//   2. ledger geometry, not bubble geometry — radius 11, hairlines,
//      rounded-square door plates (circles mean people; they stay in chats).
//
// Data: GET /desk/rooms (pure SELECTs server-side, zero tokens) + the brief's
// top line for the Host header. On any failure the pane falls back to the
// static registry — the desk must never break; it just goes quiet.
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FONTS } from './theme';
import { getDeskRooms, getDeskBrief } from './api';

// Self-contained tokens (kept local to avoid an import cycle with ChatHome).
const N = {
  ground: '#090C12',
  hair: 'rgba(159,194,232,0.10)',
  hairStrong: 'rgba(159,194,232,0.22)',
  porcelain: '#E4EAF2',
  mist: 'rgba(228,234,242,0.55)',
  faint: 'rgba(228,234,242,0.32)',
  ember: '#E7B07A',
};

// A door plate: rounded-square. The one shape law of this pane.
function Plate({ item, size = 46, consultLogo }) {
  const r = Math.round(size * 0.17);
  return (
    <View style={{
      width: size, height: size, borderRadius: r, overflow: 'hidden',
      borderWidth: 1,
      borderColor: item.consult ? 'rgba(232,162,74,0.35)' : (item.tint ? `rgba(${item.tint},0.4)` : N.hairStrong),
      backgroundColor: item.consult ? '#101427' : '#0E1219',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {item.consult ? consultLogo
        : item.face ? <Image source={{ uri: item.face }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        : <Text style={{ color: N.faint, fontSize: Math.round(size * 0.4) }}>#</Text>}
    </View>
  );
}

function Kicker({ children }) {
  return (
    <Text style={{ fontFamily: 'Figtree_600SemiBold', color: N.faint, fontSize: 10.5, letterSpacing: 1.6, marginHorizontal: 20, marginTop: 18, marginBottom: 8 }}>
      {children}
    </Text>
  );
}

// ON THE DESK — a stateful card. Hairline over fill; the tint stays a whisper.
function LiveCard({ item, state, onOpen }) {
  return (
    <Pressable
      onPress={() => onOpen(item.open)}
      style={{
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 14, marginVertical: 3.5,
        paddingVertical: 11, paddingHorizontal: 12,
        borderRadius: 11, borderWidth: 1,
        borderColor: item.tint ? `rgba(${item.tint},0.22)` : N.hair,
        backgroundColor: item.tint ? `rgba(${item.tint},0.035)` : 'transparent',
      }}
    >
      <Plate item={item} size={46} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: 'Figtree_600SemiBold', color: '#FFFFFF', fontSize: 15.5 }}>{item.name}</Text>
        <Text numberOfLines={1} style={{
          fontFamily: FONTS.body, fontSize: 13, marginTop: 2,
          color: state.hot ? N.ember : 'rgba(255,255,255,0.82)',
        }}>{state.line}</Text>
      </View>
      <Text style={{ color: N.faint, fontSize: 17, marginLeft: 8 }}>›</Text>
    </Pressable>
  );
}

// THE REST OF THE HOUSE — quiet rows, edge-to-edge, hairline-separated.
function QuietRow({ item, onOpen, last }) {
  return (
    <Pressable
      onPress={() => onOpen(item.open)}
      style={{
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 20, paddingVertical: 10,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: N.hair,
      }}
    >
      <Plate item={item} size={38} consultLogo={item._consultLogo} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontFamily: 'Figtree_500Medium', color: N.porcelain, fontSize: 14.5 }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ fontFamily: FONTS.body, color: N.faint, fontSize: 12.5, marginTop: 1 }}>{item.line}</Text>
      </View>
    </Pressable>
  );
}

const CACHE = 'z_desk_alive_cache';   // the desk opens already knowing — last state hydrates instantly, the network refreshes silently behind it

export default function DeskPane({ rooms, onOpen, consultLogo, bump = 0 }) {
  const [state, setState] = useState(null);      // { [kind]: {line,hot} | null }
  const [briefLine, setBriefLine] = useState('');
  const fresh = React.useRef(false);             // once the network answers, the disk never overwrites it

  useEffect(() => {
    let dead = false;
    AsyncStorage.getItem(CACHE).then((c) => {
      if (dead || fresh.current || !c) return;
      try { const j = JSON.parse(c); if (j?.rooms) setState(j.rooms); if (j?.brief) setBriefLine(j.brief); } catch (e) {}
    }).catch(() => {});
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    let dead = false;
    getDeskRooms().then((r) => {
      if (dead || !r) return;
      fresh.current = true; setState(r);
      getDeskBrief().then((items) => {
        const b = items?.[0]?.line || '';
        if (!dead && b) setBriefLine(b);
        AsyncStorage.setItem(CACHE, JSON.stringify({ rooms: r, brief: b })).catch(() => {});
      }).catch(() => { AsyncStorage.setItem(CACHE, JSON.stringify({ rooms: r, brief: '' })).catch(() => {}); });
    }).catch(() => {});
    return () => { dead = true; };
  }, [bump]);

  const host = rooms.find((r) => r.open?.kind === 'desk');
  const consult = rooms.find((r) => r.consult);
  const others = rooms.filter((r) => r !== host && r !== consult);

  const stateFor = (r) => (state && r.open?.kind ? state[r.open.kind] : null) || null;
  const live = others.filter((r) => stateFor(r));
  // needs-you first, then the brief's own order is already priority — keep arrival order within each band
  live.sort((a, b) => (stateFor(b).hot ? 1 : 0) - (stateFor(a).hot ? 1 : 0));
  const quiet = others.filter((r) => !stateFor(r));
  if (consult) quiet.push({ ...consult, _consultLogo: consultLogo });

  return (
    <View>
      {/* THE HOST IS THE DESK — the header, not row one. */}
      {host ? (
        <Pressable
          onPress={() => onOpen(host.open)}
          style={{
            flexDirection: 'row', alignItems: 'center',
            marginHorizontal: 14, marginTop: 2, marginBottom: 4,
            paddingVertical: 13, paddingHorizontal: 12,
            borderRadius: 11, borderWidth: 1, borderColor: 'rgba(231,176,122,0.28)',
            backgroundColor: 'rgba(231,176,122,0.05)',
          }}
        >
          <Plate item={host} size={52} />
          <View style={{ flex: 1, marginLeft: 13 }}>
            <Text style={{ fontFamily: FONTS.display, color: '#FFFFFF', fontSize: 18 }}>{host.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: FONTS.body, color: briefLine ? N.ember : 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 }}>
              {briefLine || host.line}
            </Text>
          </View>
          <Text style={{ color: N.faint, fontSize: 17, marginLeft: 8 }}>›</Text>
        </Pressable>
      ) : null}

      {live.length > 0 && (
        <>
          <Kicker>ON THE DESK</Kicker>
          {live.map((r, i) => <LiveCard key={'live' + i} item={r} state={stateFor(r)} onOpen={onOpen} />)}
        </>
      )}

      <Kicker>THE REST OF THE HOUSE</Kicker>
      {quiet.map((r, i) => <QuietRow key={'quiet' + i} item={r} onOpen={onOpen} last={i === quiet.length - 1} />)}
    </View>
  );
}
