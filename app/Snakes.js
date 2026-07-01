// ════════════════════════════════════════════════════════════════════════
//  yourZ — SNAKES & LADDERS (real game). 1–4 players, a true 10×10 boustrophedon
//  board (1→100), real snakes + ladders that move you, roll to move, land on a
//  snake head slide down, land on a ladder foot climb up, first to exactly 100
//  wins (overshoot bounces back). Rendered on Skia with depth. Pacing honored:
//  die tumbles, each player takes a character beat, one move at a time, banter.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, TextInput, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, RoundedRect, Circle, Group, Shadow, Path, Skia, vec } from '@shopify/react-native-skia';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');
const BOARD = Math.min(SCREEN_W - 32, 360);
const CELL = BOARD / 10;
const COLORS = ['#F0A765', '#6FC9E0', '#8FD98F', '#F0708C'];

// real snakes (head→tail, down) and ladders (bottom→top, up)
const SNAKES = { 99: 41, 95: 75, 92: 88, 89: 68, 74: 53, 64: 60, 62: 19, 49: 11, 46: 25, 16: 6 };
const LADDERS = { 2: 38, 7: 14, 8: 31, 15: 26, 21: 42, 28: 84, 36: 44, 51: 67, 71: 91, 78: 98, 87: 94 };

// cell number (1..100) → grid [col,row] with boustrophedon (snake) layout, row 0 at bottom
function cellToXY(n) {
  const idx = n - 1;
  const row = Math.floor(idx / 10);       // 0 at bottom
  let col = idx % 10;
  if (row % 2 === 1) col = 9 - col;        // alternate direction
  const gridRow = 9 - row;                  // flip so 1 is bottom-left
  return { x: col * CELL + CELL / 2, y: gridRow * CELL + CELL / 2 };
}

function Board({ positions, players }) {
  // build snake + ladder line paths once
  return (
    <Canvas style={{ width: BOARD, height: BOARD }}>
      <RoundedRect x={0} y={0} width={BOARD} height={BOARD} r={16} color="#141021">
        <Shadow dx={0} dy={8} blur={18} color="rgba(0,0,0,0.5)" />
      </RoundedRect>
      {/* 100 cells, checker-tinted, numbered feel via alternating fill */}
      {Array.from({ length: 100 }, (_, i) => {
        const n = i + 1;
        const { x, y } = cellToXY(n);
        const isLadder = LADDERS[n] != null;
        const isSnakeHead = SNAKES[n] != null;
        const fill = n === 100 ? '#F3A85F' : isLadder ? 'rgba(143,217,143,0.22)' : isSnakeHead ? 'rgba(240,112,140,0.22)' : ((Math.floor((n-1)/10) + (n-1)) % 2 === 0 ? '#221b30' : '#1b1526');
        return (
          <RoundedRect key={n} x={x - CELL/2 + 1.5} y={y - CELL/2 + 1.5} width={CELL - 3} height={CELL - 3} r={5} color={fill} opacity={0.92} />
        );
      })}
      {/* ladders — two rails */}
      {Object.entries(LADDERS).map(([from, to]) => {
        const a = cellToXY(+from), b = cellToXY(+to);
        const p = Skia.Path.Make(); p.moveTo(a.x - 5, a.y); p.lineTo(b.x - 5, b.y);
        p.moveTo(a.x + 5, a.y); p.lineTo(b.x + 5, b.y);
        return <Path key={`L${from}`} path={p} style="stroke" strokeWidth={2.5} color="rgba(143,217,143,0.7)" />;
      })}
      {/* snakes — curved down */}
      {Object.entries(SNAKES).map(([from, to]) => {
        const a = cellToXY(+from), b = cellToXY(+to);
        const p = Skia.Path.Make(); p.moveTo(a.x, a.y);
        p.cubicTo(a.x + 24, (a.y + b.y) / 2, b.x - 24, (a.y + b.y) / 2, b.x, b.y);
        return <Path key={`S${from}`} path={p} style="stroke" strokeWidth={3.5} color="rgba(240,112,140,0.7)" />;
      })}
      {/* tokens */}
      {positions.map((pos, p) => {
        if (!players[p] || pos < 1) return null;
        const { x, y } = cellToXY(pos);
        const off = (p - 1.5) * (CELL * 0.18);
        return (
          <Group key={p}>
            <Circle cx={x + off} cy={y + 2} r={CELL * 0.22} color="rgba(0,0,0,0.4)" />
            <Circle cx={x + off} cy={y} r={CELL * 0.22} color={COLORS[p]}>
              <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.5)" />
            </Circle>
            <Circle cx={x + off - CELL*0.06} cy={y - CELL*0.07} r={CELL*0.08} color="rgba(255,255,255,0.6)" />
          </Group>
        );
      })}
    </Canvas>
  );
}

