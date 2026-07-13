import * as THREE from 'three';
import { NEON_YELLOW } from '../constants/designTokens';

// The "light source" of the projection: a glowing yellow core at the globe
// centre. The projection rays emanate from here (computeCentralMeridianRays
// starts at the origin), so visually the beams are thrown from this point onto
// the auxiliary surface.
export default function LightSource() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.55, 24, 24]} />
        <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.7, 24, 24]} />
        <meshBasicMaterial
          color={NEON_YELLOW}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
