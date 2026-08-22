import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_WHITE } from '../constants/designTokens';
import { computeCutLine, type Vec3, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// White neon line marking the seam where the developable surface is cut open
// and unrolled onto the 2D map (cylindrical / conic families only). Rendered
// only while the «Линии пересечения» toggle is on — the same flag that drives
// the intersection rings and the 2D line layers.
export default function CutLine({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const points = useMemo<Vec3[]>(() => {
    if (surface.kind === 'cylinder' || surface.kind === 'cone') {
      return computeCutLine(surface, params.lambda0, params.family, 64);
    }
    return [];
  }, [surface, params.lambda0, params.family]);

  if (points.length === 0) return null;

  return (
    <group renderOrder={9}>
      <Line points={points} color={NEON_WHITE} lineWidth={1.6} transparent opacity={0.95} depthTest={false} />
    </group>
  );
}
