import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS, RAY_COUNT } from '../constants/geometry';
import { computeCentralMeridianRays, projectToAuxWorld, type RaySegment } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';

const MARKER_R = 0.13;

// Projection light beams. The central-meridian fan runs from the light source,
// marks the point it passes through on the globe, and lands on the auxiliary
// (developable) surface — the unrolled surface IS the 2D map, so the landing
// points are where those globe points end up on the map. A brighter ray is
// drawn for the point currently hovered (in either the 3D globe or the 2D map),
// making the "globe point → map point" link explicit. `math` mode (no physical
// light) draws the beams as dashed formula vectors (docs/specification.md §3).
export default function Rays({ params }: { params: ProjectionParams }) {
  const { family, azLight } = params;
  const dashed = family === 'azimuthal' && azLight === 'math';
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const showHoverRay = useAppStore((s) => s.showHoverRay);

  const segments = useMemo<RaySegment[]>(
    () =>
      computeCentralMeridianRays({
        ...params,
        radius: RADIUS,
        rayCount: RAY_COUNT,
      }),
    [params],
  );

  // The hover ray is shown only when the cursor is over the 2D map (not the 3D
  // globe) and the feature is enabled — the globe still mirrors the highlight
  // marker, it just does not draw the projection ray.
  const showHover = hoverSource === 'map' && showHoverRay;
  const hoverRay = useMemo<RaySegment | null>(
    () => (showHover && hoverLonLat ? projectToAuxWorld(params, hoverLonLat[0], hoverLonLat[1], RADIUS) : null),
    [params, hoverLonLat, showHover],
  );

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
            dashed={dashed}
            dashSize={0.6}
            gapSize={0.4}
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
            dashed={dashed}
            dashSize={0.6}
            gapSize={0.4}
          />
        </group>
      )}
    </group>
  );
}
