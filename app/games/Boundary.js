// ════════════════════════════════════════════════════════════════════════
//  yourZ — the game boundary. A crashing table must NEVER take the app
//  down. Catches render errors, shows the actual error on screen (the
//  device becomes the debugger), offers a way back to the arena.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { C, FONTS } from '../theme';

export default class GameBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null, info: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { this.setState({ info: info?.componentStack || '' }); }
  render() {
    if (!this.state.err) return this.props.children;
    const msg = String(this.state.err?.message || this.state.err);
    return (
      <View style={s.root}>
        <Text style={s.title}>the table broke</Text>
        <Text style={s.sub}>the app is fine — this screen caught it. screenshot this for the fix:</Text>
        <ScrollView style={s.box}>
          <Text style={s.err}>{msg}</Text>
          {this.state.info ? <Text style={s.stack}>{this.state.info.split('\n').slice(0, 8).join('\n')}</Text> : null}
        </ScrollView>
        <Pressable style={s.btn} onPress={this.props.onExit}>
          <Text style={s.btnTxt}>back to the arena</Text>
        </Pressable>
      </View>
    );
  }
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E0912', padding: 24, paddingTop: 80 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 24 },
  sub: { fontFamily: FONTS.light, color: C.muted, fontSize: 13, marginTop: 8, lineHeight: 19 },
  box: { marginTop: 16, maxHeight: 320, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14 },
  err: { fontFamily: FONTS.medium, color: '#F0708C', fontSize: 13.5 },
  stack: { fontFamily: FONTS.light, color: C.faint, fontSize: 11, marginTop: 10, lineHeight: 16 },
  btn: { marginTop: 18, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(243,168,95,0.5)', alignItems: 'center', backgroundColor: 'rgba(243,168,95,0.1)' },
  btnTxt: { fontFamily: FONTS.semibold, color: C.ember, fontSize: 14.5 },
});
