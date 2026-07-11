// ════════════════════════════════════════════════════════════════════════
//  yourZ — YOU (profile). Lives inside the Desk. Its HEART is "what Z
//  remembers": the facts Z knows + the moments Z noticed — each with a
//  "forget" button. Deep memory + your control over it = the trust contract.
//  Also: your name/DP, pinned people, settings.
// ════════════════════════════════════════════════════════════════════════
import * as Updates from 'expo-updates';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Alert, Image, Linking, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Circle, Path } from 'react-native-svg';
import { C, FONTS } from './theme';
import { getLedger, getMemory, forgetMemory, setHandle, findByHandle, requestFriend, respondFriend, getFriends, getMe, authDiag, updateProfile, exportMyData, deleteMyAccount, cachedName, savePush, getPushPrefs } from './api';   // [R3] openDM left with the DM affordance
import AsyncStorage from '@react-native-async-storage/async-storage';   // [zip08] profile identity cache
import { registerForPush, pushPermission } from './push';

// seed: what Z has learned (facts) + noticed (notes). Real data from /notes later.
const SEED_FACTS = [
  { id: 'f1', key: 'work', value: 'building yourZ — a companion app. lawyer before this.' },
  { id: 'f2', key: 'home', value: 'greater noida.' },
  { id: 'f3', key: 'drives you', value: "won't ship anything that doesn't match the vision." },
];
const SEED_NOTES = [
  { id: 'n1', body: "gets sharp and fast when the work is flowing — the ideas come quicker than the words." },
  { id: 'n2', body: "cares more about how something feels than how it looks on paper." },
  { id: 'n3', body: "reframed a bug into a feature tonight without missing a beat. does that a lot." },
];

function MemoryCard({ item, isFact, onForget }) {
  const [forgetting, setForgetting] = useState(false);
  return (
    <View style={[styles.card, forgetting && { opacity: 0.4 }]}>
      <Text style={styles.cardText}>
        {isFact && <Text style={styles.cardKey}>{item.key} · </Text>}
        {isFact ? item.value : item.body}
      </Text>
      <Pressable hitSlop={8} onPress={() => { setForgetting(true); onForget(item.id); }}>
        <Text style={styles.forget}>{forgetting ? '…' : 'forget'}</Text>
      </Pressable>
    </View>
  );
}

