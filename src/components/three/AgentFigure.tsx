import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { Billboard, Sparkles } from '@react-three/drei';
import type { AgentPalette } from '../../lib/palette';

export type AgentMood = 'idle' | 'attention' | 'speaking' | 'thinking' | 'talking' | 'error';

/* ------------------------------------------------------------------ */
/* Geometry — traced from the original 2D avatar silhouette            */
/* (head circle on top of a bell-shaped body, 1 unit = 100px of PNG)   */
/* ------------------------------------------------------------------ */

const HEAD_Y = 3.74;
const HEAD_R = 1.08;
export const FIGURE_HEIGHT = HEAD_Y + HEAD_R;

const BODY_PROFILE: [number, number][] = [
  [0, 0], [0.9, 0], [1.25, 0.07], [1.55, 0.22], [1.75, 0.46], [1.86, 0.8],
  [1.88, 1.2], [1.82, 1.65], [1.65, 2.05], [1.38, 2.38], [1.0, 2.62], [0.55, 2.78], [0, 2.84],
];

const smooth = (e0: number, e1: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Vertex colors: dark base tone with a lighter belly / chin, as in the PNG avatars
function paint(geo: THREE.BufferGeometry, p: AgentPalette, fn: (y: number, z: number) => number) {
  const pos = geo.attributes.position;
  const base = new THREE.Color(p.base);
  const mid = new THREE.Color(p.mid);
  const light = new THREE.Color(p.light);
  const out = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const f = fn(pos.getY(i), pos.getZ(i));
    const k = THREE.MathUtils.clamp(0.22 + f * 0.85, 0, 1);
    if (k < 0.45) c.copy(base).lerp(mid, k / 0.45);
    else c.copy(mid).lerp(light, (k - 0.45) / 0.55);
    out[i * 3] = c.r;
    out[i * 3 + 1] = c.g;
    out[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

function useFigureGeometry(p: AgentPalette) {
  return useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      BODY_PROFILE.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false,
      'centripetal'
    );
    const pts = curve.getPoints(90).map((v) => new THREE.Vector2(Math.max(0, v.x), v.y));
    pts[0].x = 0;
    pts[pts.length - 1].x = 0;
    const body = new THREE.LatheGeometry(pts, 96);
    body.computeVertexNormals();
    paint(body, p, (y, z) => 0.95 * (1 - smooth(0.1, 1.45, y)) * (0.55 + 0.45 * smooth(-1, 1.2, z)) + 0.12 * smooth(2.3, 2.8, y));

    const head = new THREE.SphereGeometry(HEAD_R, 72, 72);
    paint(head, p, (y, z) => 0.85 * smooth(-0.35, -1.0, y) * (0.5 + 0.5 * smooth(-0.5, 1, z)) + 0.35 * smooth(0.7, 1.05, y));

    const arm = new THREE.CapsuleGeometry(0.33, 0.95, 8, 24);
    paint(arm, p, (y) => 0.35 + 0.45 * smooth(0.2, -0.7, y));

    return { body, head, arm };
  }, [p]);
}

/* Shared soft radial texture for floor glow & shadow */
let radialTex: THREE.Texture | null = null;
function getRadialTexture() {
  if (radialTex) return radialTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  radialTex = new THREE.CanvasTexture(cv);
  return radialTex;
}

