// ════════════════════════════════════════════════════════════════════════
//  yourZ — TRIVIA DUEL (real game, NOT the debate reskin). Real question bank,
//  multiple choice, you and the opponent both answer each question, real scoring,
//  first to a target score wins. The opponent answers in character (the brainiac
//  is usually right; the hustler rushes and sometimes wrong), with a beat.
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

const BANK = [
  { q: 'Which planet has the most moons?', a: ['Jupiter','Saturn','Neptune','Mars'], c: 1 },
  { q: 'What year did the first human walk on the Moon?', a: ['1965','1969','1972','1961'], c: 1 },
  { q: 'The Great Barrier Reef is off the coast of which country?', a: ['Brazil','Indonesia','Australia','Kenya'], c: 2 },
  { q: 'Who painted the Mona Lisa?', a: ['Michelangelo','Raphael','Da Vinci','Donatello'], c: 2 },
  { q: 'What is the smallest prime number?', a: ['0','1','2','3'], c: 2 },
  { q: 'Which element has the symbol "Fe"?', a: ['Iron','Fluorine','Lead','Tin'], c: 0 },
  { q: 'The Berlin Wall fell in which year?', a: ['1987','1989','1991','1985'], c: 1 },
  { q: 'How many strings does a standard violin have?', a: ['4','5','6','7'], c: 0 },
  { q: 'What is the largest ocean?', a: ['Atlantic','Indian','Arctic','Pacific'], c: 3 },
  { q: 'Which country invented tea?', a: ['India','China','Japan','England'], c: 1 },
  { q: 'What gas do plants primarily absorb?', a: ['Oxygen','Nitrogen','Carbon dioxide','Hydrogen'], c: 2 },
  { q: 'Mount Everest lies on the border of Nepal and which country?', a: ['India','China','Bhutan','Pakistan'], c: 1 },
];

const TARGET = 5;

