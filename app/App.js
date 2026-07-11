// ════════════════════════════════════════════════════════════════════════
//  yourZ — app entry. Mounts the navigation spine (Nav) and feeds it the
//  built worlds. Unbuilt worlds fall back to a "coming alive" stub.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useBackLayer } from './backbus';
import { Share, Alert, Text } from 'react-native';
import { createRoom, inviteToRoom, startGameSession, startBattlefieldPractice } from './api';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import DebateDuelLive from './games/debate/DuelLive';
import TriviaDuelLive from './games/trivia/DuelLive';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { CormorantGaramond_300Light, CormorantGaramond_400Regular_Italic, CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond';
import { JetBrainsMono_300Light, JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';

import Nav, { WorldStub } from './Nav';
import Roster from './Roster';
import { initRoster } from './roster';
import CreatePersona from './CreatePersona';
import Chat from './Chat';
import Play from './Play';
import Sims from './Sims';
import Shows from './Shows';
import TradingFloor from './TradingFloor';
import FantasyLeague from './FantasyLeague';
import Arena from './Arena';
import Battlefield from './Battlefield';
import DuelRoom from './DuelRoom';
import BattlefieldDuelLive from './games/battlefield/DuelLive';
import Gallery from './Gallery';
import Uno from './games/uno/Table';
import GameBoundary from './games/Boundary';
import LudoTable from './games/ludo/Table';
import SnakesTable from './games/snakes/Table';
import BlackjackTable from './games/blackjack/Table';
import BluffTable from './games/bluff/Table';
import TeenPattiTable from './games/teenpatti/Table';
import PokerTable from './games/poker/Table';
import CallbreakTable from './games/callbreak/Table';
import LiarsDiceTable from './games/liarsdice/Table';
import PusoyTable from './games/pusoy/Table';
import DebateMatch from './games/debate/Match';
import TriviaMatch from './games/trivia/Match';
import VerbalMatch from './games/verbal/Match';
import Desk from './Desk';
import You from './You';
import Door from './Door';
import { isLoggedIn, refreshSession, logout, savePush } from './api';
import { registerForPush, pushPermission } from './push';
import { C } from './theme';

// the built worlds, by tab id. (desk/rooms/arena/you are stubs for now.)
const SCREENS = {
  gathering: (p) => <GatheringWorld {...p} />,
  desk:  (p) => <DeskWorld {...p} />,
  play:  (p) => <PlayWorld {...p} />,
  arena: () => <WorldStub kicker="compete" title="Arena" line="games with friends — and always one AI. coming alive next." />,
  stage: () => <WorldStub kicker="rehearse" title="Stage" line="step into the scene. coming alive next." />,
};

function PlayWorld({ navigate, target }) {
  const [mode, setMode] = React.useState('choose'); // choose | arena | game — the landing IS the play world's front door
  const [match, setMatch] = React.useState(null);
  const [live, setLive] = React.useState(null);   // { game, sessionId } — a friends table
  const [opening, setOpening] = React.useState(false);   // the invited flow, visibly working
  const [duelSession, setDuelSession] = React.useState(null); // { sessionId } for a live practice duel
  const [duelStarting, setDuelStarting] = React.useState(false);
  useBackLayer(!!live, React.useCallback(() => { setLive(null); setMode('arena'); return true; }, []));
  const startLiveWithFriend = React.useCallback(async (game, roster) => {
    setOpening(true);
    try {
      const liveId = game.id === 'debate' ? 'debate_duel' : game.id === 'trivia' ? 'trivia_duel' : game.id;
      const personaKeys = (liveId === 'debate_duel' || liveId === 'trivia_duel') ? [] : (roster || []).map((o) => o.key).slice(0, 3);
      // the room needs a SHAREABLE host; some table casts aren't (by doctrine).
      // fall back to the moderator — the house's universal game master —
      // while the GAME still seats the cast the player actually chose.
      let room = await createRoom(`${game.name} table`, personaKeys.length ? personaKeys : ['the_moderator']);
      if (!room?.id) room = await createRoom(`${game.name} table`, ['the_moderator']);
      if (!room?.id) { Alert.alert("couldn't open the table", 'the room would not create — try again in a moment.'); return; }
      const inv = await inviteToRoom(room.id);
      const j = await startGameSession(room.id, liveId, personaKeys, 1);
      if (!j?.sessionId) { Alert.alert("couldn't seat the table", 'the game session failed to start.'); return; }
      if (inv?.token) {
        const link = 'https://callmez.app/?join=' + inv.token;
        try { await Share.share({ message: `come play ${game.name} with me on yourZ: ${link}`, url: link }); } catch (e) {}
      } else {
        Alert.alert('no invite link', "the table opened, but the invite token didn't — use the 🔗 button at the table to retry.");
      }
      setLive({ game: liveId, sessionId: j.sessionId });
      setMode('game');
    } catch (e) {
      Alert.alert('invite flow error', String((e && (e.message || e.stack)) || e).slice(0, 300));
    }
    setOpening(false);
  }, []);
  useBackLayer(mode === 'game' && !!match, React.useCallback(() => { setMatch(null); setMode('arena'); return true; }, []));
  useBackLayer(mode === 'arena', React.useCallback(() => { setMode('choose'); return true; }, []));
  useBackLayer(mode === 'battlefield', React.useCallback(() => { setMode('choose'); return true; }, []));
  useBackLayer(mode === 'duel', React.useCallback(() => { setDuelSession(null); setMode('battlefield'); return true; }, []));
  useBackLayer(mode === 'gallery', React.useCallback(() => { setMode('battlefield'); return true; }, []));
  useBackLayer(mode === 'sims', React.useCallback(() => { setMode('choose'); return true; }, []));
  useBackLayer(mode === 'shows', React.useCallback(() => { setMode('choose'); return true; }, []));
  useBackLayer(mode === 'floor', React.useCallback(() => { setMode('sims'); return true; }, []));
  useBackLayer(mode === 'ffl', React.useCallback(() => { setMode('sims'); return true; }, []));
  React.useEffect(() => { if (target?.open === 'arena') setMode('arena'); else if (target?.open === 'sims') setMode('sims'); }, [target]);
  // Games rebuilt one at a time, each verified on device. UNO is the first real one.
  if (opening && !live) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0C0A10', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(245,236,225,0.85)', fontSize: 17 }}>opening the table…</Text>
        <Text style={{ fontFamily: 'Figtree_400Regular', color: 'rgba(245,236,225,0.4)', fontSize: 12, marginTop: 8 }}>room · invite link · your seat</Text>
      </View>
    );
  }
  if (mode === 'game' && live) {
    const exitLive = () => { setLive(null); setMode('arena'); };
    if (live.game === 'debate_duel') return <DebateDuelLive sessionId={live.sessionId} onExit={exitLive} />;
    if (live.game === 'trivia_duel') return <TriviaDuelLive sessionId={live.sessionId} onExit={exitLive} />;
    if (live.game === 'callbreak') return <CallbreakLive sessionId={live.sessionId} onExit={exitLive} />;
    if (live.game === 'poker') return <PokerLive sessionId={live.sessionId} onExit={exitLive} />;
    if (live.game === 'pusoy') return <PusoyLive sessionId={live.sessionId} onExit={exitLive} />;
    if (live.game === 'ludo') return <LudoLive sessionId={live.sessionId} onExit={exitLive} />;
    return <LiarsDiceLive sessionId={live.sessionId} onExit={exitLive} />;
  }
  if (mode === 'game' && match) {
    const exit = () => setMode('arena');
    if (match.game?.id === 'uno') return <GameBoundary onExit={exit}><Uno game={match.game} opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'ludo') return <GameBoundary onExit={exit}><LudoTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'snakes') return <GameBoundary onExit={exit}><SnakesTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'blackjack') return <GameBoundary onExit={exit}><BlackjackTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'bluff') return <GameBoundary onExit={exit}><BluffTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'teenpatti' || match.game?.id === 'teen_patti') return <GameBoundary onExit={exit}><TeenPattiTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'poker') return <GameBoundary onExit={exit}><PokerTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'callbreak') return <GameBoundary onExit={exit}><CallbreakTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'liarsdice') return <GameBoundary onExit={exit}><LiarsDiceTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'pusoy') return <GameBoundary onExit={exit}><PusoyTable opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'debate') return <GameBoundary onExit={exit}><DebateMatch opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (match.game?.id === 'trivia') return <GameBoundary onExit={exit}><TriviaMatch opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    if (['riddle', 'twenty', 'wyr', 'dilemma'].includes(match.game?.id)) return <GameBoundary onExit={exit}><VerbalMatch gameId={match.game.id} opponent={match.opp} roster={match.roster} onExit={exit} /></GameBoundary>;
    setMode('arena'); return null; // other games not built yet
  }
  if (mode === 'battlefield') {
    return <Battlefield onBack={() => setMode('choose')} onEnterDuel={async (motion, domain, difficulty) => {
      setMode('duel'); setDuelStarting(true); setDuelSession(null);
      try {
        const r = await startBattlefieldPractice(motion, domain, difficulty);
        if (r?.sessionId) setDuelSession(r); else setMode('battlefield');
      } catch (e) { setMode('battlefield'); }
      setDuelStarting(false);
    }} onWatch={() => setMode('gallery')} />;
  }
  if (mode === 'duel') {
    const leaveDuel = () => { setDuelSession(null); setMode('battlefield'); };
    if (duelSession?.sessionId) return <BattlefieldDuelLive sessionId={duelSession.sessionId} onBack={leaveDuel} />;
    return (
      <View style={{ flex: 1, backgroundColor: '#08060A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: 'Fraunces_400Regular_Italic', color: 'rgba(245,236,225,0.85)', fontSize: 17 }}>opening the floor…</Text>
        <Text style={{ fontFamily: 'Figtree_400Regular', color: 'rgba(224,87,111,0.6)', fontSize: 12, marginTop: 8, letterSpacing: 2 }}>THE BATTLEFIELD · PRACTICE</Text>
      </View>
    );
  }
  if (mode === 'gallery') {
    return <Gallery onBack={() => setMode('battlefield')} />;
  }
  if (mode === 'arena') {
    return <Arena initialGameId={target?.game || null} initialOpponent={target?.opp || null} onOpenStage={() => navigate && navigate('stage')} onBack={() => setMode('choose')} onStartGame={(game, opp, roster, invited) => { if (invited) { startLiveWithFriend(game, roster); } else { setMatch({ game, opp, roster }); setMode('game'); } }} />;
  }
  if (mode === 'shows') {
    return <Shows onBack={() => setMode('choose')} />;
  }
  if (mode === 'sims') {
    return <Sims onBack={() => setMode('choose')} onOpenFloor={() => setMode('floor')} onOpenLeague={() => setMode('ffl')} />;
  }
  if (mode === 'floor') {
    return <TradingFloor onExit={() => setMode('sims')} />;
  }
  if (mode === 'ffl') {
    return <FantasyLeague onExit={() => setMode('sims')} />;
  }
  return <Play onEnter={(door) => { if (door === 'arena') setMode('arena'); else if (door === 'battlefield') setMode('battlefield'); else if (door === 'stage') navigate && navigate('stage'); else if (door === 'sims') setMode('sims'); else if (door === 'shows') setMode('shows'); }} />;
}

function DeskWorld({ navigate, onLogout }) {
  const [openYou, setOpenYou] = React.useState(false);
  useBackLayer(openYou, React.useCallback(() => { setOpenYou(false); return true; }, []));
  if (openYou) return <You onBack={() => setOpenYou(false)} onLogout={onLogout} onOpenChat={navigate} />;
  return <Desk onOpenYou={() => setOpenYou(true)} onRoute={navigate || (() => {})} onOpenLetter={() => {}} />;
}

function GatheringWorld({ navigate, target }) {
  const [openChat, setOpenChat] = React.useState(null); // persona key or null
  const [creating, setCreating] = React.useState(false);
  useBackLayer(!!openChat, React.useCallback(() => { setOpenChat(null); return true; }, []));
  useBackLayer(creating, React.useCallback(() => { setCreating(false); return true; }, []));
  React.useEffect(() => { if (target?.persona) setOpenChat(target.persona); }, [target]);
  if (creating) return <CreatePersona onBack={() => setCreating(false)} onDone={(key) => { setCreating(false); setOpenChat(key); }} />;
  if (openChat) return <Chat key={openChat} personaKey={openChat} initialDraft={target?.persona === openChat ? (target?.draft || '') : ''} autoSend={target?.persona === openChat && !!target?.autoSend} onBack={() => setOpenChat(null)} onRoute={navigate || (() => {})} />;
  return <Roster onOpen={(pkey) => setOpenChat(pkey)} onCreate={() => setCreating(true)} />;
}

// [R3] RoomsWorld died with the world pill — the Lobby placeholder chain and the
// PublicRoom mock are gone; every room lives in ChatHome's folded rooms tab.

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    CormorantGaramond_300Light, CormorantGaramond_400Regular_Italic, CormorantGaramond_500Medium,
    JetBrainsMono_300Light, JetBrainsMono_400Regular,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  const [authed, setAuthed] = React.useState(null); // null=checking, false=door, true=in
  React.useEffect(() => {
    initRoster();   // [manifest] cache-first, bg refresh — never blocks
    (async () => {
      if (await isLoggedIn()) { setAuthed(true); return; }
      // try a silent refresh before showing the door
      if (await refreshSession()) { setAuthed(true); return; }
      setAuthed(false);
    })();
  }, []);

  // once we're in, if notifications are already granted, quietly keep the push
  // token fresh (tokens rotate). never blocks the UI; ignores failures.
  React.useEffect(() => {
    if (authed !== true) return;
    (async () => {
      try {
        const perm = await pushPermission();
        if (perm === 'granted') {
          const { token } = await registerForPush();
          if (token) await savePush({ pushToken: token });
        }
      } catch (e) {}
    })();
  }, [authed]);

  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.void }} />;

  const doLogout = async () => { await logout(); setAuthed(false); };
  // desk hosts the profile, so it carries the logout handler up to the auth gate
  const screens = { ...SCREENS, desk: (p) => <DeskWorld {...p} onLogout={doLogout} /> };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {authed === null ? (
          <View style={{ flex: 1, backgroundColor: C.void }} />
        ) : authed ? (
          <Nav screens={screens} onLogout={doLogout} />
        ) : (
          <Door onEnter={() => setAuthed(true)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
