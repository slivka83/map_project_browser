import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS, RAY_COUNT } from '../constants/geometry';
import { computeCentralMeridianRays, type Vec3 } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Projection light beams: a fan along the central meridian from the globe
// centre / cone apex / rod (the light source) to the auxiliary surface. Pure
// geometry (computeCentralMeridianRays) is analytic, so rays render
// independently of whether the geo dataset has loaded. depthTest is disabled so
// the portion of each beam inside the globe stays visible through the globe
// shell. In `math` mode the light is switched off and the beams are drawn as
// dashed formula vectors (docs/new_spec.md §3).
export default function Rays({ params }: { params: ProjectionParams }) {
  const { family, azLight, cylLight } = params;
  const dashed = family === 'azimuthal' ? azLight === 'math' : cylLight === 'math';
  const segments = useMemo<[Vec3, Vec3][]>(
    () =>
      computeCentralMeridianRays({
        ...params,
        radius: RADIUS,
        rayCount: RAY_COUNT,
      }),
    [params],
  );

  return (
    <group renderOrder={10}>
      {segments.map(([start, end], i) => (
        <Line
          key={i}
          points={[start, end]}
          color={NEON_YELLOW}
          lineWidth={1.2}
          transparent
          opacity={0.85}
          depthTest={false}
          dashed={dashed}
          dashSize={0.6}
          gapSize={0.4}
        />
      ))}
    </group>
  );
}
