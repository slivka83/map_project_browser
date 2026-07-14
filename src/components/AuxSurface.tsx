import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { RADIUS } from '../constants/geometry';
import { computeAuxSurfaceParams, computeAuxGraticule, auxPointToWorld, type Vec3 } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Auxiliary (developable) surface, drawn as a fully transparent neon wireframe
// of its own meridians and parallels (orange, matching the aux-surface palette).
// Geometry comes from the single source of truth in auxSurfaceGeometry and is
// pushed through `auxPointToWorld` — the exact transform the rays use — so the
// wireframe and the light rays can never drift apart.
export default function AuxSurface({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, distortion, azLight, cylLight, stdParallel2, gamma } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, gamma, distortion, azLight, cylLight),
    [family, lambda0, phiOrigin, scaleFactor, distortion, azLight, cylLight, stdParallel2, gamma],
  );
  const { meridians, parallels } = useMemo(
    () => computeAuxGraticule(surface),
    [surface],
  );

  const toWorld = useMemo(() => (p: Vec3): Vec3 => auxPointToWorld(surface, p), [surface]);

  return (
    <group>
      {parallels.map((pts, i) => (
        <Line key={`p${i}`} points={pts.map(toWorld)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
      {meridians.map((pts, i) => (
        <Line key={`m${i}`} points={pts.map(toWorld)} color={NEON_ORANGE} lineWidth={0.8} transparent opacity={0.5} />
      ))}
    </group>
  );
}
