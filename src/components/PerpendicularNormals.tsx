import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NORMAL_COLOR } from '../constants/designTokens';
import { computePerpendicularNormals, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';

// Method 1: short perpendicular normals from globe points out to the surface.
export default function PerpendicularNormals({ surface }: { surface: AuxSurfaceParams }) {
  const normals = useMemo(() => computePerpendicularNormals(surface, 30), [surface]);
  return (
    <group renderOrder={8}>
      {normals.map((n, i) => (
        <Line key={i} points={[n.globePoint, n.surfacePoint]} color={NORMAL_COLOR} lineWidth={0.8} transparent opacity={0.6} />
      ))}
    </group>
  );
}
