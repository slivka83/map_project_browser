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
const DASH_SIZE = 0.6;
const GAP_SIZE = 0.4;

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
          <Line
            points={[seg.start, seg.globe, seg.end]}
            color={NEON_YELLOW}
            lineWidth={1.2}
            transparent
            opacity={0.85}
            depthTest={false}
            dashed
            dashSize={DASH_SIZE}
            gapSize={GAP_SIZE}
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
        <Line
          points={[hoverRay.start, hoverRay.globe, hoverRay.end]}
          color={NEON_YELLOW}
          lineWidth={2.4}
          transparent
          opacity={1}
          depthTest={false}
          dashed
          dashSize={DASH_SIZE * 1.25}
          gapSize={GAP_SIZE}
        />
      )}
    </group>
  );
}
