import * as THREE from 'three';
import React from 'react';
import { useFrame } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
export { usePrefersReducedMotion, useCanHover } from './support';

/** Studio lighting: a wide soft box overhead gives the glossy highlights of the original avatars. No network assets. */
export const StageLights: React.FC = () => (
  <>
    <hemisphereLight args={['#ffffff', '#20232b', 0.9]} />
    <directionalLight position={[-5, 8, 8]} intensity={1.6} />
    <directionalLight position={[6, 4, -6]} intensity={1.2} color="#a9bcff" />
    <directionalLight position={[-6, 3, -5]} intensity={0.6} color="#ffd2c4" />
    <Environment resolution={256} frames={1}>
      {/* Small top-left softbox → the round glossy highlight on head & shoulders, like the original avatars */}
      <Lightformer form="circle" intensity={4} position={[-4, 6, 6]} scale={2.6} target={[0, 2, 0]} />
      <Lightformer form="circle" intensity={1.0} position={[5, 5, 5]} scale={1.6} target={[0, 2, 0]} />
      <Lightformer form="rect" intensity={0.5} position={[-8, 1, -3]} scale={[2, 6, 1]} target={[0, 2, 0]} />
      <Lightformer form="rect" intensity={0.5} position={[8, 1, -3]} scale={[2, 6, 1]} target={[0, 2, 0]} />
      <Lightformer form="ring" intensity={0.8} position={[0, 3, -8]} scale={7} color="#b8c6ff" />
    </Environment>
  </>
);

/** Gentle camera parallax that follows the cursor. */
export const CameraRig: React.FC<{ target: [number, number, number]; strength?: number; base: [number, number, number] }> = ({
  target,
  base,
  strength = 0.8,
}) => {
  const [tx, ty, tz] = target;
  const look = React.useMemo(() => new THREE.Vector3(tx, ty, tz), [tx, ty, tz]);
  useFrame((state, dt) => {
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, base[0] + state.pointer.x * strength, 2.5, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, base[1] + state.pointer.y * strength * 0.4, 2.5, dt);
    cam.position.z = base[2];
    cam.lookAt(look);
  });
  return null;
};

export const configureRenderer = ({ gl }: { gl: THREE.WebGLRenderer }) => {
  gl.toneMapping = THREE.NeutralToneMapping;
  gl.toneMappingExposure = 1.2;
};

