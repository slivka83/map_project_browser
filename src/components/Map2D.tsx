import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { getD3Projection, fitProjectionToView } from '../utils/projectionMapper';
import { NEON_BLUE, NEON_ORANGE, BG } from '../constants/designTokens';

const MARGIN = 16;

function useElementSize() {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export default function Map2D() {
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phiOrigin = useAppStore((s) => s.phiOrigin);
  const scaleFactor = useAppStore((s) => s.scaleFactor);
  const showTissot = useAppStore((s) => s.showTissot);
  const geoJsonData = useAppStore((s) => s.geoJsonData);

  const { ref, size } = useElementSize();
  const width = size.width || 800;
  const height = size.height || 600;

  const pathGenerator = useMemo(() => {
    const proj = getD3Projection({
      family,
      distortion,
      lambda0,
      phiOrigin,
      scaleFactor,
      falseEasting: 0,
      falseNorthing: 0,
    });
    // Fit the whole globe into the viewport so the map always fills the
    // available area regardless of the chosen projection (small uniform margin).
    fitProjectionToView(proj, width, height, scaleFactor, MARGIN);
    return d3Geo.geoPath().projection(proj);
  }, [family, distortion, lambda0, phiOrigin, scaleFactor, width, height]);

  const graticulePath = useMemo(() => pathGenerator(d3Geo.geoGraticule10()) ?? '', [pathGenerator]);

  const tissotCircles = useMemo(() => {
    if (!showTissot) return [] as GeoJSON.Polygon[];
    const circles: GeoJSON.Polygon[] = [];
    for (let lon = -180; lon <= 180; lon += 30) {
      for (let lat = -60; lat <= 60; lat += 30) {
        const circle = d3Geo.geoCircle().center([lon, lat]).radius(5)();
        if (circle.type === 'Polygon') circles.push(circle);
      }
    }
    return circles;
  }, [showTissot]);

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: BG,
  };

  return (
    <div ref={ref} style={containerStyle}>
      {geoJsonData && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ display: 'block' }}
        >
          <path d={graticulePath} fill="none" stroke="#334155" strokeWidth={0.5} />
          {(geoJsonData as FeatureCollection).features.map((feature, i) => (
            <path
              key={i}
              d={pathGenerator(feature) ?? ''}
              fill={BG}
              stroke={NEON_BLUE}
              strokeWidth={1}
            />
          ))}
          {tissotCircles.map((circle, i) => (
            <path
              key={`tissot-${i}`}
              d={pathGenerator(circle) ?? ''}
              fill="rgba(255, 106, 0, 0.4)"
              stroke={NEON_ORANGE}
            />
          ))}
        </svg>
      )}
    </div>
  );
}
