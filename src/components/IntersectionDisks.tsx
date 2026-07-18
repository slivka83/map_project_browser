import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_GREEN } from '../constants/designTokens';
import { computeAuxSphereIntersections, auxPointToWorld, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow neon-green rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn. Every ring is pushed through `auxPointToWorld`,
// the exact transform the aux-surface wireframe uses, so the ring always sits on
// the REAL intersection of the (possibly tilted) surface with the globe. A
// cylinder tilts with its axis, so its intersection circles MOVE when the tilt
// (gamma) changes — exactly like the 3D tube does.
export default function IntersectionDisks({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2 } = params;
  const circles = useMemo(() => {
    const raw = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2);
    // Кольцо azimuthal уже построено в мировых координатах (на сфере, в точке
    // касания), поэтому повторно через auxPointToWorld его прогонять нельзя —
    // иначе оно съезжает. У cylinder/cone точки локальные, их переводим.
    return raw.map((ring) =>
      ring.map((p) => (surface.kind === 'plane' ? p : auxPointToWorld(surface, p))),
    );
  }, [family, lambda0, phiOrigin, scaleFactor, stdParallel2, surface]);

  if (circles.length === 0) return null;

  return (
    <group renderOrder={9}>
      {circles.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={NEON_GREEN}
          lineWidth={1.5}
          transparent
          opacity={0.95}
          depthTest={false}
        />
      ))}
    </group>
  );
}
