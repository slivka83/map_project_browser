import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS, RAY_COUNT } from '../constants/geometry';
import { computeCentralMeridianRays, projectToAuxWorld, type RaySegment } from '../utils/auxSurfaceGeometry';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import type { ProjectionParams } from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';

const MARKER_R = 0.13;

export default function Rays({ params }: { params: ProjectionParams }) {
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const showHoverRay = useAppStore((s) => s.showHoverRay);

  const def = useMemo(
    () => variantDef(params.variant ?? defaultVariant(params.family)),
    [params.variant, params.family],
  );

  const segments = useMemo<RaySegment[]>(
    () =>
      computeCentralMeridianRays({
        ...params,
        radius: RADIUS,
        rayCount: RAY_COUNT,
      }),
    [params],
  );

  const showHover = hoverSource === 'map' && showHoverRay;
  const hoverRay = useMemo<RaySegment | null>(
    () => (showHover && hoverLonLat ? projectToAuxWorld(params, hoverLonLat[0], hoverLonLat[1], RADIUS) : null),
    [params, hoverLonLat, showHover],
  );

  if (!def.hasRays) return null;

  return (
    <group renderOrder={10}>
      {segments.map((seg, i) => (
        <group key={i}>
          <Line
            points={[seg.start, seg.globe, seg.end]}
            color={NEON_YELLOW}
            lineWidth={1.2}
            transparent
            opacity={0.85}
            depthTest={false}
          />
          <mesh position={seg.globe} renderOrder={11}>
            <sphereGeometry args={[MARKER_R, 12, 12]} />
            <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} depthTest={false} />
          </mesh>
          <mesh position={seg.end} renderOrder={11}>
            <sphereGeometry args={[MARKER_R, 12, 12]} />
            <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} depthTest={false} />
          </mesh>
        </group>
      ))}
      {hoverRay && (
        <group>
          <Line
            points={[hoverRay.start, hoverRay.globe, hoverRay.end]}
            color={NEON_YELLOW}
            lineWidth={2.4}
            transparent
            opacity={1}
            depthTest={false}
          />
        </group>
      )}
    </group>
  );
}
