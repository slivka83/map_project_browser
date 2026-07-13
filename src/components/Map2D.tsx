import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection } from 'geojson';
import { useAppStore } from '../store/useAppStore';
import { getD3Projection, fitProjectionToView, computeAreaDistortion } from '../utils/projectionMapper';
import { NEON_BLUE, NEON_ORANGE, BG, NEON_BLUE_LINE, NEON_ORANGE_SOFT } from '../constants/designTokens';
import { iconBtn } from './ui/styles';
import { TissotIcon, BorderIcon, DetailIcon } from './ui/icons';
import { FIT_MARGIN } from '../constants/geometry';

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
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const showBorders = useAppStore((s) => s.showBorders);
  const setShowBorders = useAppStore((s) => s.setShowBorders);
  const detailedMap = useAppStore((s) => s.detailedMap);
  const setDetailedMap = useAppStore((s) => s.setDetailedMap);
  const land50GeoJson = useAppStore((s) => s.land50GeoJson);
  const countriesGeoJson = useAppStore((s) => s.countriesGeoJson);
  const geoJsonData = useAppStore((s) => s.geoJsonData);

  // Detailed 2D map (50m land + country borders) when enabled; otherwise the
  // lightweight 110m land shared with the 3D globe, without borders.
  const baseLand = detailedMap ? land50GeoJson : geoJsonData;
  const borders = detailedMap ? countriesGeoJson : null;

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
    fitProjectionToView(proj, width, height, scaleFactor, FIT_MARGIN);
    return d3Geo.geoPath().projection(proj);
  }, [family, distortion, lambda0, phiOrigin, scaleFactor, width, height]);

  const graticulePath = useMemo(() => pathGenerator(d3Geo.geoGraticule10()) ?? '', [pathGenerator]);

  const areaDistortion = useMemo(
    () => computeAreaDistortion({ family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting: 0, falseNorthing: 0 }),
    [family, distortion, lambda0, phiOrigin, scaleFactor],
  );

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
      {baseLand && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          data-map="true"
          style={{ display: 'block' }}
        >
          <path d={graticulePath} fill="none" stroke="#334155" strokeWidth={0.5} />
          {(baseLand as FeatureCollection).features.map((feature, i) => (
            <path
              key={i}
              d={pathGenerator(feature) ?? ''}
              fill={BG}
              stroke={NEON_BLUE}
              strokeWidth={1}
            />
          ))}
          {showBorders &&
            borders &&
            (borders as FeatureCollection).features.map((feature, i) => (
              <path
                key={`border-${i}`}
                d={pathGenerator(feature) ?? ''}
                fill="none"
                stroke={NEON_BLUE_LINE}
                strokeWidth={0.6}
              />
            ))}
          {tissotCircles.map((circle, i) => (
            <path
              key={`tissot-${i}`}
              d={pathGenerator(circle) ?? ''}
              fill={NEON_ORANGE_SOFT}
              stroke={NEON_ORANGE}
            />
          ))}
        </svg>
      )}
      <div className="absolute right-2 top-2 z-10 flex gap-1 items-start">
        <button
          title="Индикатрисы Тиссо"
          aria-label="Индикатрисы Тиссо"
          onClick={() => setShowTissot(!showTissot)}
          className={`${iconBtn} ${
            showTissot
              ? 'border-neon-blue bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]'
              : 'hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]'
          }`}
        >
          <TissotIcon />
        </button>
        <div className="flex flex-col gap-1">
          <button
            title="Детализация карты"
            aria-label="Детализация карты"
            onClick={() => setDetailedMap(!detailedMap)}
            className={`${iconBtn} ${
              detailedMap
                ? 'border-neon-blue bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]'
                : 'hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]'
            }`}
          >
            <DetailIcon />
          </button>
          {detailedMap && (
            <button
              title="Границы стран"
              aria-label="Границы стран"
              onClick={() => setShowBorders(!showBorders)}
              className={`${iconBtn} ${
                showBorders
                  ? 'border-neon-blue bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]'
                  : 'hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]'
              }`}
            >
              <BorderIcon />
            </button>
          )}
        </div>
      </div>
      <div
        className="absolute right-2 bottom-2 z-10 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-gray-300 backdrop-blur-md"
        title="Средневзвешенное искажение площадей при текущих настройках"
      >
        {formatDistortion(areaDistortion)}% искажений
      </div>
    </div>
  );
}

function formatDistortion(value: number): string {
  const v = Number.isFinite(value) ? value : 0;
  const [intPart, decPart = '00'] = v.toFixed(2).split('.');
  return `${intPart.padStart(2, '0')}.${decPart}`;
}
