import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_ORANGE } from '../constants/designTokens';
import { RADIUS, RAY_COUNT, computeCentralMeridianRays, type Vec3 } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Projection rays: a fan along the central meridian, globe -> aux surface.
// Pure geometry (computeCentralMeridianRays) is analytic, so rays render
// independently of whether the geo dataset has loaded.
export default function Rays({
  family,
  distortion,
  lambda0,
  phiOrigin,
  scaleFactor,
  falseEasting,
  falseNorthing,
}: {
  family: ProjectionParams['family'];
  distortion: ProjectionParams['distortion'];
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
  falseEasting: number;
  falseNorthing: number;
}) {
  const segments = useMemo<[Vec3, Vec3][]>(
    () =>
      computeCentralMeridianRays({
        family,
        distortion,
        lambda0,
        phiOrigin,
        scaleFactor,
        falseEasting,
        falseNorthing,
        radius: RADIUS,
        rayCount: RAY_COUNT,
      }),
    [family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing],
  );

  return (
    <group>
      {segments.map(([start, end], i) => (
        <Line key={i} points={[start, end]} color={NEON_ORANGE} lineWidth={1} transparent opacity={0.55} />
      ))}
    </group>
  );
}
