import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { useAppStore } from '../store/useAppStore';
import {
  RADIUS,
  RAY_COUNT,
  lonLatToVec3,
  computeCentralMeridianRays,
  type Vec3,
} from '../utils/rayGeometry';
import type { FeatureCollection, Geometry } from 'geojson';

const NEON_BLUE = '#00e5ff';
const NEON_ORANGE = '#ff6a00';

// --- Globe: transparent dark sphere + neon 3D graticule + coastlines ---

function GlobeShell() {
  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshBasicMaterial
        color="#05050A"
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Graticule() {
  const lines = useMemo<Vec3[][]>(() => {
    const out: Vec3[][] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      const pts: Vec3[] = [];
      for (let lat = -90; lat <= 90; lat += 3) pts.push(lonLatToVec3(lon, lat));
      out.push(pts);
    }
    for (const lat of [-60, -30, 0, 30, 60]) {
      const pts: Vec3[] = [];
      for (let lon = -180; lon <= 180; lon += 3) pts.push(lonLatToVec3(lon, lat));
      out.push(pts);
    }
    return out;
  }, []);

  return (
    <group>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color={NEON_BLUE} lineWidth={0.6} transparent opacity={0.28} />
      ))}
    </group>
  );
}

function Coastlines({ geoJson }: { geoJson: FeatureCollection }) {
  const rings = useMemo<Vec3[][]>(() => {
    const out: Vec3[][] = [];
    const collect = (geom: Geometry) => {
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates) out.push(ring.map(([lon, lat]) => lonLatToVec3(lon, lat, RADIUS * 1.002)));
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          for (const ring of poly) out.push(ring.map(([lon, lat]) => lonLatToVec3(lon, lat, RADIUS * 1.002)));
        }
      }
    };
    for (const f of geoJson.features) {
      if (f.geometry) collect(f.geometry);
    }
    return out;
  }, [geoJson]);

  return (
    <group>
      {rings.map((pts, i) => (
        <Line key={i} points={pts} color={NEON_BLUE} lineWidth={1} transparent opacity={0.95} />
      ))}
    </group>
  );
}

// --- Auxiliary (developable) surface, sized by scaleFactor (immersion) ---

function AuxSurface({
  family,
  lambda0,
  phiOrigin,
  scaleFactor,
}: {
  family: 'cylindrical' | 'conic' | 'azimuthal';
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
}) {
  const lonRad = (lambda0 * Math.PI) / 180;
  const material = (
    <meshBasicMaterial color={NEON_ORANGE} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
  );

  if (family === 'cylindrical') {
    const r = RADIUS * scaleFactor;
    return (
      <mesh rotation={[0, lonRad, 0]}>
        <cylinderGeometry args={[r, r, 2.6 * RADIUS, 64, 1, true]} />
        {material}
      </mesh>
    );
  }

  if (family === 'azimuthal') {
    const center = lonLatToVec3(lambda0, phiOrigin, RADIUS);
    const normal = new THREE.Vector3(center[0], center[1], center[2]).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const size = 2.6 * RADIUS * scaleFactor;
    return (
      <mesh position={center} quaternion={quat}>
        <planeGeometry args={[size, size]} />
        {material}
      </mesh>
    );
  }

  // conic: cone tangent to the sphere at latitude phiOrigin. Magnitude so a
  // southern phiOrigin produces a cone that points south (consistent with rays).
  const spDeg = Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin);
  const sp = spDeg * (Math.PI / 180);
  const apex = RADIUS / Math.sin(sp);
  const yBase = -0.35 * RADIUS;
  const height = apex - yBase;
  const radius = scaleFactor * (apex - yBase) * Math.tan(sp);
  const flip = phiOrigin < 0 ? -1 : 1;
  return (
    <mesh position={[0, flip * (apex - height / 2), 0]} scale={[1, flip, 1]}>
      <coneGeometry args={[radius, height, 64, 1, true]} />
      {material}
    </mesh>
  );
}

// --- Tangency rings (standard parallel highlighted on the aux figure) ---

function circlePoints(radius: number, y: number, segments = 96): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push([radius * Math.cos(t), y, radius * Math.sin(t)]);
  }
  return pts;
}

