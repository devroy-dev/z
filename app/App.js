// ════════════════════════════════════════════════════════════════════════
//  yourZ — dev switcher (temporary). Lets you flip between the finished
//  screens while we build, before they're wired into real navigation.
//  Tap the pill at the bottom to switch Chat <-> Gathering (roster).
// ════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Chat from './Chat';
import Roster from './Roster';

export default function App() {
  const [screen, setScreen] = useState('roster'); // start on the new one

  return (
    <View style={{ flex: 1, backgroundColor: '#0E0912' }}>
      {screen === 'chat' ? <Chat /> : <Roster onOpen={() => setScreen('chat')} />}

      {/* temporary dev switcher */}
      <View style={styles.switcher} pointerEvents="box-none">
        <View style={styles.pill}>
          <Pressable onPress={() => setScreen('roster')} style={[styles.tab, screen === 'roster' && styles.tabOn]}>
            <Text style={[styles.tabText, screen === 'roster' && styles.tabTextOn]}>Gathering</Text>
          </Pressable>
          <Pressable onPress={() => setScreen('chat')} style={[styles.tab, screen === 'chat' && styles.tabOn]}>
            <Text style={[styles.tabText, screen === 'chat' && styles.tabTextOn]}>Chat</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  switcher: { position: 'absolute', bottom: 6, left: 0, right: 0, alignItems: 'center' },
  pill: { flexDirection: 'row', backgroundColor: 'rgba(20,14,24,0.92)', borderRadius: 22, padding: 4, borderWidth: 1, borderColor: 'rgba(243,168,95,0.22)' },
  tab: { paddingVertical: 7, paddingHorizontal: 18, borderRadius: 18 },
  tabOn: { backgroundColor: 'rgba(243,168,95,0.16)' },
  tabText: { color: '#A1929B', fontSize: 13 },
  tabTextOn: { color: '#F3A85F' },
});
