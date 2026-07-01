// ════════════════════════════════════════════════════════════════════════
//  yourZ — HANGMAN (real game). A persona picks a word from a themed bank; you
//  guess letters; each wrong guess draws one more stroke of the gallows in Skia;
//  reveal the word before the figure completes. Real letter tracking, real
//  win/lose, the opponent reacting in character to your guesses.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, Path, Circle, Skia } from '@shopify/react-native-skia';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;
const { width: SCREEN_W } = Dimensions.get('window');

const WORDS = [
  { w: 'HORIZON', hint: 'where sky meets earth' },
  { w: 'GRAVITY', hint: 'it holds you down' },
  { w: 'WHISPER', hint: 'barely a sound' },
  { w: 'JOURNEY', hint: 'not the destination' },
  { w: 'ECLIPSE', hint: 'the light goes out' },
  { w: 'MIRACLE', hint: 'against the odds' },
  { w: 'VOYAGER', hint: 'far from home' },
  { w: 'TWILIGHT', hint: 'between day and night' },
  { w: 'CATALYST', hint: 'it starts the change' },
  { w: 'PARADOX', hint: 'true and false at once' },
];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const MAX_WRONG = 6;

// gallows drawn stroke by stroke — index 0..5 add head, body, arm, arm, leg, leg
function Gallows({ wrong }) {
  const H = 180, W = 160;
  const parts = [];
  // scaffold (always visible)
  const scaffold = Skia.Path.Make();
  scaffold.moveTo(20, H - 10); scaffold.lineTo(120, H - 10); // base
  scaffold.moveTo(50, H - 10); scaffold.lineTo(50, 20);       // post
  scaffold.lineTo(115, 20);                                    // beam
  scaffold.lineTo(115, 40);                                    // rope
  parts.push(<Path key="sc" path={scaffold} style="stroke" strokeWidth={4} color="rgba(243,168,95,0.5)" />);
  // body parts appear per wrong guess
  if (wrong >= 1) parts.push(<Circle key="head" cx={115} cy={54} r={14} style="stroke" strokeWidth={3.5} color="#F0708C" />);
  if (wrong >= 2) { const p=Skia.Path.Make(); p.moveTo(115,68); p.lineTo(115,110); parts.push(<Path key="body" path={p} style="stroke" strokeWidth={3.5} color="#F0708C" />); }
  if (wrong >= 3) { const p=Skia.Path.Make(); p.moveTo(115,78); p.lineTo(95,98); parts.push(<Path key="arm1" path={p} style="stroke" strokeWidth={3.5} color="#F0708C" />); }
  if (wrong >= 4) { const p=Skia.Path.Make(); p.moveTo(115,78); p.lineTo(135,98); parts.push(<Path key="arm2" path={p} style="stroke" strokeWidth={3.5} color="#F0708C" />); }
  if (wrong >= 5) { const p=Skia.Path.Make(); p.moveTo(115,110); p.lineTo(98,138); parts.push(<Path key="leg1" path={p} style="stroke" strokeWidth={3.5} color="#F0708C" />); }
  if (wrong >= 6) { const p=Skia.Path.Make(); p.moveTo(115,110); p.lineTo(132,138); parts.push(<Path key="leg2" path={p} style="stroke" strokeWidth={3.5} color="#F0708C" />); }
  return <Canvas style={{ width: W, height: H }}>{parts}</Canvas>;
}

