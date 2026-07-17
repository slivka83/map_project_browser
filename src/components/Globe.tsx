import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { NEON_BLUE, BG } from '../constants/designTokens';
import { RADIUS, GLOBE_INFLATE } from '../constants/geometry';
import { lonLatToVec3, type Vec3 } from '../utils/auxSurfaceGeometry';
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
  // Collect every coastline ring, then flatten all of them into a single
  // LineSegments geometry (consecutive vertex pairs = one segment). This draws
  // the whole 110m coastline in ONE draw call instead of one <Line> per ring
  // (hundreds of draw calls), which matters once a denser 50m dataset is used.
  const segments = useMemo<Float32Array>(() => {
    const verts: number[] = [];
    const pushRing = (ring: [number, number][]) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const a = lonLatToVec3(ring[i][0], ring[i][1], RADIUS * GLOBE_INFLATE);
        const b = lonLatToVec3(ring[i + 1][0], ring[i + 1][1], RADIUS * GLOBE_INFLATE);
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
  }, [geoJson]);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[segments, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={NEON_BLUE} transparent opacity={0.95} />
    </lineSegments>
  );
}

export default function Globe({ geoJson }: { geoJson: FeatureCollection | null }) {
  return (
    <group>
      <GlobeShell />
      {geoJson && <Coastlines geoJson={geoJson} />}
      <Graticule />
    </group>
  );
}
