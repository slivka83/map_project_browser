import { useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as d3Geo from 'd3-geo';
import { useAppStore } from '../store/useAppStore';
import { getD3Projection } from '../utils/projectionMapper';
import type { FeatureCollection } from 'geojson';

const NEON_BLUE = '#00e5ff';
const NEON_ORANGE = '#ff6a00';
const BG = '#05050A';
const RADIUS = 10;

function buildGlobeTexture(geoJson: FeatureCollection): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  const projection = d3Geo.geoEquirectangular().fitSize([width, height], geoJson);
  const path = d3Geo.geoPath(projection, ctx);

  ctx.beginPath();
  path(d3Geo.geoGraticule10());
  ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  path(geoJson);
  ctx.strokeStyle = NEON_BLUE;
  ctx.lineWidth = 2;
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Globe({ geoJson }: { geoJson: FeatureCollection | null }) {
  const texture = useMemo(
    () => (geoJson ? buildGlobeTexture(geoJson) : null),
    [geoJson],
  );

  return (
    <mesh>
      <sphereGeometry args={[RADIUS, 64, 64]} />
      <meshBasicMaterial map={texture ?? undefined} color={BG} />
    </mesh>
  );
}

function AuxSurface({
  family,
  lambda0,
}: {
  family: 'cylindrical' | 'conic' | 'azimuthal';
  lambda0: number;
}) {
  const material = (
    <meshPhysicalMaterial
      color={NEON_ORANGE}
      transparent
      opacity={0.2}
      side={THREE.DoubleSide}
    />
  );

  if (family === 'cylindrical') {
    return (
      <mesh rotation={[0, (lambda0 * Math.PI) / 180, 0]}>
        <cylinderGeometry args={[RADIUS, RADIUS, 30, 64, 1, true]} />
        {material}
      </mesh>
    );
  }

  if (family === 'azimuthal') {
    return (
      <mesh position={[0, RADIUS, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[30, 30]} />
        {material}
      </mesh>
    );
  }

  return (
    <mesh position={[0, 5, 0]}>
      <coneGeometry args={[RADIUS, 20, 64, 1, true]} />
      {material}
    </mesh>
  );
}

interface Segment {
  start: [number, number, number];
  end: [number, number, number];
}

function Rays({
  lambda0,
  family,
  distortion,
  phi1,
  phi2,
  geoJson,
}: {
  lambda0: number;
  family: 'cylindrical' | 'conic' | 'azimuthal';
  distortion: 'conformal' | 'equalArea' | 'equidistant';
  phi1: number;
  phi2: number;
  geoJson: FeatureCollection | null;
}) {
  const segments = useMemo<Segment[]>(() => {
    if (!geoJson) return [];
    const proj = getD3Projection(family, distortion, lambda0, phi1, phi2);
    proj.fitSize([200, 200], geoJson);
    const lonRad = (lambda0 * Math.PI) / 180;
    const result: Segment[] = [];

    for (let lat = -80; lat <= 80; lat += 10) {
      const latRad = (lat * Math.PI) / 180;
      const start: [number, number, number] = [
        RADIUS * Math.cos(latRad) * Math.cos(lonRad),
        RADIUS * Math.sin(latRad),
        -RADIUS * Math.cos(latRad) * Math.sin(lonRad),
      ];

      const projected = proj([lambda0, lat]);
      const py = projected ? projected[1] : 0;
      const scaleFactor = 0.15;
      const end: [number, number, number] = [
        RADIUS * Math.cos(lonRad),
        -py * scaleFactor,
        -RADIUS * Math.sin(lonRad),
      ];

      result.push({ start, end });
    }
    return result;
  }, [lambda0, family, distortion, phi1, phi2, geoJson]);

  return (
    <>
      {segments.map((seg, i) => (
        <Line key={i} points={[seg.start, seg.end]} color={NEON_ORANGE} lineWidth={1} />
      ))}
    </>
  );
}

export default function GlobeScene() {
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phi1 = useAppStore((s) => s.phi1);
  const phi2 = useAppStore((s) => s.phi2);
  const geoJson = useAppStore((s) => s.geoJsonData);

  return (
    <Canvas camera={{ position: [0, 0, 32], fov: 50 }} className="rounded-lg">
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 0, 30]} intensity={1.2} />
      <Globe geoJson={geoJson} />
      <AuxSurface family={family} lambda0={lambda0} />
      <Rays
        lambda0={lambda0}
        family={family}
        distortion={distortion}
        phi1={phi1}
        phi2={phi2}
        geoJson={geoJson}
      />
    </Canvas>
  );
}
