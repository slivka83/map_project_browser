import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS, RAY_COUNT, computeCentralMeridianRays, type Vec3 } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Projection light beams: a fan along the central meridian from the globe
// centre (the light source) to the auxiliary surface. Pure geometry
// (computeCentralMeridianRays) is analytic, so rays render independently of
// whether the geo dataset has loaded. depthTest is disabled so the portion of
// each beam inside the globe stays visible through the globe shell.
export default function Rays({ params }: { params: ProjectionParams }) {
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
        />
      ))}
    </group>
  );
}
