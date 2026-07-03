// ════════════════════════════════════════════════════════════════════════
//  callmeZ — THE DOOR. The violet PWA landing + sign-in, native. A void, a
//  breathing ember (the Z's nature as light), one threshold. Then the number,
//  the code, the pin. Matched to callmeZ.app: Cormorant Garamond wordmark,
//  JetBrains Mono eyebrow/enter, the ember violet.
//  (Auth machinery unchanged: phone → OTP → pin, known devices unlock.)
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, Easing, FadeIn, FadeInDown } from 'react-native-reanimated';
import { sendOtp, verifyOtp, setMe, setPin, verifyPin, knownDevice } from './api';

// ── the callmeZ palette, straight from the PWA's CSS vars ──
const VOID = '#0a0a0b';               // --void
const INK = '#F0F0F2';                // --ink (near-white)
const ASH = 'rgba(240,240,242,0.62)'; // --ash (dim text)
const ASH_FAINT = 'rgba(240,240,242,0.30)';
const ASH_GHOST = 'rgba(240,240,242,0.13)';
const EMBER = '124,92,220';           // --ember (the violet)
const EMBER_BRIGHT = '160,130,240';   // --ember-bright

// fonts
const SERIF = 'CormorantGaramond_300Light';
const SERIF_IT = 'CormorantGaramond_400Regular_Italic';
const SERIF_MED = 'CormorantGaramond_500Medium';
const MONO = 'JetBrainsMono_300Light';
const MONO_R = 'JetBrainsMono_400Regular';

// the ember — the Z's nature rendered as light. breathes (8s in the PWA).
function Ember({ size = 300 }) {
  const b = useSharedValue(0.55);
  useEffect(() => { b.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }), -1, true); }, []);
  const halo = useAnimatedStyle(() => ({ opacity: 0.55 + b.value * 0.45, transform: [{ scale: 1 + b.value * 0.09 }] }));
  const core = useAnimatedStyle(() => ({ opacity: 0.5 + b.value * 0.45 }));
  return (
    <View pointerEvents="none" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, halo]}>
        <Svg width={size} height={size}><Defs><RadialGradient id="emberHalo" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={`rgb(${EMBER_BRIGHT})`} stopOpacity="0.20" />
          <Stop offset="26%" stopColor={`rgb(${EMBER})`} stopOpacity="0.13" />
          <Stop offset="46%" stopColor={`rgb(${EMBER})`} stopOpacity="0.05" />
          <Stop offset="68%" stopColor={`rgb(${EMBER})`} stopOpacity="0" />
        </RadialGradient></Defs><Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#emberHalo)" /></Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute' }, core]}>
        <Svg width={size * 0.16} height={size * 0.16}><Defs><RadialGradient id="emberCore" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={`rgb(${EMBER_BRIGHT})`} stopOpacity="0.55" />
          <Stop offset="60%" stopColor={`rgb(${EMBER})`} stopOpacity="0.18" />
          <Stop offset="75%" stopColor={`rgb(${EMBER})`} stopOpacity="0" />
        </RadialGradient></Defs><Circle cx={size * 0.08} cy={size * 0.08} r={size * 0.08} fill="url(#emberCore)" /></Svg>
      </Animated.View>
    </View>
  );
}

// ENTER — a threshold, not a CTA. the dot pulses (2.6s in the PWA).
function EnterPill({ onPress }) {
  const p = useSharedValue(0.55);
  useEffect(() => { p.value = withDelay(400, withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.ease) }), -1, true)); }, []);
  const dot = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.85 + p.value * 0.4 }] }));
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.enterPill}>
      <Animated.View style={[styles.enterDot, dot]} />
      <Text style={styles.enterTxt}>enter</Text>
    </Pressable>
  );
}

