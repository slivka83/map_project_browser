import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_BLUE, NEON_YELLOW } from '../constants/designTokens';
import { lonLatToVec3 } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';

// Method 7: geometric construction — shows the key straight-edge / compass
// lines of the projection build. Simplified to the central axis + a few
// construction rays through representative latitudes.
export default function GeometricConstruction() {
  const lines = useMemo(() => {
    const out: [number, number, number][][] = [];
    const axis: [number, number, number][] = [
      [0, -RADIUS * 1.4, 0],
      [0, RADIUS * 1.4, 0],
    ];
    out.push(axis);
    for (const lat of [-45, 0, 45]) {
      const a = lonLatToVec3(0, lat, RADIUS);
      const b = lonLatToVec3(0, lat, RADIUS * 1.3);
      out.push([a, b]);
    }
    return out;
  }, []);
  return (
    <group renderOrder={8}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={i === 0 ? NEON_BLUE : NEON_YELLOW} lineWidth={0.8} transparent opacity={0.5} />
      ))}
    </group>
  );
}
