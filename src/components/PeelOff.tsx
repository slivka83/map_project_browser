import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NEON_BLUE } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import { useAppStore } from '../store/useAppStore';

// Method 4: "peeling the skin" — a translucent sphere that, while the unfold
// is triggered, morphs outward toward the aux surface. Simplified: the sphere
// gently pulses; unfoldTrigger makes it brighter and bigger.
export default function PeelOff() {
  const unfold = useAppStore((s) => s.unfoldTrigger);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    const s = 1.0 + (unfold ? 0.12 + 0.04 * Math.sin(t * 3) : 0.02 * Math.sin(t));
    meshRef.current.scale.setScalar(s);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[RADIUS * 1.001, 48, 48]} />
      <meshBasicMaterial color={NEON_BLUE} transparent opacity={unfold ? 0.4 : 0.22} depthWrite={false} />
    </mesh>
  );
}
