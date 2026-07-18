import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NORMAL_COLOR } from '../constants/designTokens';
import { computePerpendicularNormals, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Method 1: short perpendicular normals from globe points out to the surface.
export default function PerpendicularNormals({ surface, params }: { surface: AuxSurfaceParams; params: ProjectionParams }) {
  const normals = useMemo(() => computePerpendicularNormals(surface, params, 30), [surface, params]);
  return (
    <group renderOrder={8}>
      {normals.map((n, i) => (
        <Line key={i} points={[n.globePoint, n.surfacePoint]} color={NORMAL_COLOR} lineWidth={0.8} transparent opacity={0.6} />
      ))}
    </group>
  );
}
