import { useMemo, type CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import { useAppStore } from '../store/useAppStore';
import { getD3Projection } from '../utils/projectionMapper';
import { useElementSize } from '../hooks/useElementSize';

const NEON_BLUE = '#00e5ff';
const NEON_ORANGE = '#ff6a00';
const BG = '#05050A';

export default function Map2D() {
  const [ref, { width, height }] = useElementSize<HTMLDivElement>();
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phi1 = useAppStore((s) => s.phi1);
  const phi2 = useAppStore((s) => s.phi2);
  const showTissot = useAppStore((s) => s.showTissot);
  const geoJsonData = useAppStore((s) => s.geoJsonData);

  const pathGenerator = useMemo(() => {
    const projection = getD3Projection(family, distortion, lambda0, phi1, phi2);
    if (width > 0 && height > 0) {
      if (geoJsonData) projection.fitSize([width, height], geoJsonData);
      else projection.scale(Math.min(width, height) / 6).translate([width / 2, height / 2]);
    }
    return d3Geo.geoPath().projection(projection);
  }, [family, distortion, lambda0, phi1, phi2, width, height, geoJsonData]);

  const graticulePath = useMemo(
    () => pathGenerator(d3Geo.geoGraticule10()) ?? '',
    [pathGenerator],
  );

  const tissotCircles = useMemo(() => {
    if (!showTissot) return [];
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
    width: '100%',
    height: '100%',
    background: BG,
  };

  return (
    <div ref={ref} style={containerStyle}>
      {width > 0 && height > 0 && geoJsonData && (
        <svg width={width} height={height} style={{ display: 'block' }}>
          <path
            d={graticulePath}
            fill="none"
            stroke="#334155"
            strokeWidth={0.5}
          />
          {geoJsonData.features.map((feature, i) => (
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
