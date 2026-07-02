// ════════════════════════════════════════════════════════════════════════
//  yourZ — app entry. Mounts the navigation spine (Nav) and feeds it the
//  built worlds. Unbuilt worlds fall back to a "coming alive" stub.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
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
import LudoTable from './games/ludo/Table';
import SnakesTable from './games/snakes/Table';
import BlackjackTable from './games/blackjack/Table';
import BluffTable from './games/bluff/Table';
import TeenPattiTable from './games/teenpatti/Table';
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
  React.useEffect(() => { if (target?.open === 'arena') setMode('arena'); }, [target]);
  // Games rebuilt one at a time, each verified on device. UNO is the first real one.
  if (mode === 'game' && match) {
    if (match.game?.id === 'uno') return <Uno game={match.game} opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    if (match.game?.id === 'ludo') return <LudoTable opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    if (match.game?.id === 'snakes') return <SnakesTable opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    if (match.game?.id === 'blackjack') return <BlackjackTable opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    if (match.game?.id === 'bluff') return <BluffTable opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    if (match.game?.id === 'teenpatti' || match.game?.id === 'teen_patti') return <TeenPattiTable opponent={match.opp} roster={match.roster} onExit={() => setMode('arena')} />;
    setMode('arena'); return null; // other games not built yet
  }
  if (mode === 'arena') {
    return <Arena onBack={() => setMode('choose')} onStartGame={(game, opp, roster) => { setMatch({ game, opp, roster }); setMode('game'); }} />;
  }
  return <Play onEnter={(door) => { if (door === 'arena') setMode('arena'); }} />;
}

function DeskWorld({ navigate, onLogout }) {
  const [openYou, setOpenYou] = React.useState(false);
  if (openYou) return <You onBack={() => setOpenYou(false)} onLogout={onLogout} />;
  return <Desk onOpenYou={() => setOpenYou(true)} onRoute={navigate || (() => {})} onOpenLetter={() => {}} />;
}

function GatheringWorld({ navigate, target }) {
  const [openChat, setOpenChat] = React.useState(null); // persona key or null
  React.useEffect(() => { if (target?.persona) setOpenChat(target.persona); }, [target]);
  if (openChat) return <Chat personaKey={openChat} onBack={() => setOpenChat(null)} />;
  return <Roster onOpen={(pkey) => setOpenChat(pkey)} />;
}

function RoomsWorld() {
  const [openRoom, setOpenRoom] = React.useState(null);
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