// the wordmark — callme + the violet Z (heavier, the signature)
function Wordmark({ size = 'big' }) {
  const big = size === 'big';
  return (
    <Text style={big ? styles.markBig : styles.mark}>
      <Text style={big ? styles.leadBig : styles.lead}>callme</Text>
      <Text style={big ? styles.zBig : styles.z}>Z</Text>
    </Text>
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

  useEffect(() => { (async () => { knownRef.current = await knownDevice(); })(); }, []);

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

  // ── THE LANDING: the held breath ──
  if (phase === 'landing') {
    return (
      <View style={styles.root}>
        <LinearGradient colors={[VOID, '#0d0d10', VOID]} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.landCenter}>
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ position: 'absolute' }}><Ember size={340} /></View>
              <View style={{ alignItems: 'center' }}>
                <Animated.Text entering={FadeInDown.duration(1400).delay(300)} style={styles.eyebrow}>an experiment in being known</Animated.Text>
                <Animated.View entering={FadeInDown.duration(1600).delay(500)}><Wordmark size="big" /></Animated.View>
                <Animated.Text entering={FadeInDown.duration(1600).delay(800)} style={styles.tagBig}>
                  Anonymously <Text style={styles.tagIBig}>YourZ</Text>
                </Animated.Text>
              </View>
            </View>
            <Animated.View entering={FadeIn.delay(1150).duration(1000)} style={{ alignItems: 'center', gap: 24 }}>
              <EnterPill onPress={stepIn} />
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── THE AUTH: same void, the ember quieter, hairline fields ──
  return (
    <View style={styles.root}>
      <LinearGradient colors={[VOID, '#0d0d10', VOID]} locations={[0, 0.42, 1]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <View style={{ position: 'absolute', top: '18%' }}><Ember size={220} /></View>
            <Wordmark size="small" />
            <Text style={styles.tag}>Anonymously <Text style={styles.tagI}>YourZ</Text></Text>

            {phase === 'phone' && (
              <Animated.View entering={FadeIn.duration(500)} style={styles.form}>
                <Text style={styles.prompt}>your number stays yours. we just need it to know it's you.</Text>
                <View style={styles.phoneRow}>
                  <TextInput value={cc} onChangeText={setCc} style={[styles.line, styles.cc]} keyboardType="phone-pad" />
                  <TextInput
                    value={num} onChangeText={setNum} style={[styles.line, { flex: 1 }]}
                    placeholder="phone number" placeholderTextColor={ASH_FAINT}
                    keyboardType="phone-pad" onSubmitEditing={doSend} returnKeyType="go" autoFocus
                  />
                </View>
                <Pressable style={styles.cta} onPress={doSend} disabled={busy}>
                  {busy ? <ActivityIndicator color={`rgb(${EMBER_BRIGHT})`} /> : <Text style={styles.ctaText}>send the code</Text>}
                </Pressable>
              </Animated.View>
            )}

            {phase === 'otp' && (
              <Animated.View entering={FadeIn.duration(500)} style={styles.form}>
                <Text style={styles.prompt}>sent to {phone}.</Text>
                <TextInput
                  value={code} onChangeText={setCode} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={ASH_FAINT}
                  keyboardType="number-pad" onSubmitEditing={doVerify} returnKeyType="go" autoFocus maxLength={6}
                />
                <Pressable style={styles.cta} onPress={doVerify} disabled={busy}>
                  {busy ? <ActivityIndicator color={`rgb(${EMBER_BRIGHT})`} /> : <Text style={styles.ctaText}>step in</Text>}
                </Pressable>
                <Pressable onPress={() => { setPhase('phone'); setNote(''); setCode(''); }}>
                  <Text style={styles.back}>different number</Text>
                </Pressable>
              </Animated.View>
            )}

            {phase === 'setpin' && (
              <Animated.View entering={FadeIn.duration(500)} style={styles.form}>
                <Text style={styles.prompt}>set a 4-digit pin, so next time is quick.</Text>
                <TextInput
                  value={pinVal} onChangeText={setPinVal} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={ASH_FAINT}
                  keyboardType="number-pad" onSubmitEditing={doSetPin} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doSetPin} disabled={busy}>
                  {busy ? <ActivityIndicator color={`rgb(${EMBER_BRIGHT})`} /> : <Text style={styles.ctaText}>set pin & enter</Text>}
                </Pressable>
              </Animated.View>
            )}

            {phase === 'pin' && (
              <Animated.View entering={FadeIn.duration(500)} style={styles.form}>
                <Text style={styles.prompt}>welcome back.</Text>
                <TextInput
                  value={pinVal} onChangeText={setPinVal} style={[styles.line, styles.otp]}
                  placeholder="• • • •" placeholderTextColor={ASH_FAINT}
                  keyboardType="number-pad" onSubmitEditing={doUnlock} returnKeyType="go" autoFocus maxLength={4} secureTextEntry
                />
                <Pressable style={styles.cta} onPress={doUnlock} disabled={busy}>
                  {busy ? <ActivityIndicator color={`rgb(${EMBER_BRIGHT})`} /> : <Text style={styles.ctaText}>unlock</Text>}
                </Pressable>
                <Pressable onPress={() => { setPhase('phone'); setNote(''); setPinVal(''); }}>
                  <Text style={styles.back}>use a different number</Text>
                </Pressable>
              </Animated.View>
            )}

            {note ? <Text style={styles.note}>{note}</Text> : null}
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VOID },
  safe: { flex: 1 },

  // landing
  landCenter: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingHorizontal: 34, paddingVertical: 40 },
  eyebrow: { fontFamily: MONO, color: ASH_FAINT, fontSize: 10, letterSpacing: 5.5, textTransform: 'uppercase', marginBottom: 30, paddingLeft: 5 },

  // wordmark — big (landing)
  markBig: { textAlign: 'center' },
  leadBig: { fontFamily: SERIF_IT, color: INK, fontSize: 76, opacity: 0.92 },
  zBig: { fontFamily: SERIF_MED, color: `rgb(${EMBER_BRIGHT})`, fontSize: 82 },
  tagBig: { fontFamily: SERIF_IT, color: ASH, fontSize: 21, marginTop: 22, letterSpacing: 0.3 },
  tagIBig: { fontFamily: SERIF_IT, color: `rgba(${EMBER_BRIGHT},0.92)` },

  enterPill: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 42, paddingVertical: 17, borderRadius: 100, borderWidth: 1, borderColor: ASH_GHOST, backgroundColor: `rgba(${EMBER},0.04)` },
  enterDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: `rgb(${EMBER_BRIGHT})` },
  enterTxt: { fontFamily: MONO, color: INK, fontSize: 13, letterSpacing: 6, textTransform: 'uppercase', paddingTop: 1 },

  // auth
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36 },
  mark: { textAlign: 'center' },
  lead: { fontFamily: SERIF_IT, color: INK, fontSize: 42, opacity: 0.92 },
  z: { fontFamily: SERIF_MED, color: `rgb(${EMBER_BRIGHT})`, fontSize: 46 },
  tag: { fontFamily: SERIF_IT, color: ASH, fontSize: 15, marginTop: 8 },
  tagI: { fontFamily: SERIF_IT, color: `rgba(${EMBER_BRIGHT},0.92)` },

  form: { width: '100%', marginTop: 44, alignItems: 'center' },
  prompt: { fontFamily: SERIF_IT, color: ASH, fontSize: 16, textAlign: 'center', marginBottom: 26, lineHeight: 24, maxWidth: 300 },
  phoneRow: { flexDirection: 'row', gap: 14, width: '100%' },
  line: { fontFamily: SERIF, color: INK, fontSize: 18, borderBottomWidth: 1, borderBottomColor: `rgba(${EMBER},0.35)`, paddingVertical: 12, paddingHorizontal: 4, backgroundColor: 'transparent' },
  cc: { width: 64, textAlign: 'center' },
  otp: { width: '58%', textAlign: 'center', fontSize: 26, letterSpacing: 10 },
  cta: { marginTop: 32, paddingVertical: 15, paddingHorizontal: 40, borderRadius: 100, borderWidth: 1, borderColor: ASH_GHOST, backgroundColor: `rgba(${EMBER},0.06)`, minWidth: 200, alignItems: 'center' },
  ctaText: { fontFamily: MONO, color: INK, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase' },
  back: { fontFamily: SERIF_IT, color: ASH_FAINT, fontSize: 14, marginTop: 22 },
  note: { fontFamily: SERIF_IT, color: `rgba(${EMBER_BRIGHT},0.9)`, fontSize: 14, marginTop: 20, textAlign: 'center' },
});
