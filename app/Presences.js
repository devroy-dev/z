// yourZ — Presences · the risen-speaker rail's citizens + the DM peer DP.
// Lifted verbatim from RoomChat (R0): a persona presence rises + warms when it
// holds the floor; a human presence is cooler; PeerDP is the 1:1 header face.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { N, faceFor, nameOf, rgbOf } from './roomTheme';

export function RoomPresence({ pkey, active, targeted }) {
  const [ok, setOk] = useState(true);
  const breath = useSharedValue(1);
  const lift = useSharedValue(0);
  const tone = rgbOf(pkey);
  useEffect(() => { breath.value = withRepeat(withTiming(1.04, { duration: 3000 + (pkey.length % 5) * 200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 520, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 12 }, { scale: 0.9 + lift.value * 0.2 }], opacity: 0.5 + lift.value * 0.5 }));
  const halo = useAnimatedStyle(() => ({ opacity: lift.value * 0.9, transform: [{ scale: breath.value * (1 + lift.value * 0.15) }] }));
  const S = 50;
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
          <Svg width={S + 14} height={S + 14}>
            <Defs><RadialGradient id={`rh_${pkey}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={`rgb(${tone})`} stopOpacity="0.6" /><Stop offset="60%" stopColor={`rgb(${tone})`} stopOpacity="0.15" /><Stop offset="100%" stopColor={`rgb(${tone})`} stopOpacity="0" />
            </RadialGradient></Defs>
            <Circle cx={(S + 14) / 2} cy={(S + 14) / 2} r={(S + 14) / 2} fill={`url(#rh_${pkey})`} />
          </Svg>
        </Animated.View>
        <View style={[styles.rpFace, { width: S, height: S, borderRadius: S / 2, borderColor: `rgba(${tone},0.7)` }]}>
          {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: S / 2 }} onError={() => setOk(false)} />
              : <View style={{ width: '100%', height: '100%', backgroundColor: N.night2 }} />}
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: N.moon }, targeted && { color: N.candle }]} numberOfLines={1}>{targeted ? '● ' : ''}{nameOf(pkey).replace('the ', '')}</Text>
    </Animated.View>
  );
}

export function HumanPresence({ name, active }) {
  const lift = useSharedValue(0);
  useEffect(() => { lift.value = withTiming(active ? 1 : 0, { duration: 420, easing: Easing.out(Easing.ease) }); }, [active]);
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * 12 }, { scale: 0.9 + lift.value * 0.2 }], opacity: 0.5 + lift.value * 0.5 }));
  const S = 50;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <Animated.View style={[styles.rpWrap, wrap]}>
      <View style={{ width: S + 14, height: S + 14, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.humanFace, { width: S, height: S, borderRadius: S / 2, borderColor: active ? N.human : 'rgba(180,190,210,0.35)' }]}>
          <Text style={[styles.humanInitials, { color: active ? '#E8ECF4' : '#AEB6C6' }]}>{initials}</Text>
        </View>
      </View>
      <Text style={[styles.rpName, active && { color: '#D8DEEA' }]} numberOfLines={1}>{(name || '').split(' ')[0]}</Text>
    </Animated.View>
  );
}

export function PeerDP({ name, avatar }) {
  const [ok, setOk] = React.useState(!!avatar);
  const S = 34;
  const initials = (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <View style={{ width: S, height: S, borderRadius: S / 2, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(159,176,206,0.4)', backgroundColor: 'rgba(40,46,60,0.6)', alignItems: 'center', justifyContent: 'center' }}>
      {ok && avatar ? <Image source={{ uri: avatar }} style={{ width: '100%', height: '100%' }} onError={() => setOk(false)} />
        : <Text style={{ fontFamily: 'Figtree_600SemiBold', fontSize: 13, color: '#AEB6C6' }}>{initials}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  rpWrap: { alignItems: 'center', width: 78 },
  rpFace: { overflow: 'hidden', borderWidth: 1.5, backgroundColor: N.night2 },
  rpName: { fontFamily: 'Figtree_400Regular', color: N.moonFaint, fontSize: 11.5, marginTop: 6 },
  humanFace: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: 'rgba(40,46,60,0.6)' },
  humanInitials: { fontFamily: 'Figtree_600SemiBold', fontSize: 16 },
});
