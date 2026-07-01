// ════════════════════════════════════════════════════════════════════════
//  yourZ — LUDO (the real game, not a slice). 2–4 players (you + personas/humans),
//  four tokens each, the classic 52-step loop + 5-step home column, six-to-leave-
//  base, captures that send a token home, race all four home to win. Rendered on
//  the Skia board with depth. Honors the pacing law: the die tumbles, each player
//  takes a beat that characterizes them, one move at a time, tokens you can tap.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, RoundedRect, Circle, Group, Shadow, Path, Skia } from '@shopify/react-native-skia';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');
const BOARD = Math.min(SCREEN_W - 32, 380);
const CELL = BOARD / 15;

// four seat colors
const COLORS = ['#F0A765', '#6FC9E0', '#8FD98F', '#F0708C']; // red(orange)/blue/green/pink corners
const DARK = ['#7a4a1e', '#2b5a68', '#2f6a3a', '#7a2438'];

// ─── the classic 15×15 Ludo path as grid coords. Standard cross layout. ───
// We build the 52-cell main loop and each player's home column.
// Grid is [col,row], 0..14. Center is 7,7.
function buildTrack() {
  // Main loop cells in order (starting from red's entry), 52 cells.
  // This is the canonical Ludo path.
  const loop = [
    [6,13],[6,12],[6,11],[6,10],[6,9], [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
    [0,7],[0,6], [1,6],[2,6],[3,6],[4,6],[5,6], [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
    [7,0],[8,0], [8,1],[8,2],[8,3],[8,4],[8,5], [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
    [14,7],[14,8], [13,8],[12,8],[11,8],[10,8],[9,8], [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
    [7,14],[6,14],
  ];
  // home columns (5 cells each) leading to center, per player
  const homeCols = [
    [[7,13],[7,12],[7,11],[7,10],[7,9]],   // red goes up center col
    [[1,7],[2,7],[3,7],[4,7],[5,7]],        // blue goes right along center row
    [[7,1],[7,2],[7,3],[7,4],[7,5]],        // green goes down center col
    [[13,7],[12,7],[11,7],[10,7],[9,7]],    // pink goes left along center row
  ];
  // start index in loop for each player (where their token enters), and the index
  // just before they peel into their home column (their "home entry" point).
  const startIdx = [0, 13, 26, 39];
  return { loop, homeCols, startIdx };
}
const TRACK = buildTrack();
const LOOP_LEN = TRACK.loop.length; // 52

// convert a token's logical position → grid [col,row].
// pos: -1 = in base; 0..51 = steps from own start on the loop; 52..56 = home column; 57 = home/done.
function tokenCell(player, pos, baseSlot) {
  if (pos < 0) {
    // parked in base — four slots in the home corner
    const corners = [[1.6,10.6],[10.6,1.6],[10.6,10.6],[1.6,1.6]]; // red bl, blue tr, green br? keep simple
    // place four tokens in a little 2x2 within the corner quadrant
    const bases = [
      [[2,11],[3,11],[2,12],[3,12]],   // red bottom-left
      [[2,2],[3,2],[2,3],[3,3]],        // blue top-left
      [[11,2],[12,2],[11,3],[12,3]],    // green top-right
      [[11,11],[12,11],[11,12],[12,12]],// pink bottom-right
    ];
    return bases[player][baseSlot];
  }
  if (pos <= 50) {
    const idx = (TRACK.startIdx[player] + pos) % LOOP_LEN;
    return TRACK.loop[idx];
  }
  // home column: pos 51..55 → homeCols[0..4]; 56 = center
  if (pos >= 51 && pos <= 55) return TRACK.homeCols[player][pos - 51];
  return [7,7]; // center / done
}

const gx = (c) => (c[0] + 0.5) * CELL;
const gy = (c) => (c[1] + 0.5) * CELL;

// ─── the board rendered in Skia — every path cell drawn, so the track is countable ───
// safe squares in standard Ludo: each player's entry (loop index = their startIdx),
// plus the star square 8 cells before their home entry (startIdx + 8 pattern).
const SAFE_LOOP_IDX = [0, 8, 13, 21, 26, 34, 39, 47]; // entries + stars around the loop

function Board({ tokens, players, highlight, onTapToken }) {
  return (
    <View>
      <Canvas style={{ width: BOARD, height: BOARD }}>
        <RoundedRect x={0} y={0} width={BOARD} height={BOARD} r={18} color="#150f1e">
          <Shadow dx={0} dy={8} blur={20} color="rgba(0,0,0,0.55)" />
        </RoundedRect>
        {/* four home corners (6x6 each) */}
        {[[0,9],[0,0],[9,0],[9,9]].map((corner, i) => (
          <Group key={i}>
            <RoundedRect x={corner[0]*CELL+4} y={corner[1]*CELL+4} width={6*CELL-8} height={6*CELL-8} r={12} color={COLORS[i]} opacity={0.9}>
              <Shadow dx={0} dy={3} blur={8} color="rgba(0,0,0,0.4)" inner />
            </RoundedRect>
            <RoundedRect x={corner[0]*CELL+1.4*CELL} y={corner[1]*CELL+1.4*CELL} width={3.2*CELL} height={3.2*CELL} r={10} color={DARK[i]} />
          </Group>
        ))}

        {/* EVERY loop cell drawn as a visible, countable square */}
        {TRACK.loop.map((c, idx) => {
          // is this an entry square for some player? color it that player's color
          const entryPlayer = TRACK.startIdx.indexOf(idx);
          const isEntry = entryPlayer !== -1;
          const isSafe = SAFE_LOOP_IDX.includes(idx);
          const fill = isEntry ? COLORS[entryPlayer] : '#2a2336';
          return (
            <Group key={`loop${idx}`}>
              <RoundedRect x={c[0]*CELL+2} y={c[1]*CELL+2} width={CELL-4} height={CELL-4} r={4}
                color={fill} opacity={isEntry ? 0.85 : 0.65}>
                <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.35)" />
              </RoundedRect>
              {/* safe-square star marker */}
              {isSafe && !isEntry && (
                <Circle cx={(c[0]+0.5)*CELL} cy={(c[1]+0.5)*CELL} r={CELL*0.16} color="rgba(255,255,255,0.35)" />
              )}
            </Group>
          );
        })}

        {/* colored home columns (each player's final stretch) */}
        {TRACK.homeCols.map((col, p) => col.map((c, i) => (
          <RoundedRect key={`${p}-${i}`} x={c[0]*CELL+2} y={c[1]*CELL+2} width={CELL-4} height={CELL-4} r={4} color={COLORS[p]} opacity={0.55}>
            <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.3)" />
          </RoundedRect>
        )))}

        {/* center home */}
        <Group transform={[{ translateX: BOARD/2 }, { translateY: BOARD/2 }, { rotate: Math.PI/4 }]}>
          <RoundedRect x={-1.6*CELL} y={-1.6*CELL} width={3.2*CELL} height={3.2*CELL} r={8} color="#241a30">
            <Shadow dx={0} dy={2} blur={6} color="rgba(0,0,0,0.5)" />
          </RoundedRect>
        </Group>

        {/* tokens — glossy discs with lift */}
        {tokens.map((t, i) => {
          if (!players[t.player]) return null;
          const c = tokenCell(t.player, t.pos, t.slot);
          const cx = gx(c), cy = gy(c);
          const isHi = highlight.includes(i);
          return (
            <Group key={i}>
              <Circle cx={cx} cy={cy + 2.5} r={CELL*0.34} color="rgba(0,0,0,0.45)" />
              <Circle cx={cx} cy={cy} r={CELL*0.34} color={COLORS[t.player]}>
                <Shadow dx={0} dy={1} blur={3} color="rgba(0,0,0,0.5)" />
              </Circle>
              <Circle cx={cx - CELL*0.1} cy={cy - CELL*0.11} r={CELL*0.12} color="rgba(255,255,255,0.6)" />
              {isHi && <Circle cx={cx} cy={cy} r={CELL*0.44} color="rgba(255,255,255,0.95)" style="stroke" strokeWidth={3} />}
            </Group>
          );
        })}
      </Canvas>
      {/* tap targets for highlighted (movable) tokens */}
      {highlight.map((ti) => {
        const t = tokens[ti];
        const c = tokenCell(t.player, t.pos, t.slot);
        return (
          <Pressable key={ti} onPress={() => onTapToken(ti)}
            style={{ position: 'absolute', left: gx(c) - CELL*0.5, top: gy(c) - CELL*0.5, width: CELL, height: CELL }} />
        );
      })}
    </View>
  );
}

function Seat({ player, name, pkey, tone, active, home }) {
  const [ok, setOk] = useState(true);
  const S = active ? 46 : 38;
  return (
    <View style={[styles.seat, active && styles.seatActive]}>
      <View style={{ width: S, height: S }}>
        {ok ? (
          <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)}
            style={{ width: S, height: S, borderRadius: S/2, borderWidth: 2, borderColor: tone }} />
        ) : (
          <View style={[styles.fallback, { width: S, height: S, borderRadius: S/2, borderColor: tone }]}>
            <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 16 }}>{name[0]}</Text>
          </View>
        )}
      </View>
      <Text style={styles.seatName} numberOfLines={1}>{name}</Text>
      <Text style={[styles.seatHome, { color: tone }]}>{home}/4</Text>
    </View>
  );
}