function Seat({ name, pkey, tone, active, pos }) {
  const [ok, setOk] = useState(true);
  const S = active ? 46 : 38;
  return (
    <View style={[styles.seat, active && styles.seatActive]}>
      {ok ? (
        <Image source={{ uri: faceFor(pkey) }} onError={() => setOk(false)}
          style={{ width: S, height: S, borderRadius: S/2, borderWidth: 2, borderColor: tone }} />
      ) : (
        <View style={[styles.fallback, { width: S, height: S, borderRadius: S/2, borderColor: tone }]}>
          <Text style={{ color: tone, fontFamily: FONTS.display, fontSize: 16 }}>{name[0]}</Text>
        </View>
      )}
      <Text style={styles.seatName} numberOfLines={1}>{name}</Text>
      <Text style={[styles.seatPos, { color: tone }]}>{pos}</Text>
    </View>
  );
}

function Die({ value, rolling }) {
  const [show, setShow] = useState(value);
  useEffect(() => {
    if (rolling) { const id = setInterval(() => setShow(1 + Math.floor(Math.random()*6)), 90); return () => clearInterval(id); }
    setShow(value);
  }, [rolling, value]);
  const v = rolling ? show : value;
  const pips = { 1:[[.5,.5]],2:[[.3,.3],[.7,.7]],3:[[.28,.28],[.5,.5],[.72,.72]],4:[[.3,.3],[.7,.3],[.3,.7],[.7,.7]],5:[[.3,.3],[.7,.3],[.5,.5],[.3,.7],[.7,.7]],6:[[.3,.28],[.7,.28],[.3,.5],[.7,.5],[.3,.72],[.7,.72]] }[v]||[[.5,.5]];
  const D = 52;
  return (
    <View style={styles.die}>
      {pips.map((p,i) => <View key={i} style={{ position:'absolute', left:p[0]*D-4, top:p[1]*D-4, width:8, height:8, borderRadius:4, backgroundColor:'#3a1505' }} />)}
    </View>
  );
}

