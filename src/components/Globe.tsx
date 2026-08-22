import { useMemo } from 'react';
import * as THREE from 'three';
import { NEON_BLUE, BG } from '../constants/designTokens';
import { RADIUS, GLOBE_INFLATE } from '../constants/geometry';
import { lonLatToVec3, projectionRotationMatrix, matVec, type Mat3 } from '../utils/auxSurfaceGeometry';
import type { FeatureCollection, Geometry } from 'geojson';

function GlobeShell() {
  return (
    <mesh>
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
      <lineBasicMaterial color={NEON_BLUE} transparent opacity={0.95} />
    </lineSegments>
  );
}

export default function Globe({ geoJson, lambda0 = 0, phiOrigin = 0 }: { geoJson: FeatureCollection | null; lambda0?: number; phiOrigin?: number }) {
  // The rigid roll of the geography layer: the same rotation the flat map
  // applies via .rotate([-lambda0, -phiOrigin, 0]).
  const roll = useMemo(() => projectionRotationMatrix(-lambda0, -phiOrigin, 0), [lambda0, phiOrigin]);
  return (
    <group>
      <GlobeShell />
      {geoJson && <Coastlines geoJson={geoJson} roll={roll} />}
    </group>
  );
}