export default function Hangman({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765' };
  const [target, setTarget] = useState(() => WORDS[Math.floor(Math.random()*WORDS.length)]);
  const [guessed, setGuessed] = useState([]);
  const [wrong, setWrong] = useState(0);
  const [status, setStatus] = useState('play'); // play | won | lost
  const [feed, setFeed] = useState([]);
  const [okFace, setOkFace] = useState(true);
  const feedRef = useRef(null);
  const pushFeed = (l) => { setFeed(f=>[...f,l]); setTimeout(()=>feedRef.current?.scrollToEnd({animated:true}),60); };

  useEffect(() => { pushFeed({ who:'opp', text:`${opp.name}: "i've got a word. seven, no — figure it out. hint: ${target.hint}."` }); }, []);

  const word = target.w;
  const revealed = word.split('').every((c) => guessed.includes(c));

  useEffect(() => {
    if (status !== 'play') return;
    if (revealed) { setStatus('won'); pushFeed({ who:'opp', text:`${opp.name}: "...fine. you got it. ${word}."` }); }
    else if (wrong >= MAX_WRONG) { setStatus('lost'); pushFeed({ who:'opp', text:`${opp.name}: "gallows wins. it was ${word}."` }); }
  }, [guessed, wrong]);

  const guess = (letter) => {
    if (status !== 'play' || guessed.includes(letter)) return;
    const ng = [...guessed, letter];
    setGuessed(ng);
    if (word.includes(letter)) {
      const remaining = word.split('').filter((c) => !ng.includes(c)).length;
      pushFeed({ who:'sys', text:`${letter} — yes.` });
      if (remaining > 0 && remaining <= 2) setTimeout(()=>pushFeed({ who:'opp', text:`${opp.name}: "close. don't get cocky."` }), 400);
    } else {
      setWrong((w) => w + 1);
      pushFeed({ who:'sys', text:`${letter} — no. (${wrong+1}/${MAX_WRONG})` });
    }
  };

  const newGame = () => {
    setTarget(WORDS[Math.floor(Math.random()*WORDS.length)]);
    setGuessed([]); setWrong(0); setStatus('play');
    setFeed([]); setTimeout(()=>pushFeed({ who:'opp', text:`${opp.name}: "new word. good luck."` }), 200);
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#1A0E12','#0E0912','#080509']} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex:1 }} edges={['top','bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Hangman'}</Text>
          <View style={{ width:26 }} />
        </View>

        <View style={styles.opRow}>
          {okFace ? (
            <Image source={{ uri: faceFor(opp.key) }} onError={()=>setOkFace(false)}
              style={{ width:52, height:52, borderRadius:26, borderWidth:2, borderColor:opp.tone }} />
          ) : (
            <View style={[styles.fallback,{ borderColor:opp.tone }]}><Text style={{color:opp.tone,fontFamily:FONTS.display,fontSize:20}}>{opp.name[0]}</Text></View>
          )}
          <Text style={styles.opName}>{opp.name} · your challenger</Text>
        </View>

        <View style={styles.gallowsWrap}><Gallows wrong={wrong} /></View>

        {/* the word slots */}
        <View style={styles.wordRow}>
          {word.split('').map((c, i) => (
            <View key={i} style={styles.slot}>
              <Text style={styles.slotLetter}>{guessed.includes(c) || status==='lost' ? c : ''}</Text>
              <View style={[styles.slotLine, status==='lost' && !guessed.includes(c) && { backgroundColor:'#F0708C' }]} />
            </View>
          ))}
        </View>
        <Text style={styles.hint}>hint · {target.hint}</Text>

        {status === 'play' ? (
          <View style={styles.keyboard}>
            {ALPHABET.map((l) => {
              const used = guessed.includes(l);
              const hit = used && word.includes(l);
              return (
                <Pressable key={l} disabled={used} onPress={() => guess(l)}
                  style={[styles.key, used && (hit ? styles.keyHit : styles.keyMiss)]}>
                  <Text style={[styles.keyText, used && { color:'#3A1505' }]}>{l}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.endRow}>
            <Text style={[styles.endText, status==='won' ? { color:'#8FD98F' } : { color:'#F0708C' }]}>
              {status==='won' ? 'you cracked it' : `it was ${word}`}
            </Text>
            <Pressable style={styles.againBtn} onPress={newGame}>
              <LinearGradient colors={[C.ember,C.emberDeep]} start={{x:0.3,y:0}} end={{x:1,y:1}} style={styles.againInner}>
                <Text style={styles.againText}>new word</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}

        <ScrollView ref={feedRef} style={styles.feed} contentContainerStyle={{paddingVertical:6}} showsVerticalScrollIndicator={false}>
          {feed.map((f,i)=>(<Text key={i} style={[styles.feedLine,f.who==='opp'?styles.feedOpp:styles.feedSys]}>{f.text}</Text>))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.void},
  topbar:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingVertical:6},
  chev:{color:C.muted,fontSize:30,width:26,marginTop:-3},
  title:{fontFamily:FONTS.display,color:C.cream,fontSize:20},
  opRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:4},
  fallback:{width:52,height:52,borderRadius:26,alignItems:'center',justifyContent:'center',borderWidth:2,backgroundColor:'rgba(255,255,255,0.05)'},
  opName:{fontFamily:FONTS.displayItalic,color:C.muted,fontSize:14},
  gallowsWrap:{alignItems:'center',marginTop:4},
  wordRow:{flexDirection:'row',justifyContent:'center',flexWrap:'wrap',gap:8,marginTop:8,paddingHorizontal:16},
  slot:{alignItems:'center',width:26},
  slotLetter:{fontFamily:FONTS.display,color:C.cream,fontSize:24,height:30},
  slotLine:{width:22,height:2.5,backgroundColor:'rgba(243,168,95,0.5)',marginTop:-2},
  hint:{fontFamily:FONTS.displayItalic,color:C.faint,fontSize:13,textAlign:'center',marginTop:8},
  keyboard:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6,paddingHorizontal:16,marginTop:12},
  key:{width:30,height:38,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(255,255,255,0.06)',borderWidth:1,borderColor:'rgba(255,255,255,0.08)'},
  keyHit:{backgroundColor:'#8FD98F',borderColor:'#8FD98F'},
  keyMiss:{backgroundColor:'rgba(240,112,140,0.3)',borderColor:'rgba(240,112,140,0.5)'},
  keyText:{fontFamily:FONTS.semibold,color:C.cream,fontSize:15},
  endRow:{alignItems:'center',marginTop:16,gap:12},
  endText:{fontFamily:FONTS.display,fontSize:22},
  againBtn:{borderRadius:15,overflow:'hidden',width:160},
  againInner:{paddingVertical:13,alignItems:'center'},
  againText:{fontFamily:FONTS.semibold,color:'#3A1505',fontSize:15},
  feed:{flex:1,marginTop:10,marginHorizontal:20},
  feedLine:{fontFamily:FONTS.body,fontSize:13,lineHeight:19,marginVertical:1.5},
  feedOpp:{fontFamily:FONTS.displayItalic,color:C.accentSoft},
  feedSys:{color:C.faint,textAlign:'center',fontSize:12,fontStyle:'italic'},
});
