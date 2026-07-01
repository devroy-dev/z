// ════════════════════════════════════════════════════════════════════════
//  yourZ — 3D LUDO (expo-gl + three.js). A real board in 3D space: raised
//  tiles, tokens with depth, a die that tumbles with rotation. Opponent's
//  presence sits at the table (2D overlay). Honors pacing: die tumbles, the
//  AI takes a beat. ⚠️ RENDERS ONLY ON A PHYSICAL DEVICE (expo-gl) — blank on
//  web/emulator by design. First 3D build may need a debug pass.
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

// the four ludo quadrant colors
const QUAD = [0xF0A765, 0x6FC9E0, 0xF0708C, 0x8FD98F];

export default function Ludo3D({ game, opponent, onExit = () => {} }) {
  const opp = opponent || { key: 'the_wannabe', name: 'the hustler', tone: '#F0A765' };
  const [turn, setTurn] = useState('you');
  const [banter, setBanter] = useState(`${opp.name} settles in across the table.`);
  const rollFnRef = useRef(null);
  const [rolling, setRolling] = useState(false);

  const onContextCreate = async (gl) => {
    try {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;
    // THE FIX: three r163+ dropped WebGL1 and, left alone, tries to make a WebGL1
    // context → fails on device. expo-gl's gl IS a WebGL2 context. So we hand three
    // a fake "canvas" whose getContext returns expo-gl's context, and force webgl2.
    // three then uses expo-gl's WebGL2 context directly and the r163 check passes.
    gl.canvas = gl.canvas || { width: w, height: h, style: {}, addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl };
    const renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x0e0912, 1);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0e0912, 8, 22);

    // camera — angled looking down at the board
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 7.5, 7.5);
    camera.lookAt(0, 0, 0);

    // lights — warm key + soft fill (the lamplight direction, in 3D)
    const key = new THREE.PointLight(0xffd9a0, 1.5, 40);
    key.position.set(4, 9, 5);
    scene.add(key);
    const fill = new THREE.PointLight(0xF3A85F, 0.6, 30);
    fill.position.set(-5, 4, -3);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0x4a3a52, 0.7));

    // the board — a dark rounded slab
    const boardGeo = new THREE.BoxGeometry(6.4, 0.4, 6.4);
    const boardMat = new THREE.MeshStandardMaterial({ color: 0x160f1c, roughness: 0.7, metalness: 0.1 });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.y = -0.2;
    scene.add(board);

    // four home quadrants (raised tinted corners)
    const homeGeo = new THREE.BoxGeometry(2.4, 0.18, 2.4);
    const corners = [[-1.9, 1.9], [1.9, 1.9], [1.9, -1.9], [-1.9, -1.9]];
    corners.forEach((c, i) => {
      const m = new THREE.MeshStandardMaterial({ color: QUAD[i], roughness: 0.5, emissive: QUAD[i], emissiveIntensity: 0.12 });
      const q = new THREE.Mesh(homeGeo, m);
      q.position.set(c[0], 0.09, c[1]);
      scene.add(q);
    });

    // the cross path (light center strip)
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x2a2030, roughness: 0.6 });
    const hStrip = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 1.4), pathMat);
    hStrip.position.y = 0.08; scene.add(hStrip);
    const vStrip = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 6.4), pathMat);
    vStrip.position.y = 0.08; scene.add(vStrip);

    // tokens — glowing pawns, two per side for show
    const tokens = [];
    const mkToken = (color, x, z) => {
      const g = new THREE.SphereGeometry(0.32, 20, 20);
      const m = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2, emissive: color, emissiveIntensity: 0.25 });
      const t = new THREE.Mesh(g, m);
      t.position.set(x, 0.5, z);
      scene.add(t);
      tokens.push(t);
      return t;
    };
    mkToken(QUAD[0], -1.9, 1.9);
    mkToken(QUAD[0], -2.4, 1.9);
    mkToken(QUAD[2], 1.9, -1.9);
    mkToken(QUAD[2], 2.4, -1.9);

    // the die — a rounded cube that tumbles
    const dieGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const dieMat = new THREE.MeshStandardMaterial({ color: 0xfff2e6, roughness: 0.35, metalness: 0.05 });
    const die = new THREE.Mesh(dieGeo, dieMat);
    die.position.set(0, 1.1, 0);
    scene.add(die);
    // simple pips (dark dots on top face)
    const pipMat = new THREE.MeshStandardMaterial({ color: 0x3a1505 });
    for (let i = -1; i <= 1; i++) {
      const pip = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), pipMat);
      pip.position.set(i * 0.25, 0.46, i * 0.25);
      die.add(pip);
    }

    // animation state
    let rollUntil = 0;
    let dieSpin = { x: 0, y: 0, z: 0 };

    // expose a roll trigger to React
    rollFnRef.current = () => {
      rollUntil = Date.now() + 900;
      dieSpin = { x: 0.3 + Math.random() * 0.3, y: 0.2 + Math.random() * 0.3, z: 0.3 + Math.random() * 0.3 };
    };

    let raf;
    const clock = new THREE.Clock();
    const render = () => {
      raf = requestAnimationFrame(render);
      const t = clock.getElapsedTime();
      // tokens breathe / bob gently
      tokens.forEach((tok, i) => { tok.position.y = 0.5 + Math.sin(t * 1.5 + i) * 0.06; });
      // die: tumble while rolling, settle after
      if (Date.now() < rollUntil) {
        die.rotation.x += dieSpin.x;
        die.rotation.y += dieSpin.y;
        die.rotation.z += dieSpin.z;
        die.position.y = 1.1 + Math.abs(Math.sin((rollUntil - Date.now()) / 90)) * 0.8;
      } else {
        die.position.y += (1.1 - die.position.y) * 0.2;
      }
      // slow ambient camera drift for life
      camera.position.x = Math.sin(t * 0.15) * 0.6;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
    } catch (err) {
      setBanter('3D error: ' + (err?.message || String(err)));
      console.error('Ludo3D GL error', err);
    }
  };

  const doRoll = (who) => {
    if (rolling) return;
    setRolling(true);
    if (who === 'opp') setBanter(`${opp.name} eyes the board…`);
    else setBanter('rolling…');
    rollFnRef.current && rollFnRef.current();
    setTimeout(() => {
      const v = 1 + Math.floor(Math.random() * 6);
      setRolling(false);
      setBanter(who === 'you' ? `you rolled a ${v}.` : (v >= 5 ? `${opp.name}: "boom. read it and weep."` : `${opp.name} rolled a ${v}.`));
      setTimeout(() => setTurn(who === 'you' ? 'opp' : 'you'), 900);
    }, 950);
  };

  // opponent takes a beat, then rolls (pacing)
  useEffect(() => {
    if (turn === 'opp' && !rolling) {
      const t = setTimeout(() => doRoll('opp'), 1000 + Math.random() * 700);
      return () => clearTimeout(t);
    }
  }, [turn]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View style={styles.topbar}>
          <Pressable hitSlop={10} onPress={onExit}><Text style={styles.chev}>‹</Text></Pressable>
          <Text style={styles.title}>{game?.name || 'Ludo'}</Text>
          <View style={{ width: 26 }} />
        </View>

        {/* the 3D board fills the space */}
        <GLView style={styles.gl} onContextCreate={onContextCreate} />

        {/* opponent presence + banter overlay */}
        <View style={styles.overlay} pointerEvents="box-none">
          <View style={styles.oppBadge}>
            <OppFace pkey={opp.key} tone={opp.tone} />
            <Text style={styles.oppName}>{opp.name}</Text>
          </View>
          <Text style={styles.banter}>{banter}</Text>
        </View>

        <View style={styles.actions}>
          {turn === 'you' && !rolling ? (
            <Pressable style={styles.rollBtn} onPress={() => doRoll('you')}>
              <LinearGradient colors={[C.ember, C.emberDeep]} start={{ x: 0.3, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rollInner}>
                <Text style={styles.rollText}>roll</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitPill}><Text style={styles.waitText}>{turn === 'you' ? 'rolling…' : `${opp.name}'s turn`}</Text></View>
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
  overlay: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 20 },
  oppBadge: { alignItems: 'center', gap: 6 },
  oppFace: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, backgroundColor: '#1a121f' },
  oppName: { fontFamily: FONTS.body, color: C.muted, fontSize: 12 },
  banter: { fontFamily: FONTS.displayItalic, color: C.accentSoft, fontSize: 16, textAlign: 'center', marginTop: 10 },
  actions: { paddingHorizontal: 24, paddingBottom: 14, alignItems: 'center', zIndex: 5 },
  rollBtn: { borderRadius: 26, overflow: 'hidden', width: 200 },
  rollInner: { paddingVertical: 16, alignItems: 'center' },
  rollText: { fontFamily: FONTS.semibold, color: '#3A1505', fontSize: 17, letterSpacing: 1 },
  waitPill: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', width: 200, alignItems: 'center' },
  waitText: { fontFamily: FONTS.body, color: C.muted, fontSize: 15 },
});