function TangencyRings({
  family,
  lambda0,
  phiOrigin,
  scaleFactor,
}: {
  family: 'cylindrical' | 'conic' | 'azimuthal';
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
}) {
  const lonRad = (lambda0 * Math.PI) / 180;

  if (family === 'azimuthal') {
    const center = lonLatToVec3(lambda0, phiOrigin, RADIUS);
    const normal = new THREE.Vector3(center[0], center[1], center[2]).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    const r = 0.45 * RADIUS * scaleFactor;
    const ring: Vec3[] = [];
    for (let i = 0; i <= 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      ring.push([r * Math.cos(t), r * Math.sin(t), 0]);
    }
    return (
      <group position={center} quaternion={quat}>
        <Line points={ring} color={NEON_ORANGE} lineWidth={2} />
      </group>
    );
  }

  const rings: { pts: Vec3[]; rotate: boolean }[] = [];

  if (family === 'conic') {
    const spDeg = Math.abs(phiOrigin) < 10 ? 30 : Math.abs(phiOrigin);
    const sp = spDeg * (Math.PI / 180);
    const latRad = (phiOrigin * Math.PI) / 180;
    const y = RADIUS * Math.sin(latRad);
    // tangency ring radius = sphere radius at the tangent latitude (= cone radius there)
    const rCone = scaleFactor * RADIUS * Math.cos(sp);
    rings.push({ pts: circlePoints(rCone, y), rotate: false });
  } else {
    const latRad = (phiOrigin * Math.PI) / 180;
    rings.push({ pts: circlePoints(RADIUS * scaleFactor, RADIUS * Math.sin(latRad)), rotate: true });
  }

  return (
    <group>
      {rings.map((ring, i) => (
        <group key={i} rotation={ring.rotate ? [0, lonRad, 0] : [0, 0, 0]}>
          <Line points={ring.pts} color={NEON_ORANGE} lineWidth={2} />
        </group>
      ))}
    </group>
  );
}

// --- Projection rays: a fan for the central meridian, globe -> aux surface ---

function Rays({
  family,
  distortion,
  lambda0,
  phiOrigin,
  scaleFactor,
  falseEasting,
  falseNorthing,
  geoJson,
}: {
  family: 'cylindrical' | 'conic' | 'azimuthal';
  distortion: 'conformal' | 'equalArea' | 'equidistant';
  lambda0: number;
  phiOrigin: number;
  scaleFactor: number;
  falseEasting: number;
  falseNorthing: number;
  geoJson: FeatureCollection | null;
}) {
  const segments = useMemo<[Vec3, Vec3][]>(() => {
    if (!geoJson) return [];
    return computeCentralMeridianRays({
      family,
      distortion,
      lambda0,
      phiOrigin,
      scaleFactor,
      falseEasting,
      falseNorthing,
      radius: RADIUS,
      rayCount: RAY_COUNT,
    });
  }, [family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, geoJson]);

  return (
    <group>
      {segments.map(([start, end], i) => (
        <Line key={i} points={[start, end]} color={NEON_ORANGE} lineWidth={1} transparent opacity={0.55} />
      ))}
    </group>
  );
}

export default function GlobeScene() {
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phiOrigin = useAppStore((s) => s.phiOrigin);
  const scaleFactor = useAppStore((s) => s.scaleFactor);
  const falseEasting = useAppStore((s) => s.falseEasting);
  const falseNorthing = useAppStore((s) => s.falseNorthing);
  const geoJson = useAppStore((s) => s.geoJsonData);

  return (
    <Canvas camera={{ position: [0, 5, 42], fov: 50 }} className="rounded-lg">
      <ambientLight intensity={0.8} />
      <group>
        <GlobeShell />
        {geoJson && <Coastlines geoJson={geoJson} />}
        <Graticule />
      </group>
      <AuxSurface family={family} lambda0={lambda0} phiOrigin={phiOrigin} scaleFactor={scaleFactor} />
      <TangencyRings family={family} lambda0={lambda0} phiOrigin={phiOrigin} scaleFactor={scaleFactor} />
      <Rays
        family={family}
        distortion={distortion}
        lambda0={lambda0}
        phiOrigin={phiOrigin}
        scaleFactor={scaleFactor}
        falseEasting={falseEasting}
        falseNorthing={falseNorthing}
        geoJson={geoJson}
      />
    </Canvas>
  );
}
