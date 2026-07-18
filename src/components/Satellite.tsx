import { NEON_YELLOW } from '../constants/designTokens';
import type { Vec3 } from '../utils/auxSurfaceGeometry';

// Marker for the satellite / observer eye in a vertical/tilted perspective
// projection. Optionally animated (orbits via useFrame in the caller).
export default function Satellite({ position }: { position: Vec3 }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.1, 24, 24]} />
        <meshBasicMaterial color={NEON_YELLOW} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>
  );
}
