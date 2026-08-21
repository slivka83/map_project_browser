import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { matVec, type Vec3, type AuxSurfaceParams } from '../utils/auxSurfaceGeometry';
import { NEON_BLUE, NEON_ORANGE, NEON_YELLOW } from '../constants/designTokens';

const LEN = 1.5; // axis half-length as a multiple of the globe radius

function cylAxis(surface: AuxSurfaceParams): Vec3 {
  const cyl = surface as Extract<AuxSurfaceParams, { kind: 'cylinder' }>;
  const a = matVec(cyl.orient, [0, 1, 0]);
  const len = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

// For the cylindrical family: draws Earth's fixed polar axis (blue), the
// cylinder's axis (orange, tilted by the central latitude φ₀), and the angle
// arc (yellow) between them with a live degree read-out. This makes the effect
// of the «Параллель 1» slider visible in 3D: the cylinder axis leaves Earth's
// pole by exactly φ₀, which is what bows the 2D map's parallels.
export default function AxesIndicator({ surface, radius }: { surface: AuxSurfaceParams; radius: number }) {
  const { earthLine, cylLine, arc, angleDeg, labelPos } = useMemo(() => {
    const earth: Vec3 = [0, 1, 0];
    const cyl = cylAxis(surface);
    const earthEnd: Vec3 = [0, radius * LEN, 0];
    const cylEnd: Vec3 = [cyl[0] * radius * LEN, cyl[1] * radius * LEN, cyl[2] * radius * LEN];
    const earthLine: [Vec3, Vec3] = [[0, -earthEnd[1], 0], earthEnd];
    const cylLine: [Vec3, Vec3] = [[-cylEnd[0], -cylEnd[1], -cylEnd[2]], cylEnd];

    const arcR = radius * 0.55;
    const N = 28;
    const pts: Vec3[] = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = earth[0] * (1 - t) + cyl[0] * t;
      const y = earth[1] * (1 - t) + cyl[1] * t;
      const z = earth[2] * (1 - t) + cyl[2] * t;
      const len = Math.hypot(x, y, z) || 1;
      pts.push([(x / len) * arcR, (y / len) * arcR, (z / len) * arcR]);
    }
    const dot = Math.max(-1, Math.min(1, earth[0] * cyl[0] + earth[1] * cyl[1] + earth[2] * cyl[2]));
    const angleDeg = Math.acos(dot) * (180 / Math.PI);
    const labelPos = pts[Math.floor(pts.length / 2)];
    return { earthLine, cylLine, arc: pts, angleDeg, labelPos };
  }, [surface, radius]);

  return (
    <group>
      <Line points={earthLine} color={NEON_BLUE} lineWidth={1.5} transparent opacity={0.55} dashed dashSize={0.6} gapSize={0.4} />
      <Line points={cylLine} color={NEON_ORANGE} lineWidth={2.2} transparent opacity={0.95} />
      <Line points={arc} color={NEON_YELLOW} lineWidth={2} transparent opacity={0.95} />
      <Html position={[labelPos[0], labelPos[1], labelPos[2]]} center style={{ pointerEvents: 'none' }}>
        <div
          style={{
            color: '#ffe600',
            fontSize: 12,
            whiteSpace: 'nowrap',
            fontFamily: 'monospace',
            textShadow: '0 0 4px #000, 0 0 4px #000',
          }}
        >
          {angleDeg.toFixed(0)}°
        </div>
      </Html>
    </group>
  );
}
