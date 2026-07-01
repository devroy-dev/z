// ════════════════════════════════════════════════════════════════════════
//  yourZ — 3D POKER (expo-gl + three.js). A felt table in 3D: the surface,
//  dealt cards with depth that flip, chips, the community cards. Opponent's
//  presence overlays. ⚠️ RENDERS ONLY ON A PHYSICAL DEVICE (expo-gl).
// ════════════════════════════════════════════════════════════════════════
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GLView } from 'expo-gl';
import * as ExpoTHREE from 'expo-three';
import { Renderer } from 'expo-three';
import * as THREEmodule from 'three';
// expo-three needs the SAME global THREE instance it mutates (side-effects);
// wiring it explicitly avoids the silent black-screen. See expo-three README.
global.THREE = global.THREE || THREEmodule;
const THREE = global.THREE;
import { C, FONTS } from './theme';

const faceFor = (k) => `https://callmez.app/faces/${k}.jpg`;

export default function Poker3D({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765' };
  const [banter, setBanter] = useState(`${opp.name} shuffles, watching you.`);
  const [phase, setPhase] = useState('deal'); // deal | your-move
  const dealRef = useRef(null);

  const onContextCreate = async (gl) => {
    try {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setClearColor(0x0a0710, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0710, 9, 24);

    const camera = new THREE.PerspectiveCamera(48, w / h, 0.1, 100);
    camera.position.set(0, 6.5, 8);
    camera.lookAt(0, -0.4, 0.5);

    // warm overhead key light (the classic card-table pool of light)
    const key = new THREE.SpotLight(0xffe0b0, 2.2, 30, Math.PI / 5, 0.5, 1);
    key.position.set(0, 11, 2);
    key.target.position.set(0, 0, 0);
    scene.add(key); scene.add(key.target);
    const rim = new THREE.PointLight(0xF3A85F, 0.5, 24);
    rim.position.set(-6, 3, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x2a2230, 0.6));

    // the felt table — a dark rounded oval
    const tableGeo = new THREE.CylinderGeometry(5.2, 5.2, 0.5, 48);
    const feltMat = new THREE.MeshStandardMaterial({ color: 0x1a2b22, roughness: 0.9, metalness: 0 });
    const table = new THREE.Mesh(tableGeo, feltMat);
    table.scale.set(1.3, 1, 1);
    table.position.y = -0.4;
    scene.add(table);
    // felt inner ring (subtle rail)
    const rail = new THREE.Mesh(new THREE.TorusGeometry(5.0, 0.18, 16, 60), new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.6, metalness: 0.3 }));
    rail.rotation.x = Math.PI / 2; rail.scale.set(1.3, 1, 1); rail.position.y = -0.16; scene.add(rail);

    // make a card mesh (white front, dark back)
    const cardGeo = new THREE.BoxGeometry(0.95, 0.04, 1.35);
    const mkCard = (x, z, faceUp) => {
      const mat = new THREE.MeshStandardMaterial({ color: faceUp ? 0xf8f4ec : 0x3a1e2a, roughness: 0.4, metalness: 0.05 });
      const c = new THREE.Mesh(cardGeo, mat);
      c.position.set(x, 0.05, z);
      c.rotation.z = (Math.random() - 0.5) * 0.15;
      scene.add(c);
      return c;
    };
    // your two hole cards (near, face up), opp's (far, face down), community (center)
    const cards = [];
    cards.push(mkCard(-0.7, 2.6, true));
    cards.push(mkCard(0.5, 2.7, true));
    cards.push(mkCard(-0.7, -2.8, false));
    cards.push(mkCard(0.5, -2.8, false));
    for (let i = 0; i < 5; i++) cards.push(mkCard(-2.4 + i * 1.2, 0, i < 3));

    // start cards "dealt in" — drop from above with a stagger
    cards.forEach((c, i) => { c.userData.targetY = 0.05; c.position.y = 6 + i; c.userData.delay = i * 90; c.userData.start = Date.now(); });

    // a few chips
    const chipMat = new THREE.MeshStandardMaterial({ color: 0xF0A765, roughness: 0.4, metalness: 0.3, emissive: 0xF0A765, emissiveIntensity: 0.15 });
    for (let i = 0; i < 5; i++) {
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.09, 24), chipMat);
      chip.position.set(1.6, 0.1 + i * 0.09, 0.6);
      scene.add(chip);
    }

    let raf;
    const clock = new THREE.Clock();
    const render = () => {
      raf = requestAnimationFrame(render);
      const t = clock.getElapsedTime();
      // cards fall into place (the deal)
      cards.forEach((c) => {
        if (Date.now() - c.userData.start > c.userData.delay) {
          c.position.y += (c.userData.targetY - c.position.y) * 0.18;
        }
      });
      camera.position.x = Math.sin(t * 0.12) * 0.5;
      camera.lookAt(0, -0.4, 0.5);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
    setTimeout(() => { setPhase('your-move'); setBanter(`${opp.name}: "your move. don't take all night."`); }, 1600);
    } catch (err) {
      setBanter('3D error: ' + (err?.message || String(err)));
      console.error('Poker3D GL error', err);
    }
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Poker'}</Text>
          <View style={{ width: 26 }} />
        </View>

        <GLView style={styles.gl} onContextCreate={onContextCreate} />

        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.oppBadge}>
            <OppFace pkey={opp.key} tone={opp.tone} />
            <Text style={styles.oppName}>{opp.name}</Text>
          </View>
          <Text style={styles.banter}>{banter}</Text>
        </View>

        <View style={styles.actions}>
          {phase === 'your-move' ? (
            <View style={styles.moveRow}>
              <Pressable style={styles.moveBtn} onPress={() => setBanter('you check.')}><Text style={styles.moveText}>check</Text></Pressable>
              <Pressable style={[styles.moveBtn, styles.moveRaise]} onPress={() => setBanter(`you raise. ${opp.name} narrows their eyes.`)}><Text style={[styles.moveText, { color: '#3A1505' }]}>raise</Text></Pressable>
              <Pressable style={styles.moveBtn} onPress={() => setBanter('you fold. smart, maybe.')}><Text style={styles.moveText}>fold</Text></Pressable>
            </View>
          ) : (
            <View style={styles.waitPill}><Text style={styles.waitText}>dealing…</Text></View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function OppFace({ pkey, tone }) {
  const [ok, setOk] = useState(true);
  return (
    <View style={[styles.oppFace, { borderColor: tone }]}>
      {ok ? <Image source={{ uri: faceFor(pkey) }} resizeMode="cover" style={{ width: '100%', height: '100%', borderRadius: 20 }} onError={() => setOk(false)} />
          : <View style={{ flex: 1, backgroundColor: tone, borderRadius: 20 }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.void },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, zIndex: 5 },
  chev: { color: C.muted, fontSize: 30, width: 26, marginTop: -3 },
  title: { fontFamily: FONTS.display, color: C.cream, fontSize: 20 },
  gl: { flex: 1 },
  overlay: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  oppBadge: { alignItems: 'center', gap: 6 },
  oppFace: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1a121f' },
  oppName: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  banter: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 16, textAlign: 'center', marginTop: 10, paddingHorizontal: 30 },
  actions: { paddingHorizontal: 24, paddingBottom: 14, alignItems: 'center', zIndex: 5 },
  moveRow: { flexDirection: 'row', gap: 12 },
  moveBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  moveRaise: { backgroundColor: C.ember, borderColor: C.ember },
  moveText: { fontFamily: FONTS.semibold, color: C.cream, fontSize: 15 },
  waitPill: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: 200, alignItems: 'center' },
  waitText: { fontFamily: FONTS.body, color: C.muted, fontSize: 15 },
});
