import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WAVE_COLOR } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';

// Method 5: an expanding translucent wave emanating from the globe, resetting
// once it passes the aux-surface distance — the "ripple" of projection.
export default function WaveProjection() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = (state.clock.elapsedTime % 3) / 3;
    meshRef.current.scale.setScalar(1 + t * 1.5);
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.18 * (1 - t);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[RADIUS, 48, 48]} />
      <meshBasicMaterial color={WAVE_COLOR} transparent opacity={0.18} depthWrite={false} />
    </mesh>
  );
}