export default function Snakes({ game, opponent, roster, onExit = () => {} }) {
  const seats = [{ key: 'the_stranger', name: 'you', tone: COLORS[0], ai: false }];
  const others = roster && roster.length ? roster : [opponent || { key: 'the_wannabe', name: 'the hustler', tone: COLORS[1] }];
  others.slice(0,3).forEach((o,i) => seats.push({ key:o.key, name:o.name, tone:COLORS[i+1], ai:o.ai!==false }));
  const N = seats.length;
  const players = [true, N>1, N>2, N>3];

  const [positions, setPositions] = useState([0,0,0,0]);
  const [turn, setTurn] = useState(0);
  const [die, setDie] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState(null);
  const [draft, setDraft] = useState('');
  const [feed, setFeed] = useState([{ who:'sys', text:`${seats.map(s=>s.name).join(', ')} — first to exactly 100 wins.` }]);
  const feedRef = useRef(null);
  const pushFeed = (l) => { setFeed(f=>[...f,l]); setTimeout(()=>feedRef.current?.scrollToEnd({animated:true}),60); };

  const nextActive = (p) => { let n=(p+1)%4; while(!players[n]) n=(n+1)%4; return n; };

  const doRoll = (p) => {
    setRolling(true); setBusy(true);
    setTimeout(() => {
      const d = 1 + Math.floor(Math.random()*6);
      setDie(d); setRolling(false);
      pushFeed({ who:'sys', text:`${seats[p].name} rolled a ${d}.` });

      // figure the start and how many single steps to walk (with bounce at 100)
      setPositions((cur) => {
        const start = cur[p];
        let target = start + d;
        let bounce = false;
        if (target > 100) { target = 100 - (target - 100); bounce = true; }
        // walk one cell at a time from start → target
        let step = start;
        const dir = target >= start ? 1 : -1;         // bounce walks backward from 100
        const walkTo100 = Math.min(start + d, 100);
        // We animate: first climb up to min(start+d,100), then (if bounce) step back down.
        const sequence = [];
        for (let s = start + 1; s <= walkTo100; s++) sequence.push(s);
        if (bounce) for (let s = 99; s >= target; s--) sequence.push(s);

        let i = 0;
        const hop = () => {
          if (i >= sequence.length) {
            // landed — resolve snake/ladder
            setPositions((c2) => {
              const a2 = [...c2];
              const landed = a2[p];
              if (LADDERS[landed]) { pushFeed({ who:'sys', text:`${seats[p].name} climbs a ladder to ${LADDERS[landed]}!` }); slideTo(p, landed, LADDERS[landed], d); return a2; }
              if (SNAKES[landed]) { pushFeed({ who:'sys', text:`a snake! ${seats[p].name} slides to ${SNAKES[landed]}.` }); slideTo(p, landed, SNAKES[landed], d); return a2; }
              if (landed === 100) { setWinner(p); pushFeed({ who:'sys', text:`${seats[p].name} reached 100 — winner!` }); }
              else setTimeout(() => { const nx = d===6 ? p : nextActive(p); setTurn(nx); setBusy(false); }, 600);
              return a2;
            });
            return;
          }
          setPositions((c2) => { const a2 = [...c2]; a2[p] = sequence[i]; return a2; });
          i++;
          setTimeout(hop, 180); // one box every 180ms — you SEE it travel
        };
        if (bounce) setTimeout(() => pushFeed({ who:'sys', text:`${seats[p].name} overshoots — bounces back.` }), sequence.length * 180 * 0.6);
        setTimeout(hop, 200);
        return cur; // start unchanged; hop() drives the walk
      });
    }, 800);
  };

  // slide down a snake / up a ladder as a quick glide (a few interpolated steps)
  const slideTo = (p, from, to, d) => {
    const dir = to > from ? 1 : -1;
    const cells = [];
    for (let s = from + dir; dir > 0 ? s <= to : s >= to; s += dir) cells.push(s);
    let i = 0;
    const glide = () => {
      if (i >= cells.length) {
        if (to === 100) { setWinner(p); pushFeed({ who:'sys', text:`${seats[p].name} reached 100 — winner!` }); return; }
        setTimeout(() => { const nx = d===6 ? p : nextActive(p); setTurn(nx); setBusy(false); }, 500);
        return;
      }
      setPositions((c2) => { const a2 = [...c2]; a2[p] = cells[i]; return a2; });
      i++; setTimeout(glide, 90); // snakes/ladders glide a bit faster than walking
    };
    setTimeout(glide, 250);
  };

  useEffect(() => {
    if (!busy && seats[turn]?.ai && winner==null) {
      const beat = seats[turn].key==='the_brainiac'?1200:seats[turn].key==='the_wannabe'?500:900;
      const t = setTimeout(() => doRoll(turn), beat);
      return () => clearTimeout(t);
    }
  }, [turn, busy, winner]);

  const sendChat = () => {
    const t = draft.trim(); if(!t) return;
    setDraft(''); pushFeed({ who:'you', text:t });
    const ai = seats.filter(s=>s.ai);
    if (ai.length) { const r = ai[Math.floor(Math.random()*ai.length)];
      const lines=['"climb all you want. i see a snake ahead."','"cute. roll."','"luck runs out, friend."'];
      setTimeout(()=>pushFeed({who:'opp',text:`${r.name}: ${lines[Math.floor(Math.random()*lines.length)]}`}),750); }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#141a12','#0E0912','#080509']} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex:1 }} edges={['top','bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Snakes & Ladders'}</Text>
          <View style={{ width:26 }} />
        </View>
        <View style={styles.seatsRow}>
          {seats.map((s,i)=>(<Seat key={i} name={s.name} pkey={s.key} tone={s.tone} active={turn===i&&winner==null} pos={positions[i]} />))}
        </View>
        <View style={styles.boardWrap}><Board positions={positions} players={players} /></View>
        <View style={styles.controls}>
          <Die value={die} rolling={rolling} />
          {winner!=null ? (
            <Text style={styles.winner}>{seats[winner].name} wins</Text>
          ) : (
            <Pressable style={[styles.rollBtn,(turn!==0||busy)&&styles.rollOff]}
              onPress={()=>turn===0&&!busy&&doRoll(0)} disabled={turn!==0||busy}>
              <LinearGradient colors={[C.ember,C.emberDeep]} start={{x:0.3,y:0}} end={{x:1,y:1}} style={styles.rollInner}>
                <Text style={styles.rollText}>{turn===0?(rolling?'rolling…':'roll'):`${seats[turn].name}'s turn`}</Text>
              </LinearGradient>
            </Pressable>
          )}
        </View>
        <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{paddingVertical:6}} showsVerticalScrollIndicator={false}>
          {feed.map((f,i)=>(<Text key={i} style={[styles.feedLine,f.who==='you'?styles.feedYou:f.who==='opp'?styles.feedOpp:styles.feedSys]}>{f.who==='you'?`you: ${f.text}`:f.text}</Text>))}
        </ScrollView>
        <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={sendChat}
          placeholder="talk trash to the table…" placeholderTextColor={C.faint} style={styles.chatInput} returnKeyType="send" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.void},
  topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:6},
  chev:{color:C.muted,fontSize:30,width:26,marginTop:-3},
  title:{fontFamily:FONTS.display,color:C.cream,fontSize:20},
  seatsRow:{flexDirection:'row',alignItems:'flex-start',justifyContent:'center',gap:18,paddingVertical:6},
  seat:{alignItems:'center',opacity:0.65,width:56},
  seatActive:{opacity:1,transform:[{translateY:-3}]},
  fallback:{alignItems:'center',justifyContent:'center',borderWidth:2,backgroundColor:'rgba(255,255,255,0.05)'},
  seatName:{fontFamily:FONTS.body,color:C.muted,fontSize:11,marginTop:3},
  seatPos:{fontFamily:FONTS.display,fontSize:14},
  boardWrap:{alignItems:'center',marginTop:4},
  controls:{alignItems:'center',marginTop:8,gap:8,minHeight:80,justifyContent:'center'},
  die:{width:52,height:52,borderRadius:12,backgroundColor:'#fff4ea'},
  rollBtn:{borderRadius:16,overflow:'hidden',width:200},
  rollOff:{opacity:0.5},
  rollInner:{paddingVertical:13,alignItems:'center'},
  rollText:{fontFamily:FONTS.semibold,color:'#3A1505',fontSize:15,letterSpacing:0.4},
  winner:{fontFamily:FONTS.display,color:C.ember,fontSize:24},
  feed:{maxHeight:80,marginTop:4,marginHorizontal:20},
  feedLine:{fontFamily:FONTS.body,fontSize:13,lineHeight:19,marginVertical:1.5},
  feedYou:{color:C.cream,textAlign:'right'},
  feedOpp:{fontFamily:FONTS.displayItalic,color:C.accentSoft},
  feedSys:{color:C.faint,textAlign:'center',fontSize:12,fontStyle:'italic'},
  chatInput:{fontFamily:FONTS.body,color:C.cream,fontSize:14,borderWidth:1,borderColor:'rgba(243,168,95,0.2)',borderRadius:14,paddingHorizontal:14,paddingVertical:9,backgroundColor:'rgba(255,255,255,0.03)',marginHorizontal:18,marginVertical:8},
});