// die pips
function Die({ value, rolling }) {
  const [show, setShow] = useState(value);
  useEffect(() => {
    if (rolling) { const id = setInterval(() => setShow(1 + Math.floor(Math.random()*6)), 90); return () => clearInterval(id); }
    setShow(value);
  }, [rolling, value]);
  const v = rolling ? show : value;
  const pips = { 1:[[.5,.5]],2:[[.3,.3],[.7,.7]],3:[[.28,.28],[.5,.5],[.72,.72]],4:[[.3,.3],[.7,.3],[.3,.7],[.7,.7]],5:[[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]],6:[[.3,.28],[.7,.28],[.3,.5],[.7,.5],[.3,.72],[.7,.72]] }[v]||[[.5,.5]];
  const D = 56;
  return (
    <View style={[styles.die, rolling && { transform: [{ rotate: '8deg' }] }]}>
      {pips.map((p,i) => <View key={i} style={{ position:'absolute', left: p[0]*D-4, top: p[1]*D-4, width:8, height:8, borderRadius:4, backgroundColor:'#3a1505' }} />)}
    </View>
  );
}

export default function Ludo({ game, opponent, roster, onExit = () => {} }) {
  // roster: array of {key,name,tone,ai} for players 1..3 (you are player 0).
  // Fall back to single opponent if no roster passed.
  const seats = [{ key: 'the_stranger', name: 'you', tone: COLORS[0], ai: false, you: true }];
  const others = roster && roster.length
    ? roster
    : [opponent || { key: 'the_wannabe', name: 'the hustler', tone: COLORS[1] }];
  others.slice(0, 3).forEach((o, i) => seats.push({ key: o.key, name: o.name, tone: COLORS[i+1], ai: o.ai !== false }));
  const N = seats.length;
  const players = [true, N>1, N>2, N>3];

  // tokens: 4 per player, pos -1 (base). slot 0..3 within base.
  const initTokens = () => {
    const arr = [];
    for (let p = 0; p < 4; p++) for (let s = 0; s < 4; s++) arr.push({ player: p, pos: -1, slot: s });
    return arr;
  };
  const [tokens, setTokens] = useState(initTokens);
  const [turn, setTurn] = useState(0);          // whose turn (player index)
  const [die, setDie] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [phase, setPhase] = useState('roll');   // roll | move | over
  const [highlight, setHighlight] = useState([]);
  const [winner, setWinner] = useState(null);
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([{ who:'sys', text: `${seats.map(s=>s.name).join(', ')} — first to bring all four home wins.` }]);
  const feedRef = useRef(null);

  const sendChat = () => {
    const t = draft.trim(); if (!t) return;
    setDraft(''); pushFeed({ who:'you', text: t });
    // a present opponent fires back after a beat (pacing)
    const responders = seats.filter((s) => s.ai);
    if (responders.length) {
      const r = responders[Math.floor(Math.random()*responders.length)];
      const lines = ['"talk less. roll more."', '"cute. watch the board."', '"big words, small tokens."', '"mm-hm. still losing."'];
      setTimeout(() => pushFeed({ who:'opp', text: `${r.name}: ${lines[Math.floor(Math.random()*lines.length)]}` }), 800);
    }
  };

  const pushFeed = (l) => { setFeed(f => [...f, l]); setTimeout(() => feedRef.current?.scrollToEnd({ animated:true }), 60); };
  const homeCount = (p) => tokens.filter(t => t.player===p && t.pos>=56).length;

  // which tokens can legally move with this die value, for player p
  const movable = useCallback((p, d, toks) => {
    const idxs = [];
    toks.forEach((t, i) => {
      if (t.player !== p) return;
      if (t.pos >= 56) return;                    // already home
      if (t.pos < 0) { if (d === 6) idxs.push(i); return; } // need 6 to leave base
      if (t.pos + d <= 56) idxs.push(i);          // can't overshoot center
    });
    return idxs;
  }, []);

  const doRoll = (p) => {
    setRolling(true); setPhase('rolling');
    setTimeout(() => {
      const d = 1 + Math.floor(Math.random()*6);
      setDie(d); setRolling(false);
      pushFeed({ who:'sys', text: `${seats[p].name} rolled a ${d}.` });
      // read CURRENT tokens (avoid stale closure after rapid AI turns)
      setTokens((cur) => {
        const m = movable(p, d, cur);
        if (m.length === 0) {
          pushFeed({ who:'sys', text: `${seats[p].name} has no move.` });
          setTimeout(() => nextTurn(p, d, false), 800);
        } else if (seats[p].ai) {
          const beat = seats[p].key === 'the_brainiac' ? 1400 : seats[p].key === 'the_wannabe' ? 550 : 950;
          setTimeout(() => aiMove(p, d, m, cur), beat);
        } else {
          setHighlight(m); setPhase('move');
        }
        return cur; // no mutation here, just reading
      });
    }, 850);
  };

  // apply a move: token index ti advances by d, STEPPING one cell at a time.
  const applyMove = (ti, d, p) => {
    setHighlight([]);
    setPhase('animating');
    // determine start pos and the sequence of single-step positions
    setTokens((cur) => {
      const startPos = cur[ti].pos;
      const fromBase = startPos < 0;
      // if leaving base: single hop onto start cell (pos 0). else walk d cells.
      const steps = [];
      if (fromBase) {
        steps.push(0);
      } else {
        for (let s = 1; s <= d; s++) if (startPos + s <= 56) steps.push(startPos + s);
      }
      let i = 0;
      const hop = () => {
        if (i >= steps.length) {
          // landed — resolve capture + win at final cell
          setTokens((c2) => {
            const next = c2.map(t => ({ ...t }));
            const t = next[ti];
            if (t.pos >= 0 && t.pos <= 50) {
              const myCell = tokenCell(t.player, t.pos, t.slot).join(',');
              next.forEach((o) => {
                if (o.player !== t.player && o.pos >= 0 && o.pos <= 50) {
                  if (tokenCell(o.player, o.pos, o.slot).join(',') === myCell) {
                    o.pos = -1;
                    pushFeed({ who:'sys', text: `${seats[t.player].name} sent ${seats[o.player].name}'s token home!` });
                  }
                }
              });
            }
            const homeN = next.filter(x => x.player === p && x.pos >= 56).length;
            if (homeN >= 4) { setWinner(p); setPhase('over'); pushFeed({ who:'sys', text: `${seats[p].name} brought all four home — winner!` }); }
            else setTimeout(() => nextTurn(p, d, true), 200);
            return next;
          });
          return;
        }
        setTokens((c2) => { const n = c2.map(t => ({ ...t })); n[ti].pos = steps[i]; return n; });
        i++;
        setTimeout(hop, 190); // one cell every 190ms — the token WALKS the track
      };
      setTimeout(hop, 120);
      return cur; // unchanged; hop() drives it
    });
  };

  const homeCountAfter = (p, ti, d) => {
    let c = 0;
    tokens.forEach((t, i) => {
      if (t.player !== p) return;
      let pos = t.pos;
      if (i === ti) pos = t.pos < 0 ? 0 : t.pos + d;
      if (pos >= 56) c++;
    });
    return c;
  };

  const aiMove = (p, d, m, toks) => {
    const cur = toks || tokens;
    // simple strategy by character: brainiac/hustler advance furthest token; others random-ish
    let choice = m[0];
    const key = seats[p].key;
    if (key === 'the_brainiac' || key === 'the_wannabe') {
      choice = m.reduce((best, i) => (cur[i].pos > cur[best].pos ? i : best), m[0]);
    } else {
      choice = m[Math.floor(Math.random()*m.length)];
    }
    const react = d === 6 ? `"six! again."` : '';
    if (react) pushFeed({ who:'opp', text: `${seats[p].name}: ${react}` });
    applyMove(choice, d, p);
  };

  const nextTurn = (p, d, moved) => {
    // roll of 6 = same player rolls again
    if (d === 6 && phase !== 'over') { setPhase('roll'); setTurn(p); return; }
    const np = nextActive(p);
    setTurn(np); setPhase('roll'); setDie(0);
  };
  const nextActive = (p) => { let n = (p+1) % 4; while (!players[n]) n = (n+1) % 4; return n; };

  // AI auto-rolls on its turn (after a beat)
  useEffect(() => {
    if (phase === 'roll' && seats[turn]?.ai && !winner) {
      const beat = seats[turn].key === 'the_brainiac' ? 1200 : seats[turn].key === 'the_wannabe' ? 500 : 900;
      const t = setTimeout(() => doRoll(turn), beat);
      return () => clearTimeout(t);
    }
  }, [phase, turn, winner]);

  const onTapToken = (ti) => { if (phase === 'move') applyMove(ti, die, turn); };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0E12','#0E0912','#080509']} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex:1 }} edges={['top','bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Ludo'}</Text>
          <View style={{ width:26 }} />
        </View>

        <View style={styles.seatsRow}>
          {seats.map((s, i) => (
            <Seat key={i} player={i} name={s.name} pkey={s.key} tone={s.tone} active={turn===i && !winner} home={homeCount(i)} />
          ))}
        </View>

        <View style={styles.boardWrap}>
          <Board tokens={tokens} players={players} highlight={highlight} onTapToken={onTapToken} />
        </View>

        <View style={styles.controls}>
          <Die value={die} rolling={rolling} />
          {winner != null ? (
            <Text style={styles.winner}>{seats[winner].name} wins</Text>
          ) : phase === 'move' ? (
            <Text style={styles.prompt}>tap a highlighted token to move</Text>
          ) : (
            <Pressable
              style={[styles.rollBtn, (turn !== 0 || phase !== 'roll') && styles.rollOff]}
              onPress={() => turn === 0 && phase === 'roll' && doRoll(0)}
              disabled={turn !== 0 || phase !== 'roll'}
            >
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{x:0.3,y:0}} end={{x:1,y:1}} style={styles.rollInner}>
                <Text style={styles.rollText}>{turn === 0 ? (rolling ? 'rolling…' : 'roll') : `${seats[turn].name}'s turn`}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>

        <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{ paddingVertical:6 }} showsVerticalScrollIndicator={false}>
          {feed.map((f,i) => (
            <Text key={i} style={[styles.feedLine, f.who==='you'?styles.feedYou:f.who==='opp'?styles.feedOpp:styles.feedSys]}>
              {f.who==='you' ? `you: ${f.text}` : f.text}
            </Text>
          ))}
        </ScrollView>
        <TextInput
          value={draft} onChangeText={setDraft} onSubmitEditing={sendChat}
          placeholder="talk trash to the table…" placeholderTextColor={C.faint}
          style={styles.chatInput} returnKeyType="send"
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex:1, backgroundColor: C.void },
  topbar: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingVertical:6 },
  chev: { color: C.muted, fontSize:30, width:26, marginTop:-3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize:20 },

  seatsRow: { flexDirection:'row', alignItems:'flex-start', justifyContent:'center', gap:18, paddingVertical:6 },
  seat: { alignItems:'center', opacity:0.65, width:60 },
  seatActive: { opacity:1, transform:[{ translateY:-3 }] },
  fallback: { alignItems:'center', justifyContent:'center', borderWidth:2, backgroundColor:'rgba(255,255,255,0.05)' },
  seatName: { fontFamily: FONTS.body, color: C.muted, fontSize:11, marginTop:3 },
  seatHome: { fontFamily: FONTS.display, fontSize:13 },

  boardWrap: { alignItems:'center', marginTop:4 },
  controls: { alignItems:'center', marginTop:8, minHeight:96, justifyContent:'center', gap:8 },
  die: { width:56, height:56, borderRadius:14, backgroundColor:'#fff4ea' },
  rollBtn: { borderRadius:16, overflow:'hidden', width:200 },
  rollOff: { opacity:0.5 },
  rollInner: { paddingVertical:13, alignItems:'center' },
  rollText: { fontFamily: FONTS.semibold, color:'#3A1505', fontSize:15, letterSpacing:0.4 },
  prompt: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize:15 },
  winner: { fontFamily: FONTS.display, color: C.ember, fontSize:24 },

  feed: { maxHeight:96, marginTop:6, marginHorizontal:20 },
  feedLine: { fontFamily: FONTS.body, fontSize:13, lineHeight:19, marginVertical:1.5 },
  feedYou: { color: C.cream, textAlign:'right' },
  feedOpp: { fontFamily: FONTS.displayItalic, color: C.accentSoft },
  feedSys: { color: C.faint, textAlign:'center', fontSize:12, fontStyle:'italic' },
  chatInput: { fontFamily: FONTS.body, color: C.cream, fontSize:14, borderWidth:1, borderColor:'rgba(243,168,95,0.2)', borderRadius:14, paddingHorizontal:14, paddingVertical:9, backgroundColor:'rgba(255,255,255,0.03)', marginHorizontal:18, marginVertical:8 },
});