const easeOutBack = (x: number) => {
  const c1 = 1.5;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

interface AgentFigureProps {
  palette: AgentPalette;
  mood: AgentMood;
  position?: [number, number, number];
  enterDelay?: number;
  reducedMotion?: boolean;
  lookAtPointer?: boolean;
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
  onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (e: ThreeEvent<PointerEvent>) => void;
  children?: React.ReactNode;
}

const damp = THREE.MathUtils.damp;
const ERROR_RED = new THREE.Color('#ff4d4d');

export const AgentFigure: React.FC<AgentFigureProps> = ({
  palette,
  mood,
  position = [0, 0, 0],
  enterDelay = 0,
  reducedMotion = false,
  lookAtPointer = true,
  onPointerOver,
  onPointerOut,
  onClick,
  onPointerDown,
  onPointerUp,
  children,
}) => {
  const geo = useFigureGeometry(palette);
  const glowColor = useMemo(() => new THREE.Color(palette.glow), [palette]);

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.34,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.1,
        emissive: new THREE.Color(palette.glow),
        emissiveIntensity: 0,
      }),
    [palette]
  );

  const root = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const orbit = useRef<THREE.Group>(null!);
  const halo = useRef<THREE.Mesh>(null!);
  const glow = useRef<THREE.Mesh>(null!);
  const shadow = useRef<THREE.Mesh>(null!);

  const lv = useRef({ talk: 0, think: 0, att: 0, err: 0, hop: 0, born: -1, shake: 0 });
  const prevMood = useRef<AgentMood>(mood);
  const world = useMemo(() => new THREE.Vector3(), []);
  const radial = useMemo(() => getRadialTexture(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const L = lv.current;
    const m = reducedMotion ? 0.35 : 1;
    if (L.born < 0) L.born = t;

    if (mood === 'error' && prevMood.current !== 'error') L.shake = 1;
    prevMood.current = mood;

    // Smoothed activity levels → every effect fades in/out instead of popping
    L.talk = damp(L.talk, mood === 'speaking' || mood === 'talking' ? 1 : 0, 4, dt);
    L.think = damp(L.think, mood === 'thinking' ? 1 : 0, 3, dt);
    L.att = damp(L.att, mood === 'attention' ? 1 : 0, 6, dt);
    L.err = damp(L.err, mood === 'error' ? 1 : 0, 5, dt);
    L.shake = damp(L.shake, 0, 2.5, dt);

    // Entrance: drop in with a soft overshoot
    const p = reducedMotion ? 1 : THREE.MathUtils.clamp((t - L.born - enterDelay) / 1.1, 0, 1);
    const enter = p <= 0 ? 0 : easeOutBack(p);
    const dropY = (1 - enter) * 9;

    // Idle float + breathing, hop on hover, bounce while talking
    const floatY = Math.sin(t * 1.3 + enterDelay * 3) * 0.08 * m;
    L.hop = damp(L.hop, L.att * 0.32 + L.think * 0.18, 5, dt);
    const talkBounce = Math.abs(Math.sin(t * 7.5)) * 0.07 * L.talk * m;
    const shakeX = Math.sin(t * 55) * 0.18 * L.shake;

    root.current.position.set(shakeX, dropY + floatY + L.hop + talkBounce, 0);
    root.current.scale.setScalar(0.55 + 0.45 * Math.min(1, enter));
    root.current.visible = p > 0;

    const breathe = 1 + Math.sin(t * 1.9 + enterDelay) * 0.012 * m;
    const squash = 1 - Math.abs(Math.sin(t * 7.5)) * 0.025 * L.talk * m;
    torso.current.scale.set(1 / Math.sqrt(squash * breathe), squash * breathe, 0.8 / Math.sqrt(squash * breathe));

    // Head follows the cursor
    let yaw = 0;
    let pitch = 0;
    if (lookAtPointer) {
      root.current.getWorldPosition(world);
      const px = (state.pointer.x * state.viewport.width) / 2;
      const py = (state.pointer.y * state.viewport.height) / 2;
      yaw = THREE.MathUtils.clamp((px - world.x) * 0.09, -0.6, 0.6);
      pitch = THREE.MathUtils.clamp(-(py - (world.y + HEAD_Y * 0.6)) * 0.05, -0.28, 0.28);
    }
    // Thinking: tilt + look up; talking: nod
    const thinkTilt = L.think * (0.2 + Math.sin(t * 0.9) * 0.06);
    const nod = Math.sin(t * 7.5) * 0.06 * L.talk * m;
    head.current.rotation.y = damp(head.current.rotation.y, yaw * (1 - L.think * 0.6), 5, dt);
    head.current.rotation.x = damp(head.current.rotation.x, pitch - L.think * 0.22 + nod, 6, dt);
    head.current.rotation.z = damp(head.current.rotation.z, thinkTilt, 4, dt);
    torso.current.rotation.y = damp(torso.current.rotation.y, yaw * 0.3, 3, dt);

    // Arms: gesture while talking, rise slightly on hover, hand-to-chin while thinking
    const gesture = (Math.sin(t * 5.2) * 0.5 + 0.5) * 0.55 * L.talk * m;
    armR.current.rotation.z = damp(armR.current.rotation.z, -0.32 - gesture - L.att * 0.2, 7, dt);
    armL.current.rotation.z = damp(armL.current.rotation.z, 0.32 + L.att * 0.2 + L.think * 0.9 + gesture * 0.4, 6, dt);
    armL.current.rotation.x = damp(armL.current.rotation.x, -L.think * 0.5, 6, dt);

    // Glossy body glows in the agent's light
    const pulse = 0.5 + 0.5 * Math.sin(t * 3);
    material.emissive.copy(glowColor).lerp(ERROR_RED, Math.min(1, L.err + L.shake));
    material.emissiveIntensity =
      L.att * 0.1 + L.talk * (0.06 + 0.08 * pulse) + L.think * (0.05 + 0.07 * pulse) + (L.err + L.shake) * 0.35;

    // Sound-wave rings around the head (speaking / answering)
    rings.current.forEach((r, i) => {
      if (!r) return;
      const ph = (t * 0.9 + i / 3) % 1;
      r.scale.setScalar(1.12 + ph * 1.2);
      (r.material as THREE.MeshBasicMaterial).opacity = (1 - ph) * (1 - ph) * 0.55 * L.talk;
      r.visible = L.talk > 0.01;
    });

    // Thinking: orbiting sparks + rotating halo
    orbit.current.rotation.y = t * 1.6;
    orbit.current.rotation.z = 0.35 + Math.sin(t * 0.7) * 0.1;
    orbit.current.scale.setScalar(Math.max(0.0001, L.think));
    orbit.current.visible = L.think > 0.01;
    halo.current.rotation.z = t * 0.8;
    halo.current.scale.setScalar(0.6 + 0.4 * L.think);
    (halo.current.material as THREE.MeshBasicMaterial).opacity = 0.75 * L.think;
    halo.current.visible = L.think > 0.01;

    // Floor light & contact shadow
    const lift = root.current.position.y;
    const gm = glow.current.material as THREE.MeshBasicMaterial;
    gm.opacity = Math.min(1, enter) * (0.22 + L.att * 0.35 + L.talk * 0.25 * (0.6 + 0.4 * pulse) + L.think * 0.3);
    glow.current.scale.setScalar(5.2 + L.att * 0.8 + L.think * 0.6);
    const sm = shadow.current.material as THREE.MeshBasicMaterial;
    sm.opacity = Math.min(1, enter) * 0.65 * THREE.MathUtils.clamp(1 - lift * 0.5, 0.25, 1);
    shadow.current.scale.setScalar(3.6 * THREE.MathUtils.clamp(1 - lift * 0.15, 0.7, 1));
  });

  return (
    <group position={position}>
      {/* Floor light pool in the agent's color */}
      <mesh ref={glow} rotation-x={-Math.PI / 2} position={[0, 0.005, 0]} renderOrder={-2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={radial} color={palette.glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      {/* Soft contact shadow */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, 0.01, 0]} renderOrder={-1}>
        <planeGeometry args={[1, 0.62]} />
        <meshBasicMaterial map={radial} color="#000000" transparent depthWrite={false} />
      </mesh>

      <group ref={root}>
        {/* Invisible hit volume for pointer events */}
        <mesh position={[0, FIGURE_HEIGHT / 2, 0]} onPointerOver={onPointerOver} onPointerOut={onPointerOut} onClick={onClick} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
          <cylinderGeometry args={[1.95, 1.95, FIGURE_HEIGHT + 0.2, 16]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
        </mesh>

        <group ref={torso}>
          <mesh geometry={geo.body} material={material} rotation-y={Math.PI} />
        </group>

        {/* Arms hug the body like in the original avatar, but can gesture */}
        <group ref={armR} position={[1.26, 2.12, 0.18]} rotation={[0, 0, -0.32]}>
          <mesh geometry={geo.arm} material={material} position={[0, -0.72, 0]} />
        </group>
        <group ref={armL} position={[-1.26, 2.12, 0.18]} rotation={[0, 0, 0.32]}>
          <mesh geometry={geo.arm} material={material} position={[0, -0.72, 0]} />
        </group>

        <group ref={head} position={[0, HEAD_Y, 0]}>
          <mesh geometry={geo.head} material={material} rotation-y={Math.PI} />

          {/* Speaking rings */}
          <Billboard>
            {[0, 1, 2].map((i) => (
              <mesh key={i} ref={(el) => (rings.current[i] = el)} visible={false}>
                <ringGeometry args={[0.98, 1.0, 96]} />
                <meshBasicMaterial color={palette.glow} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
              </mesh>
            ))}
          </Billboard>

          {/* Thinking halo above the head */}
          <mesh ref={halo} position={[0, 1.42, 0]} rotation-x={-Math.PI / 2} visible={false}>
            <torusGeometry args={[0.62, 0.035, 12, 96, Math.PI * 1.55]} />
            <meshBasicMaterial color={palette.glow} transparent opacity={0} toneMapped={false} />
          </mesh>

          {/* Thinking: orbiting sparks */}
          <group ref={orbit} visible={false}>
            {[0, 1, 2].map((i) => {
              const a = (i / 3) * Math.PI * 2;
              return (
                <mesh key={i} position={[Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55]}>
                  <sphereGeometry args={[0.085 + i * 0.02, 16, 16]} />
                  <meshBasicMaterial color={palette.glow} toneMapped={false} />
                </mesh>
              );
            })}
          </group>
          {mood === 'thinking' && (
            <Sparkles count={28} scale={[3.4, 3.2, 3.4]} size={3.2} speed={0.7} opacity={0.9} color={palette.glow} noise={1.2} />
          )}
        </group>

        {children}
      </group>
    </group>
  );
};
