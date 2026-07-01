// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE DOOR (auth). Phone → OTP → in. The real login the live engine
//  requires (Bearer token). Warm, minimal, in the Lamplight aesthetic — an
//  ember you step past, not a form you fill. Unlocks everything authed.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { C, FONTS } from './theme';
import { sendOtp, verifyOtp, setMe, setPin, verifyPin, knownDevice } from './api';

function Ember() {
  const b = useSharedValue(0.6);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const orb = useAnimatedStyle(() => ({ transform: [{ scale: 0.94 + b.value * 0.1 }], opacity: 0.7 + b.value * 0.3 }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.3 + b.value * 0.4 }));
  return (
    <View style={{ width: 130, height: 130, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
        <Svg width="130" height="130"><Defs><RadialGradient id="doorHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={C.emberHot} stopOpacity="0.5" /><Stop offset="55%" stopColor={C.ember} stopOpacity="0.13" /><Stop offset="100%" stopColor={C.ember} stopOpacity="0" />
        </RadialGradient></Defs><Circle cx="65" cy="65" r="65" fill="url(#doorHalo)" /></Svg>
      </Animated.View>
      <Animated.View style={orb}>
        <Svg width="76" height="76" viewBox="0 0 76 76"><Defs><RadialGradient id="doorOrb" cx="38%" cy="33%" r="70%">
          <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="45%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
        </RadialGradient></Defs><Circle cx="38" cy="38" r="26" fill="url(#doorOrb)" /></Svg>
      </Animated.View>
    </View>
  );
}

export default function Door({ onEnter = () => {} }) {
  const [phase, setPhase] = useState('phone'); // phone | otp | setpin | pin
  const [cc, setCc] = useState('+91');
  const [num, setNum] = useState('');
  const [code, setCode] = useState('');
  const [pinVal, setPinVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const phone = cc + num.replace(/[^0-9]/g, '');

  // returning user on a known device? show the PIN unlock instead of phone+OTP
  useEffect(() => {
    (async () => { if (await knownDevice()) setPhase('pin'); })();
  }, []);

  const doSend = async () => {
    if (num.replace(/[^0-9]/g, '').length < 6) { setNote('that number looks too short.'); return; }
    setBusy(true); setNote('sending…');
    const r = await sendOtp(phone);
    setBusy(false);
    if (!r.ok) { setNote(r.error); return; }
    setNote(''); setPhase('otp');
  };

  const doVerify = async () => {
    const c = code.replace(/[^0-9]/g, '');
    if (c.length < 4) { setNote('enter the full code.'); return; }
    setBusy(true); setNote('checking…');
    const r = await verifyOtp(phone, c);
    setBusy(false);
    if (!r.ok) { setNote(r.error); return; }
    if (!r.hasName) { try { await setMe('friend'); } catch (e) {} }
    // first-timers set a PIN so next time is a quick unlock (no OTP)
    if (!r.hasPin) { setNote(''); setPinVal(''); setPhase('setpin'); return; }
    onEnter();
  };

  const doSetPin = async () => {
    const p = pinVal.replace(/[^0-9]/g, '');
    if (p.length !== 4) { setNote('4 digits.'); return; }
    setBusy(true); setNote('saving…');
    const r = await setPin(p);
    setBusy(false);
    if (!r.ok) { setNote(r.error); return; }
    onEnter();
  };

  const doUnlock = async () => {
    const p = pinVal.replace(/[^0-9]/g, '');
    if (p.length !== 4) { setNote('4 digits.'); return; }
    setBusy(true); setNote('checking…');
    const r = await verifyPin(p);
    setBusy(false);
    if (r.needOtp) { setNote("let's verify with a code."); setPhase('phone'); return; }
    if (!r.ok) { setNote(r.error); return; }
    onEnter();
  };


  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A1020', '#0E0912', C.ground]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <Ember />
            <Text style={styles.mark}>callme<Text style={styles.z}>Z</Text></Text>
            <Text style={styles.tag}>Anonymously <Text style={styles.tagI}>Yours</Text></Text>

            {phase === 'phone' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>your number, and i'll send a code.</Text>
                <View style={styles.phoneRow}>
                  <TextInput value={cc} onChangeText={setCc} style={[styles.input, styles.cc]} keyboardType="phone-pad" />
                  <TextInput
                    value={num} onChangeText={setNum} style={[styles.input, { flex: 1 }]}
                    placeholder="phone number" placeholderTextColor={C.faint}
                    keyboardType="phone-pad" onSubmitEditing={doSend} returnKeyType="go" autoFocus
                  />
                </View>
                <Pressable style={styles.cta} onPress={doSend} disabled={busy}>
                  <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
                    {busy ? <ActivityIndicator color="#3A1505" /> : <Text style={styles.ctaText}>send the code</Text>}
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {phase === 'otp' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>sent to {phone}.</Text>
                <TextInput
                  value={code} onChangeText={setCode} style={[styles.input, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doVerify} returnKeyType="go" autoFocus maxLength={6}
                />
                <Pressable style={styles.cta} onPress={doVerify} disabled={busy}>
                  <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
                    {busy ? <ActivityIndicator color="#3A1505" /> : <Text style={styles.ctaText}>step in</Text>}
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => { setPhase('phone'); setNote(''); setCode(''); }}>
                  <Text style={styles.back}>‹ different number</Text>
                </Pressable>
              </View>
            )}

            {phase === 'setpin' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>set a 4-digit pin, so next time is quick.</Text>
                <TextInput
                  value={pinVal} onChangeText={setPinVal} style={[styles.input, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doSetPin} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doSetPin} disabled={busy}>
                  <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
                    {busy ? <ActivityIndicator color="#3A1505" /> : <Text style={styles.ctaText}>set pin & enter</Text>}
                  </LinearGradient>
                </Pressable>
              </View>
            )}

            {phase === 'pin' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>welcome back. your pin.</Text>
                <TextInput
                  value={pinVal} onChangeText={setPinVal} style={[styles.input, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doUnlock} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doUnlock} disabled={busy}>
                  <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaInner}>
                    {busy ? <ActivityIndicator color="#3A1505" /> : <Text style={styles.ctaText}>unlock</Text>}
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={() => { setPhase('phone'); setNote(''); setPinVal(''); }}>
                  <Text style={styles.back}>use a different number</Text>
                </Pressable>
              </View>
            )}

            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  mark: { fontFamily: FONTS.light, color: C.cream, fontSize: 30, letterSpacing: 1, marginTop: 10 },
  z: { fontFamily: FONTS.display, color: C.ember },
  tag: { fontFamily: FONTS.body, color: C.muted, fontSize: 14, marginTop: 2 },
  tagI: { fontFamily: FONTS.displayItalic, color: C.accentSoft },

  form: { width: '100%', marginTop: 40, alignItems: 'center' },
  prompt: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  phoneRow: { flexDirection: 'row', gap: 10, width: '100%' },
  input: { fontFamily: FONTS.body, color: C.cream, fontSize: 17, borderWidth: 1, borderColor: 'rgba(243,168,95,0.25)', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.03)' },
  cc: { width: 74, textAlign: 'center' },
  otp: { width: '60%', textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  cta: { width: '100%', borderRadius: 18, overflow: 'hidden', marginTop: 18 },
  ctaInner: { paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 16, letterSpacing: 0.5 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginTop: 18 },
  note: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14, marginTop: 20, textAlign: 'center' },
});
