import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { NEON_YELLOW } from '../constants/designTokens';
import { RADIUS, RAY_COUNT } from '../constants/geometry';
import { computeCentralMeridianRays, projectToAuxWorld, type RaySegment } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';
import { useAppStore } from '../store/useAppStore';

const MARKER_R = 0.13;

// Dashes are in world units (sphere radius = RADIUS); shared by every ray so
// the whole apparatus reads as one dashed beam family.
const DASH_SIZE = 0.32;
const GAP_SIZE = 0.22;

// One ray = ONE depth-tested dashed line (light source → globe point → aux
// surface). Depth testing matters: with it off (the old behaviour) the fan
// drew over everything, and from camera positions near the fan's plane the
// whole apparatus collapsed into a horizontal dashed streak laid across the
// visible land face — read as a dark tear just south of the Caspian. Now the
// beams hide behind the opaque land fill (and stay visible through the
// transparent ocean, matching the see-through far-side coastlines).
function RaySegments({ seg, lineWidth, opacity, dashScale = 1 }: { seg: RaySegment; lineWidth: number; opacity: number; dashScale?: number }) {
  return (
    <Line
      points={[seg.start, seg.globe, seg.end]}
      color={NEON_YELLOW}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
      dashed
      dashSize={DASH_SIZE * dashScale}
      gapSize={GAP_SIZE}
    />
  );
}

// The single projection visualization in the 3D scene: a dashed yellow fan of
// rays from the light source through the globe points onto the developable
// surface (always shown — no toggle), plus the cursor hover ray while the 2D
// map is hovered with the «Луч проекции» feature enabled.
export default function Rays({ params }: { params: ProjectionParams }) {
  const hoverLonLat = useAppStore((s) => s.hoverLonLat);
  const hoverSource = useAppStore((s) => s.hoverSource);
  const showHoverRay = useAppStore((s) => s.showHoverRay);

  const segments = useMemo<RaySegment[]>(
    () => computeCentralMeridianRays({ ...params, radius: RADIUS, rayCount: RAY_COUNT }),
    [params],
  );

  const showHover = hoverSource === 'map' && showHoverRay;
  const hoverRay = useMemo<RaySegment | null>(
    () => (showHover && hoverLonLat ? projectToAuxWorld(params, hoverLonLat[0], hoverLonLat[1], RADIUS) : null),
    [params, hoverLonLat, showHover],
  );

  return (
    <group renderOrder={10}>
      {segments.map((seg, i) => (
        <group key={i}>
          <RaySegments seg={seg} lineWidth={1.2} opacity={0.85} />
          <mesh position={seg.globe} renderOrder={11}>
            <sphereGeometry args={[MARKER_R, 12, 12]} />
            <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
          </mesh>
          <mesh position={seg.end} renderOrder={11}>
            <sphereGeometry args={[MARKER_R, 12, 12]} />
            <meshBasicMaterial color={NEON_YELLOW} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {hoverRay && (
        <RaySegments seg={hoverRay} lineWidth={2.4} opacity={1} dashScale={1.25} />
      )}
    </group>
  );
}
