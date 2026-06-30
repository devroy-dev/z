// ════════════════════════════════════════════════════════════════════════
//  yourZ — app entry. Mounts the navigation spine (Nav) and feeds it the
//  built worlds. Unbuilt worlds fall back to a "coming alive" stub.
// ════════════════════════════════════════════════════════════════════════
import React from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { useFonts, Fraunces_400Regular, Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces';
import { Figtree_300Light, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold } from '@expo-google-fonts/figtree';

import Nav, { WorldStub } from './Nav';
import Roster from './Roster';
import Chat from './Chat';
import Play from './Play';
import Rooms from './Rooms';
import RoomChat from './RoomChat';
import PublicRoom from './PublicRoom';
import { C } from './theme';

// the built worlds, by tab id. (desk/rooms/arena/you are stubs for now.)
const SCREENS = {
  gathering: () => <GatheringWorld />,
  desk:  () => <WorldStub kicker="the lobby" title="Front Desk" line="your concierge — reads your mood, walks you in. coming alive next." />,
  rooms: () => <RoomsWorld />,
  play:  () => <Play onEnter={() => {}} />,
  arena: () => <WorldStub kicker="compete" title="Arena" line="games with friends — and always one AI. coming alive next." />,
  stage: () => <WorldStub kicker="rehearse" title="Stage" line="step into the scene. coming alive next." />,
  you:   () => <WorldStub kicker="your space" title="You" line="your name, your people, your settings. coming alive next." />,
};

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
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <Nav screens={SCREENS} />
    </SafeAreaProvider>
  );
}