export default function You({ onBack = () => {}, onLogout = () => {}, onOpenChat = () => {} }) {
  const [showLedger, setShowLedger] = React.useState(false);
  // ── the update lever: no more guessing which bundle the device runs ──
  const [updState, setUpdState] = React.useState(null);
  const checkUpdates = async () => {
    setUpdState('checking…');
    try {
      const r = await Updates.checkForUpdateAsync();
      if (r.isAvailable) {
        setUpdState('downloading…');
        await Updates.fetchUpdateAsync();
        setUpdState('restarting…');
        await Updates.reloadAsync();
      } else setUpdState('up to date ✓');
    } catch (e) { setUpdState('check failed — try again'); }
  };
  const [ledger, setLedger] = React.useState(null);
  React.useEffect(() => { getLedger().then(setLedger).catch(() => {}); }, []);
  const [showMemory, setShowMemory] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  // profile editor (name · photo · handle)
  const [showProfile, setShowProfile] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifPerm, setNotifPerm] = useState('undetermined');
  const [notifPrefs, setNotifPrefs] = useState({ friend_requests: true, follow_ups: true, buzzes: true, room_invites: true });
  const [notifBusy, setNotifBusy] = useState(false);

  const openNotifs = async () => {
    setShowNotifs(true);
    const perm = await pushPermission();
    setNotifPerm(perm);
    const prefs = await getPushPrefs();
    if (prefs && Object.keys(prefs).length) setNotifPrefs((cur) => ({ ...cur, ...prefs }));
  };

  const enableNotifs = async () => {
    setNotifBusy(true);
    const { granted, token } = await registerForPush();
    setNotifBusy(false);
    setNotifPerm(granted ? 'granted' : 'denied');
    if (granted && token) { await savePush({ pushToken: token, prefs: notifPrefs }); }
    else if (!granted) { Alert.alert('notifications off', 'you can turn them on in your phone settings for callmeZ anytime.'); }
  };

  const toggleNotif = async (key) => {
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    await savePush({ prefs: next });
  };
  const [privacyBusy, setPrivacyBusy] = useState('');

  const doExport = async () => {
    setPrivacyBusy('export'); 
    const r = await exportMyData();
    setPrivacyBusy('');
    if (!r.ok) { Alert.alert('export failed', r.error); return; }
    try {
      await Share.share({ message: JSON.stringify(r.data, null, 2), title: 'your callmeZ data' });
    } catch (e) { Alert.alert('could not share', 'try again.'); }
  };

  const doDelete = () => {
    Alert.alert(
      'delete your account?',
      "this deactivates your account now and permanently erases everything after 30 days. within that window, email help@callmez.app to recover it. this can't be undone after 30 days.",
      [
        { text: 'keep my account', style: 'cancel' },
        { text: 'delete', style: 'destructive', onPress: () => {
          // second confirm — deletion is irreversible after the window
          Alert.alert(
            'are you sure?',
            'your conversations, memories, and everything Z knows about you will be gone.',
            [
              { text: 'cancel', style: 'cancel' },
              { text: 'delete forever', style: 'destructive', onPress: async () => {
                setPrivacyBusy('delete');
                const r = await deleteMyAccount();
                setPrivacyBusy('');
                if (!r.ok) { Alert.alert('could not delete', r.error); return; }
                onLogout();   // sign out into the door
              } },
            ],
          );
        } },
      ],
    );
  };
  const [pName, setPName] = useState('');
  const [pAvatar, setPAvatar] = useState(null);
  const [pHandle, setPHandle] = useState('');
  const [pHandleLocked, setPHandleLocked] = useState(false);
  const [pSaving, setPSaving] = useState(false);
  const [pNote, setPNote] = useState('');

  const openProfile = async () => {
    setPNote('');
    const me = await getMe();
    if (me) {
      setPName(me.displayName || '');
      setPAvatar(me.avatarUrl || null);
      setPHandle(me.handle || '');
      setPHandleLocked(!!me.handle);   // handle is set-once; lock it if already set
    }
    setShowProfile(true);
  };

  const pickProfilePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setPNote('photo permission needed.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true,
      });
      if (res.canceled || !res.assets || !res.assets[0]?.base64) return;
      setPAvatar(`data:image/jpeg;base64,${res.assets[0].base64}`);
    } catch (e) { setPNote('could not open photos.'); }
  };

  const saveProfile = async () => {
    setPSaving(true); setPNote('saving…');
    // name + avatar via /me
    const r = await updateProfile({ displayName: pName.trim(), avatarUrl: pAvatar || '' });
    // handle (only if not already locked and something was typed)
    if (!pHandleLocked && pHandle.trim()) {
      const hr = await setHandle(pHandle.trim().replace(/^@/, ''));
      if (hr?.error) { setPSaving(false); setPNote(hr.error); return; }
    }
    setPSaving(false);
    if (!r.ok) { setPNote(r.error); return; }
    setPNote('saved.');
    if (pName.trim()) setMyName(pName.trim());          // [zip06] header syncs on save
    setMyAvatar(pAvatar || null);
    AsyncStorage.setItem('z_profile_cache', JSON.stringify({ handle: pHandle || '', displayName: pName.trim() || '', avatarUrl: pAvatar || '' })).catch(() => {});   // [zip08]
    setTimeout(() => setShowProfile(false), 600);
  };
  const [myHandle, setMyHandle] = useState('');
  const [handleDraft, setHandleDraft] = useState('');
  const [savingHandle, setSavingHandle] = useState(false);
  const [findDraft, setFindDraft] = useState('');
  const [findResult, setFindResult] = useState(null);
  const [finding, setFinding] = useState(false);
  const [friends, setFriends] = useState({ friends: [], incoming: [], outgoing: [] });
  const loadFriends = React.useCallback(() => { getFriends().then((f) => setFriends(f || { friends: [], incoming: [], outgoing: [] })); }, []);
  // [R3] openFriendChat died with the DM-creation affordance (V2 §1) — the friend
  // graph stays (it feeds room invites); DMs stop being a thing you make.
  React.useEffect(() => { loadFriends(); }, [loadFriends]);
  // seed the saved handle from the server so it shows after leaving/returning (not just the session you set it in)
  const [myName, setMyName] = React.useState('');
  React.useEffect(() => { cachedName().then((n) => { if (n) setMyName((cur) => cur || n); }); }, []);
  const [myAvatar, setMyAvatar] = React.useState(null);   // [zip06] the header photo
  // [zip08] instant identity: seed handle + avatar from the local snapshot, then let
  // the network refresh both the screen and the snapshot. No more letter-then-photo.
  React.useEffect(() => {
    AsyncStorage.getItem('z_profile_cache').then((c) => {
      if (!c) return;
      try {
        const p = JSON.parse(c);
        if (p.handle) setMyHandle((cur) => cur || p.handle);
        if (p.avatarUrl) setMyAvatar((cur) => cur || p.avatarUrl);
        if (p.displayName) setMyName((cur) => cur || p.displayName);
      } catch (e) {}
    }).catch(() => {});
  }, []);
  React.useEffect(() => { getMe().then((m) => {
    if (m && m.handle) setMyHandle(m.handle);
    if (m && m.displayName) setMyName(m.displayName);
    if (m && m.avatarUrl) setMyAvatar(m.avatarUrl);
    if (m) AsyncStorage.setItem('z_profile_cache', JSON.stringify({ handle: m.handle || '', displayName: m.displayName || '', avatarUrl: m.avatarUrl || '' })).catch(() => {});
  }); }, []);
  const saveHandle = async () => {
    const h = handleDraft.trim().toLowerCase().replace(/^@/, '');
    if (!h || savingHandle) return;
    setSavingHandle(true);
    const r = await setHandle(h);
    if (r && r.handle) { setMyHandle(r.handle); setHandleDraft(''); }
    else Alert.alert('handle', r?.error || 'could not save that handle');
    setSavingHandle(false);
  };
  const doFind = async () => {
    const h = findDraft.trim().toLowerCase().replace(/^@/, '');
    if (!h || finding) return;
    setFinding(true); setFindResult(null);
    const r = await findByHandle(h);
    setFindResult(r && !r.error ? r : { error: r?.error || 'no one by that handle' });
    setFinding(false);
  };
  const sendRequest = async (userId) => {
    const r = await requestFriend(userId);
    if (r && !r.error) { setFindResult((cur) => cur ? { ...cur, relation: r.status, youRequested: true } : cur); loadFriends(); }
    else Alert.alert('request', r?.error || 'could not send request');
  };
  const respondTo = async (fromId, action) => {
    const r = await respondFriend(fromId, action);
    if (r && !r.error) loadFriends();
    else Alert.alert('respond', r?.error || 'could not respond');
  };
  const [facts, setFacts] = useState([]);
  const [notes, setNotes] = useState([]);
  React.useEffect(() => {
    getMemory().then((items) => {
      setFacts(items.filter((m) => m.kind !== 'note').map((m) => ({ id: m.id, key: m.key, value: m.value })));
      setNotes(items.filter((m) => m.kind === 'note').map((m) => ({ id: m.id, body: m.value })));
    });
  }, []);
  const forgetFact = (id) => { forgetMemory(id); setTimeout(() => setFacts((f) => f.filter((x) => x.id !== id)), 220); };
  const forgetNote = (id) => { forgetMemory(id); setTimeout(() => setNotes((n) => n.filter((x) => x.id !== id)), 220); };

  if (showFriends) return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={() => setShowFriends(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>friends</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>

          {/* your handle */}
          <Text style={styles.sectionLabel}>your handle</Text>
          {myHandle ? (
            <Text style={styles.friendHandle}>@{myHandle}</Text>
          ) : (
            <View style={styles.friendRowInput}>
              <Text style={styles.atSign}>@</Text>
              <TextInput value={handleDraft} onChangeText={setHandleDraft} placeholder="pick a handle" placeholderTextColor="rgba(232,236,244,0.3)" autoCapitalize="none" autoCorrect={false} style={styles.friendInput} />
              <Pressable onPress={saveHandle} style={styles.friendBtn}><Text style={styles.friendBtnTxt}>{savingHandle ? '…' : 'set'}</Text></Pressable>
            </View>
          )}

          {/* find someone */}
          <Text style={[styles.sectionLabel, { marginTop: 26 }]}>add by handle</Text>
          <View style={styles.friendRowInput}>
            <Text style={styles.atSign}>@</Text>
            <TextInput value={findDraft} onChangeText={setFindDraft} placeholder="their handle" placeholderTextColor="rgba(232,236,244,0.3)" autoCapitalize="none" autoCorrect={false} onSubmitEditing={doFind} style={styles.friendInput} />
            <Pressable onPress={doFind} style={styles.friendBtn}><Text style={styles.friendBtnTxt}>{finding ? '…' : 'find'}</Text></Pressable>
          </View>
          {findResult ? (
            findResult.error ? (
              <Text style={styles.friendMuted}>{findResult.error}</Text>
            ) : (
              <View style={styles.friendCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendName}>{findResult.display_name || '@' + findResult.handle}</Text>
                  <Text style={styles.friendSub}>@{findResult.handle}</Text>
                </View>
                {findResult.relation === 'accepted' ? <Text style={styles.friendMuted}>friends ✓</Text>
                  : findResult.relation === 'pending' ? <Text style={styles.friendMuted}>{findResult.youRequested ? 'requested' : 'wants to add you'}</Text>
                  : <Pressable onPress={() => sendRequest(findResult.id)} style={styles.friendBtn}><Text style={styles.friendBtnTxt}>add</Text></Pressable>}
              </View>
            )
          ) : null}

          {/* requests waiting on you */}
          {friends.incoming.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 26 }]}>wants to add you</Text>
              {friends.incoming.map((u) => (
                <View key={u.id} style={styles.friendCard}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                    : <View style={[styles.friendAvatar, styles.friendAvatarEmpty]}><Text style={styles.friendAvatarLetter}>{(u.display_name || u.handle || '?').slice(0,1).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{u.display_name || '@' + u.handle}</Text>
                    <Text style={styles.friendSub}>@{u.handle}</Text>
                  </View>
                  <Pressable onPress={() => respondTo(u.id, 'accept')} style={styles.friendBtn}><Text style={styles.friendBtnTxt}>accept</Text></Pressable>
                  <Pressable onPress={() => respondTo(u.id, 'decline')} style={styles.friendBtnGhost}><Text style={styles.friendBtnGhostTxt}>✕</Text></Pressable>
                </View>
              ))}
            </>
          )}

          {/* your friends */}
          <Text style={[styles.sectionLabel, { marginTop: 26 }]}>your friends</Text>
          {friends.friends.length === 0 ? (
            <Text style={styles.friendMuted}>no one yet. share your handle or add someone above.</Text>
          ) : friends.friends.map((u) => (
            <View key={u.id} style={styles.friendCard}>
              {u.avatar_url
                ? <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                : <View style={[styles.friendAvatar, styles.friendAvatarEmpty]}><Text style={styles.friendAvatarLetter}>{(u.display_name || u.handle || '?').slice(0,1).toUpperCase()}</Text></View>}
              <View style={{ flex: 1 }}>
                <Text style={styles.friendName}>{u.display_name || '@' + u.handle}</Text>
                <Text style={styles.friendSub}>@{u.handle}</Text>
              </View>
            </View>
          ))}

          {friends.outgoing.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 26 }]}>you asked</Text>
              {friends.outgoing.map((u) => (
                <View key={u.id} style={styles.friendCard}>
                  {u.avatar_url
                    ? <Image source={{ uri: u.avatar_url }} style={styles.friendAvatar} />
                    : <View style={[styles.friendAvatar, styles.friendAvatarEmpty]}><Text style={styles.friendAvatarLetter}>{(u.display_name || u.handle || '?').slice(0,1).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{u.display_name || '@' + u.handle}</Text>
                    <Text style={styles.friendSub}>@{u.handle}</Text>
                  </View>
                  <Text style={styles.friendMuted}>pending</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  if (showProfile) return (
    <View style={styles.root}>
      <LinearGradient colors={[C.void, '#0d0d10', C.void]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => setShowProfile(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>your name & photo</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>

          {/* photo */}
          <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
            <Pressable onPress={pickProfilePhoto} style={styles.pAvatarRing}>
              {pAvatar ? (
                <Image source={{ uri: pAvatar }} style={styles.pAvatarImg} />
              ) : (
                <Text style={styles.pAvatarLetter}>{(pName || 'you').slice(0, 1).toUpperCase()}</Text>
              )}
            </Pressable>
            <Pressable onPress={pickProfilePhoto}><Text style={styles.pPhotoHint}>tap to change photo</Text></Pressable>
          </View>

          {/* name */}
          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>your name</Text>
          <TextInput
            value={pName} onChangeText={setPName}
            placeholder="what should we call you?" placeholderTextColor="rgba(232,236,244,0.3)"
            style={styles.pInput} maxLength={40}
          />

          {/* handle */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>your handle</Text>
          {pHandleLocked ? (
            <Text style={styles.pHandleLocked}>@{pHandle}  <Text style={styles.pHandleNote}>· set once, can't change</Text></Text>
          ) : (
            <View style={styles.pHandleRow}>
              <Text style={styles.pAt}>@</Text>
              <TextInput
                value={pHandle} onChangeText={(t) => setPHandle(t.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                placeholder="pick a handle" placeholderTextColor="rgba(232,236,244,0.3)"
                autoCapitalize="none" autoCorrect={false} style={[styles.pInput, { flex: 1, marginTop: 0 }]} maxLength={20}
              />
            </View>
          )}

          <Pressable style={styles.pSaveBtn} onPress={saveProfile} disabled={pSaving}>
            <Text style={styles.pSaveTxt}>{pSaving ? 'saving…' : 'save'}</Text>
          </Pressable>
          {pNote ? <Text style={styles.pNote}>{pNote}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  if (showPrivacy) return (
    <View style={styles.root}>
      <LinearGradient colors={[C.void, '#0d0d10', C.void]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => setShowPrivacy(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>privacy & data</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>

          <Text style={styles.pvIntro}>your conversations are yours. here's what you can do with your data.</Text>

          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>the policies</Text>
          <Pressable style={styles.pvRow} onPress={() => Linking.openURL('https://callmez.app/privacy')}>
            <Text style={styles.pvRowText}>privacy policy</Text>
            <Text style={styles.settingChev}>↗</Text>
          </Pressable>
          <Pressable style={styles.pvRow} onPress={() => Linking.openURL('https://callmez.app/terms')}>
            <Text style={styles.pvRowText}>terms of service</Text>
            <Text style={styles.settingChev}>↗</Text>
          </Pressable>

          <Text style={[styles.sectionLabel, { marginTop: 26 }]}>your data</Text>
          <Pressable style={styles.pvRow} onPress={doExport} disabled={!!privacyBusy}>
            <Text style={styles.pvRowText}>{privacyBusy === 'export' ? 'gathering…' : 'export my data'}</Text>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>
          <Text style={styles.pvHint}>download everything callmeZ holds about you, as a file you can keep.</Text>

          <Text style={[styles.sectionLabel, { marginTop: 26 }]}>danger zone</Text>
          <Pressable style={[styles.pvRow, styles.pvDanger]} onPress={doDelete} disabled={!!privacyBusy}>
            <Text style={[styles.pvRowText, { color: '#E0A0A0' }]}>{privacyBusy === 'delete' ? 'deleting…' : 'delete my account'}</Text>
            <Text style={[styles.settingChev, { color: '#E0A0A0' }]}>›</Text>
          </Pressable>
          <Text style={styles.pvHint}>deactivates now, permanently erased after 30 days. within that window, email help@callmez.app to recover.</Text>

        </ScrollView>
      </SafeAreaView>
    </View>
  );

  if (showNotifs) return (
    <View style={styles.root}>
      <LinearGradient colors={[C.void, '#0d0d10', C.void]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => setShowNotifs(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>notifications</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>

          {notifPerm !== 'granted' ? (
            <>
              <Text style={styles.pvIntro}>let the house reach you — a friend request, a persona following up, an invite. never spam, always yours to turn off.</Text>
              <Pressable style={styles.nfEnable} onPress={enableNotifs} disabled={notifBusy}>
                <Text style={styles.nfEnableTxt}>{notifBusy ? 'turning on…' : 'turn on notifications'}</Text>
              </Pressable>
              {notifPerm === 'denied' ? (
                <Text style={styles.pvHint}>notifications are off in your phone settings. open settings › callmeZ › notifications to allow.</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.pvIntro}>choose what the house can reach you about.</Text>
              {[
                ['friend_requests', 'friend requests', 'when someone adds you'],
                ['follow_ups', 'persona follow-ups', 'when a persona checks in — like "did you take the interview?"'],
                ['buzzes', 'buzzes', 'when a persona buzzes you'],
                ['room_invites', 'room invites', "when you're invited to a room"],
              ].map(([key, label, hint]) => (
                <Pressable key={key} style={styles.nfToggleRow} onPress={() => toggleNotif(key)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nfLabel}>{label}</Text>
                    <Text style={styles.nfHint}>{hint}</Text>
                  </View>
                  <View style={[styles.nfSwitch, notifPrefs[key] && styles.nfSwitchOn]}>
                    <View style={[styles.nfKnob, notifPrefs[key] && styles.nfKnobOn]} />
                  </View>
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  if (showMemory) return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={() => setShowMemory(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>what z remembers</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>
          {(facts.length > 0 || notes.length > 0) ? (
            <>
              {facts.length > 0 && <Text style={styles.sectionLabel}>what i know about you</Text>}
              {facts.map((f) => <MemoryCard key={f.id} item={f} isFact onForget={forgetFact} />)}

              {notes.length > 0 && <Text style={[styles.sectionLabel, { marginTop: 20 }]}>moments i noticed</Text>}
              {notes.map((n) => <MemoryCard key={n.id} item={n} isFact={false} onForget={forgetNote} />)}
            </>
          ) : (
            <Text style={styles.empty}>nothing yet. the more we talk, the more i'll remember.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  if (showLedger) return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={() => setShowLedger(false)}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>the ledger</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 24, paddingTop: 8 }}>
          {(!ledger || !ledger.feed || ledger.feed.length === 0) ? (
            <Text style={styles.ledgerEmpty}>nothing on the record yet. win a scene or take a match — it lands here.</Text>
          ) : ledger.feed.slice(0, 60).map((e, i) => (
            <View key={i} style={styles.ledgerRow}>
              <Text style={[styles.ledgerOutcome, { color: e.outcome === 'win' ? '#8FD98F' : e.outcome === 'loss' ? '#F0708C' : 'rgba(232,236,244,0.5)' }]}>
                {e.outcome === 'win' ? 'W' : e.outcome === 'loss' ? 'L' : '–'}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.ledgerTitle}>
                  {e.kind === 'stage' ? `${(e.title || 'a scene').replace(/_/g, ' ')} · the stage` : `${e.title}${e.persona ? ` vs ${String(e.persona).replace(/^the_/, 'the ').replace(/_/g, ' ')}` : ''}${e.you != null ? ` · ${e.you}–${e.z}` : ''}`}
                </Text>
                {e.kind === 'stage' && e.notes ? <Text style={styles.ledgerNotes} numberOfLines={3}>“{e.notes}”</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0D1119', '#0A0D14', '#090C12']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onBack}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.topTitle}>you</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* your identity */}
          <View style={styles.identity}>
            {myAvatar
              ? <View style={[styles.bigAvatar, { overflow: 'hidden' }]}><Image source={{ uri: myAvatar }} style={{ width: '100%', height: '100%' }} resizeMode="cover" /></View>
              : <View style={styles.bigAvatar}><Text style={styles.bigInitial}>{(myName || 'you').trim().charAt(0).toUpperCase()}</Text></View>}
            <Text style={styles.name}>{myName || 'you'}</Text>
            <Text style={styles.since}>with Z since june</Text>
          </View>

          {/* the ledger: its own room now */}
          <Pressable style={[styles.settingRow, { marginTop: 4 }]} onPress={() => setShowLedger(true)}>
            <View>
              <Text style={styles.settingText}>the ledger</Text>
              <Text style={styles.ledgerSub}>every judged moment — scenes, matches, verdicts</Text>
            </View>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>

          <Pressable style={[styles.settingRow, { marginTop: 4 }]} onPress={() => setShowMemory(true)}>
            <View>
              <Text style={styles.settingText}>what z remembers</Text>
              <Text style={styles.ledgerSub}>the facts z knows + moments noticed — with forget buttons</Text>
            </View>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>

          <Pressable style={[styles.settingRow, { marginTop: 4 }]} onPress={() => { setShowFriends(true); loadFriends(); }}>
            <View>
              <Text style={styles.settingText}>friends{friends.incoming.length > 0 ? `  ·  ${friends.incoming.length} new` : ''}</Text>
              <Text style={styles.ledgerSub}>{myHandle ? '@' + myHandle : 'set a handle, add people, play together'}</Text>
            </View>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>

          {/* settings, quiet at the bottom */}
          <Text style={[styles.sectionLabel, { marginTop: 28 }]}>settings</Text>
          <Pressable style={styles.settingRow} onPress={checkUpdates}>
            <Text style={styles.settingText}>{updState || 'check for updates'}</Text>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>
          <Pressable style={styles.settingRow} onPress={async () => { const d = await authDiag(); alert('AUTH STATE\n\nz_real_uid: ' + d.z_real_uid + '\nz_refresh: ' + d.z_refresh + '\nz_token: ' + d.z_token + '\nz_exp: ' + d.z_exp + '\n\nknownDevice: ' + d.knownDevice + '\n(' + d.why + ')'); }}>
            <Text style={[styles.settingText, { color: 'rgba(159,194,232,0.7)' }]}>◈ auth diagnostic (temp)</Text>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>
          <Text style={{ fontFamily: 'Figtree_300Light', color: 'rgba(232,236,244,0.32)', fontSize: 10.5, marginHorizontal: 20, marginTop: -8, paddingBottom: 10 }}>
            {Updates.createdAt ? 'updated ' + new Date(Updates.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ', ' + new Date(Updates.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase() : 'built-in bundle'}{Updates.updateId ? '  ·  ' + Updates.updateId.slice(0, 8) : ''}
          </Text>
          <Pressable style={styles.settingRow} onPress={openProfile}>
            <Text style={styles.settingText}>your name & photo</Text>
            <Text style={styles.settingChev}>›</Text>
          </Pressable>
          {['notifications', 'privacy & data', 'sign out'].map((s) => (
            <Pressable key={s} style={styles.settingRow} onPress={
              s === 'sign out' ? onLogout
              : s === 'privacy & data' ? () => setShowPrivacy(true)
              : s === 'notifications' ? openNotifs
              : undefined
            }>
              <Text style={[styles.settingText, s === 'sign out' && { color: '#E0A0A0' }]}>{s}</Text>
              <Text style={styles.settingChev}>›</Text>
            </Pressable>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  pvIntro: { fontFamily: FONTS.regular, color: 'rgba(232,236,244,0.6)', fontSize: 14, lineHeight: 21, marginTop: 8 },
  pvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  pvRowText: { fontFamily: FONTS.regular, color: '#E8ECF4', fontSize: 16 },
  pvHint: { fontFamily: FONTS.regular, color: 'rgba(232,236,244,0.4)', fontSize: 12.5, lineHeight: 18, marginTop: 8 },
  pvDanger: { borderBottomColor: 'rgba(224,160,160,0.2)' },
  nfEnable: { marginTop: 24, paddingVertical: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(159,194,232,0.35)', backgroundColor: 'rgba(159,194,232,0.08)', alignItems: 'center' },
  nfEnableTxt: { fontFamily: FONTS.semibold, color: '#9FC2E8', fontSize: 15 },
  nfToggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  nfLabel: { fontFamily: FONTS.regular, color: '#E8ECF4', fontSize: 15.5 },
  nfHint: { fontFamily: FONTS.regular, color: 'rgba(232,236,244,0.42)', fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  nfSwitch: { width: 46, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', padding: 3, justifyContent: 'center', marginLeft: 12 },
  nfSwitchOn: { backgroundColor: 'rgba(159,194,232,0.55)' },
  nfKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E8ECF4' },
  nfKnobOn: { alignSelf: 'flex-end' },
  ledgerEmpty: { fontFamily: FONTS.light, color: 'rgba(231,215,199,0.45)', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  ledgerRow: { flexDirection: 'row', gap: 12, marginTop: 14, alignItems: 'flex-start' },
  ledgerOutcome: { fontFamily: FONTS.display, fontSize: 16, width: 18, textAlign: 'center', marginTop: 1 },
  ledgerTitle: { fontFamily: FONTS.medium, color: 'rgba(245,236,225,0.88)', fontSize: 13.5 },
  ledgerNotes: { fontFamily: FONTS.displayItalic, color: 'rgba(231,215,199,0.55)', fontSize: 12.5, lineHeight: 18, marginTop: 3 },
  root: { flex: 1, backgroundColor: '#090C12' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  chev: { color: 'rgba(232,236,244,0.55)', fontSize: 30, width: 26, marginTop: -3 },
  topTitle: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 20 },

  identity: { alignItems: 'center', paddingTop: 10, paddingBottom: 24 },
  bigAvatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(159,194,232,0.4)', backgroundColor: 'rgba(159,194,232,0.07)' },
  bigInitial: { fontFamily: FONTS.display, color: '#9FC2E8', fontSize: 36 },
  name: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 26, marginTop: 12 },
  since: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.4)', fontSize: 12.5, marginTop: 3 },

  memHead: { paddingHorizontal: 24, marginBottom: 14 },
  memTitle: { fontFamily: FONTS.display, color: '#E8ECF4', fontSize: 22 },
  memSub: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.5)', fontSize: 13, marginTop: 5, lineHeight: 19 },

  sectionLabel: { fontFamily: FONTS.semibold, color: 'rgba(159,194,232,0.8)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 24, marginBottom: 10 },

  card: { flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginBottom: 8, padding: 15, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,240,228,0.07)', backgroundColor: 'rgba(255,255,255,0.02)' },
  cardText: { flex: 1, fontFamily: FONTS.body, color: '#E8DCCE', fontSize: 14.5, lineHeight: 21 },
  cardKey: { fontFamily: FONTS.semibold, color: C.accentSoft, textTransform: 'lowercase' },
  forget: { fontFamily: FONTS.body, color: C.faint, fontSize: 11, letterSpacing: 0.5, paddingLeft: 12, paddingTop: 2 },

  empty: { fontFamily: FONTS.displayItalic, color: C.faint, fontSize: 15, textAlign: 'center', paddingHorizontal: 40, paddingVertical: 30, lineHeight: 23 },

  ledgerSub: { fontFamily: FONTS.light, color: 'rgba(232,236,244,0.4)', fontSize: 11.5, marginTop: 2 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  settingText: { fontFamily: FONTS.body, color: '#E8ECF4', fontSize: 14.5 },
  settingChev: { color: C.faint, fontSize: 20 },
  // profile editor
  pAvatarRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 1.5, borderColor: 'rgba(159,194,232,0.4)', backgroundColor: 'rgba(159,194,232,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  pAvatarImg: { width: '100%', height: '100%' },
  pAvatarLetter: { fontFamily: FONTS.display, color: 'rgba(159,194,232,0.85)', fontSize: 44 },
  pPhotoHint: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.4)', fontSize: 13, marginTop: 12 },
  pInput: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 17, borderBottomWidth: 1, borderBottomColor: 'rgba(159,194,232,0.3)', paddingVertical: 10, marginHorizontal: 24, marginTop: 4 },
  pHandleRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 24 },
  pAt: { fontFamily: FONTS.display, color: 'rgba(159,194,232,0.7)', fontSize: 20, marginRight: 4 },
  pHandleLocked: { fontFamily: FONTS.body, color: '#F1E7DC', fontSize: 17, marginHorizontal: 24, marginTop: 6 },
  pHandleNote: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.35)', fontSize: 13 },
  pSaveBtn: { marginTop: 34, marginHorizontal: 24, paddingVertical: 15, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(159,194,232,0.3)', backgroundColor: 'rgba(159,194,232,0.08)', alignItems: 'center' },
  pSaveTxt: { fontFamily: FONTS.semibold, color: '#F1E7DC', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' },
  pNote: { fontFamily: FONTS.body, color: 'rgba(159,194,232,0.8)', fontSize: 14, textAlign: 'center', marginTop: 16 },
  friendHandle: { fontFamily: FONTS.medium, color: '#9FC2E8', fontSize: 18, marginBottom: 2 },
  friendRowInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(233,232,240,0.04)', borderWidth: 1, borderColor: 'rgba(233,232,240,0.10)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  atSign: { fontFamily: FONTS.medium, color: 'rgba(232,236,244,0.45)', fontSize: 16 },
  friendInput: { flex: 1, fontFamily: FONTS.body, color: '#E8ECF4', fontSize: 15, paddingVertical: 10, paddingHorizontal: 6 },
  friendBtn: { backgroundColor: 'rgba(159,194,232,0.16)', borderWidth: 1, borderColor: 'rgba(159,194,232,0.4)', borderRadius: 100, paddingHorizontal: 15, paddingVertical: 7, marginLeft: 6 },
  friendBtnTxt: { fontFamily: FONTS.semibold, color: '#9FC2E8', fontSize: 13 },
  friendBtnGhost: { paddingHorizontal: 10, paddingVertical: 7, marginLeft: 4 },
  friendBtnGhostTxt: { color: 'rgba(232,236,244,0.5)', fontSize: 15 },
  friendCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.06)' },
  friendAvatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  friendAvatarLetter: { fontFamily: FONTS.semibold, color: 'rgba(232,236,244,0.7)', fontSize: 16 },
  friendGo: { fontFamily: 'Figtree_500Medium', color: 'rgba(159,176,206,0.85)', fontSize: 13 },
  friendName: { fontFamily: FONTS.medium, color: '#E8ECF4', fontSize: 15.5 },
  friendSub: { fontFamily: FONTS.light, color: 'rgba(232,236,244,0.4)', fontSize: 12, marginTop: 1 },
  friendMuted: { fontFamily: FONTS.body, color: 'rgba(232,236,244,0.4)', fontSize: 13, marginTop: 8 },
});
