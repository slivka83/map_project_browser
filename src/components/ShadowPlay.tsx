import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { lonLatToVec3 } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';

// Method 8: shadow play — a few directional light sources around the globe and
// their shadow rays cast onto the (implicit) aux surface. Simplified: draws the
// shadow rays as straight lines from the globe rim outward.
export default function ShadowPlay() {
  const rays = useMemo(() => {
    const out: [number, number, number][][] = [];
    for (let i = 0; i < 3; i++) {
      const lon = -120 + i * 120;
      const a = lonLatToVec3(lon, 0, RADIUS);
      const b = lonLatToVec3(lon, 0, RADIUS * 1.35);
      out.push([a, b]);
    }
    return out;
  }, []);
  return (
    <group renderOrder={8}>
      {rays.map((pts, i) => (
        <Line key={i} points={pts} color={NEON_YELLOW} lineWidth={1} transparent opacity={0.4} />
      ))}
    </group>
  );
}
