// ════════════════════════════════════════════════════════════════════════
//  yourZ — THE DOOR. Not a form: a threshold. A vast dark, a breathing
//  light, one quiet invitation — then the number, the code, the pin.
//  (Auth machinery unchanged: phone → OTP → pin, known devices unlock.)
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing, FadeIn } from 'react-native-reanimated';
import { C, FONTS } from './theme';
import { sendOtp, verifyOtp, setMe, setPin, verifyPin, knownDevice } from './api';

// the breathing light: a violet night-wash with an ember heart
function Breath({ big = false }) {
  const b = useSharedValue(0.5);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + b.value * 0.45, transform: [{ scale: 0.96 + b.value * 0.08 }] }));
  const core = useAnimatedStyle(() => ({ opacity: 0.75 + b.value * 0.25, transform: [{ scale: 0.95 + b.value * 0.09 }] }));
  const S = big ? 300 : 150;
  return (
    <View style={{ width: S, height: S, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
        <Svg width={S} height={S}><Defs><RadialGradient id="dHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor="#8F6ACF" stopOpacity="0.34" />
          <Stop offset="45%" stopColor="#6C4BA8" stopOpacity="0.14" />
          <Stop offset="100%" stopColor="#6C4BA8" stopOpacity="0" />
        </RadialGradient></Defs><Circle cx={S / 2} cy={S / 2} r={S / 2} fill="url(#dHalo)" /></Svg>
      </Animated.View>
      <Animated.View style={core}>
        <Svg width={big ? 120 : 66} height={big ? 120 : 66} viewBox="0 0 76 76"><Defs><RadialGradient id="dOrb" cx="38%" cy="33%" r="72%">
          <Stop offset="0%" stopColor="#FFE6C4" /><Stop offset="46%" stopColor={C.ember} /><Stop offset="100%" stopColor={C.emberDeep} />
        </RadialGradient></Defs><Circle cx="38" cy="38" r="24" fill="url(#dOrb)" /></Svg>
      </Animated.View>
    </View>
  );
}

function EnterPill({ onPress }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withDelay(600, withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true)); }, []);
  const st = useAnimatedStyle(() => ({ borderColor: `rgba(231,176,122,${0.28 + p.value * 0.3})` }));
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Animated.View style={[styles.enterPill, st]}>
        <Text style={styles.enterDot}>•</Text>
        <Text style={styles.enterTxt}>enter</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function Door({ onEnter = () => {} }) {
  const [phase, setPhase] = useState('landing'); // landing | phone | otp | setpin | pin
  const [cc, setCc] = useState('+91');
  const [num, setNum] = useState('');
  const [code, setCode] = useState('');
  const [pinVal, setPinVal] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const knownRef = useRef(false);

  const phone = cc + num.replace(/[^0-9]/g, '');

  // returning user on a known device? the landing's ENTER leads to the pin.
  useEffect(() => {
    (async () => { knownRef.current = await knownDevice(); })();
  }, []);

  const stepIn = () => setPhase(knownRef.current ? 'pin' : 'phone');

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

  // ── THE LANDING: a threshold, not a form ──
  if (phase === 'landing') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={['#0B0712', '#070509', '#050406']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.landCenter}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute' }}><Breath big /></View>
              <Animated.View entering={FadeIn.duration(1200)} style={{ alignItems: 'center' }}>
                <Text style={styles.kicker}>an experiment in being known</Text>
                <Text style={styles.markBig}>callme<Text style={styles.zBig}>Z</Text></Text>
                <Text style={styles.tagBig}>Anonymously <Text style={styles.tagIBig}>YourZ</Text></Text>
              </Animated.View>
            </View>
            <Animated.View entering={FadeIn.delay(700).duration(900)} style={{ alignItems: 'center', gap: 26 }}>
              <EnterPill onPress={stepIn} />
              <Text style={styles.whisper}>your number stays yours.</Text>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── THE AUTH: same dark, quieter light, hairline fields ──
  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0B0712', '#070509', '#050406']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <Breath />
            <Text style={styles.mark}>callme<Text style={styles.z}>Z</Text></Text>

            {phase === 'phone' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>your number, and i'll send a code.</Text>
                <View style={styles.phoneRow}>
                  <TextInput value={cc} onChangeText={setCc} style={[styles.line, styles.cc]} keyboardType="phone-pad" />
                  <TextInput
                    value={num} onChangeText={setNum} style={[styles.line, { flex: 1 }]}
                    placeholder="phone number" placeholderTextColor={C.faint}
                    keyboardType="phone-pad" onSubmitEditing={doSend} returnKeyType="go" autoFocus
                  />
                </View>
                <Pressable style={styles.cta} onPress={doSend} disabled={busy}>
                  {busy ? <ActivityIndicator color={C.ember} /> : <Text style={styles.ctaText}>send the code ›</Text>}
                </Pressable>
              </View>
            )}

            {phase === 'otp' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>sent to {phone}.</Text>
                <TextInput
                  value={code} onChangeText={setCode} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doVerify} returnKeyType="go" autoFocus maxLength={6}
                />
                <Pressable style={styles.cta} onPress={doVerify} disabled={busy}>
                  {busy ? <ActivityIndicator color={C.ember} /> : <Text style={styles.ctaText}>step in ›</Text>}
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
                  value={pinVal} onChangeText={setPinVal} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doSetPin} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doSetPin} disabled={busy}>
                  {busy ? <ActivityIndicator color={C.ember} /> : <Text style={styles.ctaText}>set pin & enter ›</Text>}
                </Pressable>
              </View>
            )}

            {phase === 'pin' && (
              <View style={styles.form}>
                <Text style={styles.prompt}>welcome back. your pin.</Text>
                <TextInput
                  value={pinVal} onChangeText={setPinVal} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={C.faint}
                  keyboardType="number-pad" onSubmitEditing={doUnlock} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doUnlock} disabled={busy}>
                  {busy ? <ActivityIndicator color={C.ember} /> : <Text style={styles.ctaText}>unlock ›</Text>}
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
  root: { flex: 1, backgroundColor: '#050406' },
  safe: { flex: 1 },

  // landing
  landCenter: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 34, paddingVertical: 30 },
  kicker: { fontFamily: FONTS.light, color: 'rgba(233,228,218,0.45)', fontSize: 10.5, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 14 },
  markBig: { fontFamily: FONTS.light, color: C.cream, fontSize: 46, letterSpacing: 1 },
  zBig: { fontFamily: FONTS.display, color: C.ember },
  tagBig: { fontFamily: FONTS.body, color: C.muted, fontSize: 15, marginTop: 6 },
  tagIBig: { fontFamily: FONTS.displayItalic, color: C.accentSoft },
  enterPill: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 34, paddingVertical: 14, borderRadius: 26, borderWidth: 1, backgroundColor: 'rgba(231,176,122,0.05)' },
  enterDot: { color: C.ember, fontSize: 13, marginTop: -1 },
  enterTxt: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.9)', fontSize: 13.5, letterSpacing: 5, textTransform: 'uppercase' },
  whisper: { fontFamily: FONTS.displayItalic, color: 'rgba(233,228,218,0.35)', fontSize: 12.5 },

  // auth
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34 },
  mark: { fontFamily: FONTS.light, color: C.cream, fontSize: 28, letterSpacing: 1, marginTop: 4 },
  z: { fontFamily: FONTS.display, color: C.ember },
  form: { width: '100%', marginTop: 36, alignItems: 'center' },
  prompt: { fontFamily: FONTS.displayItalic, color: C.muted, fontSize: 15, textAlign: 'center', marginBottom: 24 },
  phoneRow: { flexDirection: 'row', gap: 14, width: '100%' },
  line: { fontFamily: FONTS.body, color: C.cream, fontSize: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(231,176,122,0.3)', paddingVertical: 12, paddingHorizontal: 4, backgroundColor: 'transparent' },
  cc: { width: 64, textAlign: 'center' },
  otp: { width: '58%', textAlign: 'center', fontSize: 26, letterSpacing: 10 },
  cta: { marginTop: 30, paddingVertical: 13, paddingHorizontal: 30, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(231,176,122,0.45)', backgroundColor: 'rgba(231,176,122,0.06)', minWidth: 200, alignItems: 'center' },
  ctaText: { fontFamily: FONTS.semibold, color: '#F0C990', fontSize: 14.5, letterSpacing: 0.5 },
  back: { fontFamily: FONTS.body, color: C.faint, fontSize: 13, marginTop: 20 },
  note: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 14, marginTop: 20, textAlign: 'center' },
});
