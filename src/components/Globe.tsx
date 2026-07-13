import { useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { NEON_BLUE, BG } from '../constants/designTokens';
import { RADIUS, lonLatToVec3, type Vec3 } from '../utils/auxSurfaceGeometry';
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

export default function Globe({ geoJson }: { geoJson: FeatureCollection | null }) {
  return (
    <group>
      <GlobeShell />
      {geoJson && <Coastlines geoJson={geoJson} />}
      <Graticule />
    </group>
  );
}