export default function Trivia({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_brainiac', name: 'the brainiac', tone: '#6FC9E0', style: 'sharp' };
  const [deck] = useState(() => [...BANK].sort(() => Math.random() - 0.5));
  const [qi, setQi] = useState(0);
  const [youScore, setYouScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [picked, setPicked] = useState(null);   // your chosen index
  const [oppPicked, setOppPicked] = useState(null);
  const [phase, setPhase] = useState('answer'); // answer | reveal | over
  const [okFace, setOkFace] = useState(true);
  const [feed, setFeed] = useState([{ who:'sys', text:'first to 5. answer fast, answer right.' }]);
  const feedRef = useRef(null);
  const pushFeed = (l) => { setFeed(f=>[...f,l]); setTimeout(()=>feedRef.current?.scrollToEnd({animated:true}),60); };

  const Q = deck[qi % deck.length];

  // opponent answers after a beat, in character
  const oppAnswer = () => {
    const key = opp.key;
    // accuracy by character
    const acc = key === 'the_brainiac' ? 0.85 : key === 'the_philosopher' ? 0.7 : key === 'the_wannabe' ? 0.45 : 0.6;
    const correct = Math.random() < acc;
    let choice;
    if (correct) choice = Q.c;
    else { const wrong = [0,1,2,3].filter(i => i !== Q.c); choice = wrong[Math.floor(Math.random()*wrong.length)]; }
    setOppPicked(choice);
    return choice;
  };

  const answer = (idx) => {
    if (phase !== 'answer' || picked != null) return;
    setPicked(idx);
    const beat = opp.key === 'the_wannabe' ? 500 : opp.key === 'the_brainiac' ? 1300 : 900;
    setTimeout(() => {
      const oc = oppAnswer();
      const youRight = idx === Q.c;
      const oppRight = oc === Q.c;
      if (youRight) setYouScore(s => s + 1);
      if (oppRight) setOppScore(s => s + 1);
      pushFeed({ who:'sys', text: `answer: ${Q.a[Q.c]}. ${youRight?'you +1':'you missed'}. ${opp.name} ${oppRight?'+1':'missed'}.` });
      if (!youRight && oppRight) setTimeout(()=>pushFeed({ who:'opp', text:`${opp.name}: "keep up."` }), 300);
      if (youRight && !oppRight) setTimeout(()=>pushFeed({ who:'opp', text:`${opp.name}: "lucky guess."` }), 300);
      setPhase('reveal');
    }, beat);
  };

  const next = () => {
    const ys = youScore, os = oppScore;
    if (ys >= TARGET || os >= TARGET) { setPhase('over'); return; }
    setPicked(null); setOppPicked(null); setPhase('answer'); setQi(q => q + 1);
  };

  useEffect(() => {
    if (phase === 'reveal' && (youScore >= TARGET || oppScore >= TARGET)) setPhase('over');
  }, [phase, youScore, oppScore]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#101620','#0E0912','#080509']} locations={[0,0.5,1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex:1 }} edges={['top','bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Trivia Duel'}</Text>
          <View style={{ width:26 }} />
        </View>

        {/* scoreboard */}
        <View style={styles.scoreRow}>
          <View style={styles.scoreSide}>
            <Text style={styles.scoreName}>you</Text>
            <Text style={[styles.scoreNum,{color:C.ember}]}>{youScore}</Text>
          </View>
          <Text style={styles.scoreVs}>first to {TARGET}</Text>
          <View style={styles.scoreSide}>
            {okFace ? (
              <Image source={{ uri: faceFor(opp.key) }} onError={()=>setOkFace(false)} style={{width:36,height:36,borderRadius:18,borderWidth:2,borderColor:opp.tone}} />
            ) : <Text style={styles.scoreName}>{opp.name}</Text>}
            <Text style={[styles.scoreNum,{color:opp.tone}]}>{oppScore}</Text>
          </View>
        </View>

        {phase === 'over' ? (
          <View style={styles.overWrap}>
            <Text style={styles.overTitle}>{youScore > oppScore ? 'you win' : 'the ' + opp.name.replace('the ','') + ' wins'}</Text>
            <Text style={styles.overScore}>{youScore} – {oppScore}</Text>
            <Pressable style={styles.againBtn} onPress={() => { setYouScore(0); setOppScore(0); setQi(q=>q+1); setPicked(null); setOppPicked(null); setPhase('answer'); }}>
              <LinearGradient colors={[C.ember,C.emberDeep]} start={{x:0.3,y:0}} end={{x:1,y:1}} style={styles.againInner}>
                <Text style={styles.againText}>rematch</Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.qCard}>
              <Text style={styles.qNum}>question {qi + 1}</Text>
              <Text style={styles.qText}>{Q.q}</Text>
            </View>
            <View style={styles.options}>
              {Q.a.map((opt, i) => {
                const isCorrect = phase === 'reveal' && i === Q.c;
                const youWrong = phase === 'reveal' && picked === i && i !== Q.c;
                const oppChose = phase === 'reveal' && oppPicked === i;
                return (
                  <Pressable key={i} disabled={phase !== 'answer' || picked != null}
                    style={[styles.opt, picked===i && styles.optPicked, isCorrect && styles.optCorrect, youWrong && styles.optWrong]}
                    onPress={() => answer(i)}>
                    <Text style={[styles.optText, (isCorrect||youWrong) && { color:'#0E0912' }]}>{opt}</Text>
                    {oppChose && <Text style={styles.oppTag}>{opp.name} ›</Text>}
                  </Pressable>
                );
              })}
            </View>
            {phase === 'reveal' && (
              <Pressable style={styles.nextBtn} onPress={next}>
                <LinearGradient colors={[C.ember,C.emberDeep]} start={{x:0.3,y:0}} end={{x:1,y:1}} style={styles.nextInner}>
                  <Text style={styles.nextText}>next ›</Text>
                </LinearGradient>
              </Pressable>
            )}
            {phase === 'answer' && picked != null && (
              <Text style={styles.waiting}>{opp.name} is answering…</Text>
            )}
          </>
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
  scoreRow:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:28,paddingVertical:10},
  scoreSide:{alignItems:'center',gap:2},
  scoreName:{fontFamily:FONTS.body,color:C.muted,fontSize:13},
  scoreNum:{fontFamily:FONTS.display,fontSize:30},
  scoreVs:{fontFamily:FONTS.displayItalic,color:C.faint,fontSize:13},
  qCard:{marginHorizontal:20,marginTop:8,padding:18,borderRadius:16,borderWidth:1,borderColor:'rgba(243,168,95,0.18)',backgroundColor:'rgba(243,168,95,0.05)'},
  qNum:{fontFamily:FONTS.body,color:C.faint,fontSize:11,letterSpacing:1.5,textTransform:'uppercase'},
  qText:{fontFamily:FONTS.display,color:C.cream,fontSize:20,lineHeight:27,marginTop:6},
  options:{paddingHorizontal:20,marginTop:14,gap:10},
  opt:{paddingVertical:15,paddingHorizontal:18,borderRadius:14,borderWidth:1,borderColor:'rgba(255,255,255,0.1)',backgroundColor:'rgba(255,255,255,0.03)',flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  optPicked:{borderColor:C.ember},
  optCorrect:{backgroundColor:'#8FD98F',borderColor:'#8FD98F'},
  optWrong:{backgroundColor:'rgba(240,112,140,0.9)',borderColor:'#F0708C'},
  optText:{fontFamily:FONTS.body,color:C.cream,fontSize:16},
  oppTag:{fontFamily:FONTS.displayItalic,color:'#0E0912',fontSize:12},
  nextBtn:{alignSelf:'center',marginTop:16,borderRadius:15,overflow:'hidden',width:160},
  nextInner:{paddingVertical:13,alignItems:'center'},
  nextText:{fontFamily:FONTS.semibold,color:'#3A1505',fontSize:15},
  waiting:{fontFamily:FONTS.displayItalic,color:C.accentSoft,fontSize:14,textAlign:'center',marginTop:14},
  overWrap:{alignItems:'center',marginTop:40,gap:10},
  overTitle:{fontFamily:FONTS.display,color:C.ember,fontSize:30},
  overScore:{fontFamily:FONTS.display,color:C.cream,fontSize:22},
  againBtn:{borderRadius:15,overflow:'hidden',width:160,marginTop:10},
  againInner:{paddingVertical:13,alignItems:'center'},
  againText:{fontFamily:FONTS.semibold,color:'#3A1505',fontSize:15},
  feed:{maxHeight:90,marginTop:10,marginHorizontal:20},
  feedLine:{fontFamily:FONTS.body,fontSize:13,lineHeight:19,marginVertical:1.5},
  feedOpp:{fontFamily:FONTS.displayItalic,color:C.accentSoft},
  feedSys:{color:C.faint,textAlign:'center',fontSize:12,fontStyle:'italic'},
});
