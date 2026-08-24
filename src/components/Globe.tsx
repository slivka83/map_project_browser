import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { GLOBE_COASTLINE, BG } from '../constants/designTokens';
import { RADIUS, GLOBE_INFLATE } from '../constants/geometry';
import { lonLatToVec3, matVec, type Mat3 } from '../utils/auxSurfaceGeometry';
import type { FeatureCollection, Geometry } from 'geojson';

function GlobeShell({
  onPointerMove,
  onPointerOut,
}: {
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  // The shell doubles as the hover hit-surface: the handlers ride the SAME
  // mesh that is drawn, so no second invisible sphere geometry is needed.
  return (
    <mesh onPointerMove={onPointerMove} onPointerOut={onPointerOut}>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshBasicMaterial
        color={BG}
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

function Coastlines({ geoJson, roll }: { geoJson: FeatureCollection; roll: Mat3 }) {
  // Collect every coastline ring, then flatten all of them into a single
  // LineSegments geometry (consecutive vertex pairs = one segment). This draws
  // the whole 110m coastline in ONE draw call instead of one <Line> per ring
  // (hundreds of draw calls), which matters once a denser 50m dataset is used.
  //
  // The GEOGRAPHY LAYER rolls inside the static graduated cylinder: every
  // vertex is transformed by the Долгота/Параллель rotation matrix (the same
  // rigid rotation the flat two-layer map applies), so the continents move on
  // the globe exactly as they slide on the map.
  const segments = useMemo<Float32Array>(() => {
    const verts: number[] = [];
    const pushRing = (ring: [number, number][]) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = matVec(roll, lonLatToVec3(ring[i][0], ring[i][1], RADIUS * GLOBE_INFLATE));
        const b = matVec(roll, lonLatToVec3(ring[i + 1][0], ring[i + 1][1], RADIUS * GLOBE_INFLATE));
        verts.push(a[0], a[1], a[2], b[0], b[1], b[2]);
      }
    };
    const collect = (geom: Geometry) => {
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates) pushRing(ring as [number, number][]);
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) for (const ring of poly) pushRing(ring as [number, number][]);
      }
    };
    for (const f of geoJson.features) if (f.geometry) collect(f.geometry);
    return new Float32Array(verts);
  }, [geoJson, roll]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[segments, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={GLOBE_COASTLINE} transparent opacity={0.95} />
    </lineSegments>
  );
}

export default function Globe({
  geoJson,
  roll,
  onPointerMove,
  onPointerOut,
}: {
  geoJson: FeatureCollection | null;
  roll: Mat3;
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
}) {
  // `roll` is the rigid Долгота/Параллель rotation of the geography layer,
  // computed once in GlobeScene and shared with the hover marker so every
  // consumer rides the same rolled Earth.
  return (
    <group>
      <GlobeShell onPointerMove={onPointerMove} onPointerOut={onPointerOut} />
      {geoJson && <Coastlines geoJson={geoJson} roll={roll} />}
    </group>
  );
}
