import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeAuxSphereIntersections, computeAuxSurfaceParams, auxPointToWorld } from '../utils/auxSurfaceGeometry';
import { RADIUS } from '../constants/geometry';
import type { ProjectionParams } from '../store/useAppStore';

// Hollow white neon rings marking where the auxiliary surface meets the globe.
// The rings are the actual intersection circles (computed analytically), so the
// surface can touch the globe in one place, two places, or not at all — in the
// last case nothing is drawn. Every ring is pushed through `auxPointToWorld`,
// the exact transform the aux-surface wireframe uses, so the ring always sits on
// the REAL intersection of the (possibly tilted) surface with the globe. A
// cylinder tilts with its axis, so its intersection circles MOVE when the tilt
// (gamma) changes — exactly like the 3D tube does.
export default function IntersectionDisks({ params }: { params: ProjectionParams }) {
  const { family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight } = params;
  const surface = useMemo(
    () => computeAuxSurfaceParams(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2, gamma, distortion, azLight),
    [family, lambda0, phiOrigin, scaleFactor, stdParallel2, gamma, distortion, azLight],
  );
  const circles = useMemo(() => {
    const raw = computeAuxSphereIntersections(family, lambda0, phiOrigin, scaleFactor, RADIUS, stdParallel2);
    // Azimuthal tangent point and cone/cylinder rings all live in the surface's
    // local frame and are tilted by `auxPointToWorld` (the wireframe's transform).
    return raw.map((ring) => ring.map((p) => auxPointToWorld(surface, p)));
  }, [family, lambda0, phiOrigin, scaleFactor, stdParallel2, surface]);

  if (circles.length === 0) return null;

  return (
    <group renderOrder={9}>
      {circles.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={NEON_WHITE}
          lineWidth={1.5}
          transparent
          opacity={0.95}
          depthTest={false}
        />
      ))}
    </group>
  );
}
