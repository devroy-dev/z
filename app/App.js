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
import GameTable from './GameTable';
import Ludo3D from './Ludo3D';
import Poker3D from './Poker3D';
import Rooms from './Rooms';
import RoomChat from './RoomChat';
import Desk from './Desk';
import You from './You';
import PublicRoom from './PublicRoom';
import { C } from './theme';

// the built worlds, by tab id. (desk/rooms/arena/you are stubs for now.)
const SCREENS = {
  gathering: () => <GatheringWorld />,
  desk:  () => <DeskWorld />,
  rooms: () => <RoomsWorld />,
  play:  () => <PlayWorld />,
  arena: () => <WorldStub kicker="compete" title="Arena" line="games with friends — and always one AI. coming alive next." />,
  stage: () => <WorldStub kicker="rehearse" title="Stage" line="step into the scene. coming alive next." />,
};

function PlayWorld() {
  const [mode, setMode] = React.useState('choose'); // choose | arena | game
  const [match, setMatch] = React.useState(null);
  if (mode === 'game' && match) {
    const gid = match.game?.id;
    if (gid === 'ludo')  return <Ludo3D  game={match.game} opponent={match.opp} onExit={() => setMode('arena')} />;
    if (gid === 'poker') return <Poker3D game={match.game} opponent={match.opp} onExit={() => setMode('arena')} />;
    return <GameTable game={match.game} opponent={match.opp} onExit={() => setMode('arena')} />;
  }
  if (mode === 'arena') {
    return <Arena onBack={() => setMode('choose')} onStartGame={(game, opp) => { setMatch({ game, opp }); setMode('game'); }} />;
  }
  return <Play onEnter={(door) => { if (door === 'arena') setMode('arena'); }} />;
}

function DeskWorld() {
  const [openYou, setOpenYou] = React.useState(false);
  if (openYou) return <You onBack={() => setOpenYou(false)} />;
  return <Desk onOpenYou={() => setOpenYou(true)} onRoute={() => {}} onOpenLetter={() => {}} />;
}

function GatheringWorld() {
  const [openChat, setOpenChat] = React.useState(false);
  if (openChat) return <Chat onBack={() => setOpenChat(false)} />;
  return <Roster onOpen={() => setOpenChat(true)} />;
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
  if (!fontsLoaded && !fontError) return <View style={{ flex: 1, backgroundColor: C.void }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Nav screens={SCREENS} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
