// ════════════════════════════════════════════════════════════════════════
//  yourZ — app entry. Mounts the navigation spine (Nav) and feeds it the
//  built worlds. Unbuilt worlds fall back to a "coming alive" stub.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { useBackLayer } from './backbus';
import { Share, Alert } from 'react-native';
import { createRoom, inviteToRoom, startGameSession } from './api';
import LiarsDiceLive from './games/liarsdice/Live';
import CallbreakLive from './games/callbreak/Live';
import PokerLive from './games/poker/Live';
import PusoyLive from './games/pusoy/Live';
import LudoLive from './games/ludo/Live';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'react-native';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';

import Nav, { WorldStub } from './Nav';
import Roster from './Roster';
import Chat from './Chat';
import Play from './Play';
import Arena from './Arena';
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
import Rooms from './Rooms';
import RoomChat from './RoomChat';
import Desk from './Desk';
import You from './You';
import Door from './Door';
import { isLoggedIn, refreshSession, logout } from './api';
import PublicRoom from './PublicRoom';
import { C } from './theme';

// the built worlds, by tab id. (desk/rooms/arena/you are stubs for now.)
const SCREENS = {
  gathering: (p) => <GatheringWorld {...p} />,
  desk:  (p) => <DeskWorld {...p} />,
  rooms: (p) => <RoomsWorld {...p} />,
  play:  (p) => <PlayWorld {...p} />,
  arena: () => <WorldStub kicker="compete" title="Arena" line="games with friends — and always one AI. coming alive next." />,
  stage: () => <WorldStub kicker="rehearse" title="Stage" line="step into the scene. coming alive next." />,
};

function PlayWorld({ navigate, target }) {
  const [mode, setMode] = React.useState('choose'); // choose | arena | game
  const [match, setMatch] = React.useState(null);
  const [live, setLive] = React.useState(null);   // { game, sessionId } — a friends table
  useBackLayer(!!live, React.useCallback(() => { setLive(null); setMode('arena'); return true; }, []));
  const startLiveWithFriend = React.useCallback(async (game, roster) => {
    try {
      const personaKeys = (roster || []).map((o) => o.key).slice(0, 3);
      // the room needs a SHAREABLE host; some table casts aren't (by doctrine).
      // fall back to the moderator — the house's universal game master —
      // while the GAME still seats the cast the player actually chose.
      let room = await createRoom(`${game.name} table`, personaKeys.length ? personaKeys : ['the_moderator']);
      if (!room?.id) room = await createRoom(`${game.name} table`, ['the_moderator']);
      if (!room?.id) { Alert.alert("couldn't open the table", 'the room would not create — try again in a moment.'); return; }
      const inv = await inviteToRoom(room.id);
      const j = await startGameSession(room.id, game.id, personaKeys);
      if (!j?.sessionId) { Alert.alert("couldn't seat the table", 'the game session failed to start.'); return; }
      setLive({ game: game.id, sessionId: j.sessionId });
      setMode('game');
      if (inv?.token) {
        const link = 'https://callmez.app/?join=' + inv.token;
        try { await Share.share({ message: `come play ${game.name} with me on yourZ: ${link}`, url: link }); } catch (e) {}
      }
    } catch (e) {}
  }, []);
  useBackLayer(mode === 'game' && !!match, React.useCallback(() => { setMatch(null); setMode('arena'); return true; }, []));
  useBackLayer(mode === 'arena', React.useCallback(() => { setMode('choose'); return true; }, []));
  React.useEffect(() => { if (target?.open === 'arena') setMode('arena'); }, [target]);
  // Games rebuilt one at a time, each verified on device. UNO is the first real one.
  if (mode === 'game' && live) {
    const exitLive = () => { setLive(null); setMode('arena'); };
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
  if (mode === 'arena') {
    return <Arena onBack={() => setMode('choose')} onStartGame={(game, opp, roster, invited) => { if (invited) { startLiveWithFriend(game, roster); } else { setMatch({ game, opp, roster }); setMode('game'); } }} />;
  }
  return <Play onEnter={(door) => { if (door === 'arena') setMode('arena'); else if (door === 'stage') navigate && navigate('stage'); }} />;
}

function DeskWorld({ navigate, onLogout }) {
  const [openYou, setOpenYou] = React.useState(false);
  useBackLayer(openYou, React.useCallback(() => { setOpenYou(false); return true; }, []));
  if (openYou) return <You onBack={() => setOpenYou(false)} onLogout={onLogout} />;
  return <Desk onOpenYou={() => setOpenYou(true)} onRoute={navigate || (() => {})} onOpenLetter={() => {}} />;
}

function GatheringWorld({ navigate, target }) {
  const [openChat, setOpenChat] = React.useState(null); // persona key or null
  useBackLayer(!!openChat, React.useCallback(() => { setOpenChat(null); return true; }, []));
  React.useEffect(() => { if (target?.persona) setOpenChat(target.persona); }, [target]);
  if (openChat) return <Chat personaKey={openChat} onBack={() => setOpenChat(null)} />;
  return <Roster onOpen={(pkey) => setOpenChat(pkey)} />;
}

function RoomsWorld() {
  const [openRoom, setOpenRoom] = React.useState(null);
  useBackLayer(!!openRoom, React.useCallback(() => { setOpenRoom(null); return true; }, []));
  if (openRoom && !openRoom.create) {
    if (openRoom.kind === 'public') {
      return <PublicRoom room={openRoom} onExit={() => setOpenRoom(null)} />;
    }
    return <RoomChat room={openRoom} onBack={() => setOpenRoom(null)} />;
  }
  return <Rooms onOpen={(r) => setOpenRoom(r)} />;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_400Regular, Fraunces_400Regular_Italic,
    Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold,
  });
  const [authed, setAuthed] = React.useState(null); // null=checking, false=door, true=in
  React.useEffect(() => {
    (async () => {
      if (await isLoggedIn()) { setAuthed(true); return; }
      // try a silent refresh before showing the door
      if (await refreshSession()) { setAuthed(true); return; }
      setAuthed(false);
    })();
  }, []);

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
          <Nav screens={screens} />
        ) : (
          <Door onEnter={() => setAuthed(true)} />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
