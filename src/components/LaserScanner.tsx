import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { LASER_COLOR } from '../constants/designTokens';
import { computeLaserScanRing, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import type { ProjectionParams } from '../store/useAppStore';

// Method 6: a rotating laser scanner — a ring at a latitude that sweeps the
// globe from -85° to +85°, with the projected ring drawn on the aux surface.
export default function LaserScanner({
  surface,
  params,
}: {
  surface: AuxSurfaceParams;
  params: ProjectionParams;
}) {
  const latRef = useRef(-85);
  useFrame((_, dt) => {
    latRef.current += dt * 20;
    if (latRef.current > 85) latRef.current = -85;
  });
  const frame = computeLaserScanRing(surface, latRef.current, params, 64);
  return (
    <group renderOrder={8}>
      <Line points={frame.ringPoints} color={LASER_COLOR} lineWidth={1.2} transparent opacity={0.85} />
      <Line points={frame.projectedPoints} color={LASER_COLOR} lineWidth={1} transparent opacity={0.5} />
    </group>
  );
}
