import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { computeMagneticFieldLines, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Method 3: curved magnetic field lines arcing from the globe toward the aux
// surface (purely illustrative of the "pull" of the projection).
export default function MagneticField({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const lines = useMemo(
    () => computeMagneticFieldLines(surface, params.family, 16),
    [surface, params.family],
  );
  return (
    <group renderOrder={8}>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.6} />
      ))}
    </group>
  );
}
