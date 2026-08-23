import { describe, it, expect } from 'vitest';
import * as d3Geo from 'd3-geo';
import type { FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { cutFeatureCollectionToBand, normalizeLon, rotateFeatureCollection, rotatePolygon } from './geoBandClip';
import { getD3Projection, fitProjectionToView } from './projectionMapper';
import type { ProjectionParams } from '../store/useAppStore';
import { CLIP_LAT } from '../constants/geometry';

const poly = (rings: number[][][]): Polygon => ({ type: 'Polygon', coordinates: rings as never });
const fcOf = (...geoms: Polygon[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geoms.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
});

const baseState = (): ProjectionParams => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  gamma: 0,
  stdParallel2: null,
  azLight: 'center',
  variant: 'mercator',
});

describe('cutFeatureCollectionToBand', () => {
  it('keeps a polygon fully inside the band untouched', () => {
    const fc = fcOf(poly([[[0, 0], [10, 0], [10, 10], [0, 0]]]));
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    expect(cut.features[0].geometry).toEqual(fc.features[0].geometry);
  });

  it('drops a polygon that lies entirely beyond the band edge', () => {
    // A cap polygon hugging the pole: every vertex past +CLIP_LAT.
    const fc = fcOf(poly([[[0, CLIP_LAT + 1], [10, CLIP_LAT + 2], [20, CLIP_LAT + 1.5], [0, CLIP_LAT + 1]]]));
    expect(cutFeatureCollectionToBand(fc).features).toHaveLength(0);
  });

  it('trims a ring that crosses the band edge onto the cut latitude', () => {
    const lat = CLIP_LAT + 5;
    const fc = fcOf(poly([[[0, 80], [30, 80], [30, lat], [0, lat], [0, 80]]]));
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon;
    for (const [lon, lat2] of geom.coordinates[0]) {
      void lon;
      expect(Math.abs(lat2)).toBeLessThanOrEqual(CLIP_LAT);
    }
    // The trimmed top edge sits exactly ON the band edge.
    const top = geom.coordinates[0].filter(([, l]) => l === CLIP_LAT);
    expect(top.length).toBeGreaterThanOrEqual(2);
  });

  // Regression: the band cut used to keep ONLY the outer ring of each polygon,
  // silently turning interior lakes into solid land on the cylindrical map.
  it('preserves an interior hole (lake) inside the band', () => {
    const outer = [[[0, 0], [30, 0], [30, 30], [0, 30], [0, 0]]];
    const lake = [[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]];
    const cut = cutFeatureCollectionToBand(fcOf(poly([...outer, lake])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.coordinates).toHaveLength(2); // outer + hole
    expect(geom.coordinates[1]).toEqual(lake);
  });

  it('drops a hole that lies entirely beyond the band while keeping the outer ring', () => {
    const outer = [[[0, 70], [30, 70], [30, CLIP_LAT - 2], [0, CLIP_LAT - 2], [0, 70]]];
    const polarHole = [[10, CLIP_LAT + 1], [20, CLIP_LAT + 2], [15, CLIP_LAT + 3], [10, CLIP_LAT + 1]];
    const cut = cutFeatureCollectionToBand(fcOf(poly([...outer, polarHole])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.coordinates).toHaveLength(1); // only the outer survives
  });

  it('cuts a MultiPolygon and collapses a single survivor to a Polygon', () => {
    const fc: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'MultiPolygon',
            coordinates: [
              [[[0, 0], [5, 0], [5, 5], [0, 0]]], // survives
              [[[0, CLIP_LAT + 1], [5, CLIP_LAT + 2], [3, CLIP_LAT + 3], [0, CLIP_LAT + 1]]], // dropped
            ] as never,
          },
        },
      ],
    };
    const cut = cutFeatureCollectionToBand(fc);
    expect(cut.features).toHaveLength(1);
    expect(cut.features[0].geometry.type).toBe('Polygon');
  });
});

describe('dateline split (antimeridian seam)', () => {
  const maxLonSpan = (ring: number[][]): number => {
    let min = Infinity;
    let max = -Infinity;
    for (const [lon] of ring) {
      min = Math.min(min, lon);
      max = Math.max(max, lon);
    }
    return max - min;
  };

  it('splits a ring crossing the ±180° seam into one part per hemisphere', () => {
    // Chukotka-like wedge straddling the seam (longitudes already normalized).
    const cut = cutFeatureCollectionToBand(fcOf(poly([[[170, 66], [-175, 68], [-170, 64], [172, 62], [170, 66]]])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    expect(geom.type).toBe('MultiPolygon');
    const parts = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const rings of parts) {
      for (const ring of rings) {
        // Every ring must live on ONE side of the seam.
        expect(maxLonSpan(ring)).toBeLessThanOrEqual(180 + 1e-9);
      }
    }
  });

  // Regression: Natural Earth's Antarctica touches the seam with BOTH sides
  // ([+180°, ~-84.7°] and [-180°, ~-84.7°]). The band cut kept the pair, and
  // d3's antimeridian clipper then wrapped the southern cap onto the NORTHERN
  // map rows — a phantom full-width line at frame latitude ~+80° plus a
  // full-height vertical chord at the map edge ("the map looks inside-out").
  it('keeps an Antarctica-like [+180°]->[-180°] pair on ONE side of the seam', () => {
    const cap = poly([[
      [150, -70], [170, -75], [180, -84], [-180, -84.5], [-150, -86], [-30, -86.5],
      [90, -85.8], [140, -80], [150, -70],
    ]]);
    const cut = cutFeatureCollectionToBand(fcOf(cap));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon | MultiPolygon;
    const parts = geom.type === 'MultiPolygon' ? geom.coordinates : [geom.coordinates];
    for (const rings of parts) {
      for (const ring of rings) {
        expect(maxLonSpan(ring)).toBeLessThanOrEqual(180 + 1e-9);
      }
    }
  });

  // End-to-end: through the REAL fitted cylindrical projection no layer may
  // contain a long horizontal chord anywhere except the two rim rows.
  it('projects Antarctica-like caps without phantom wrap chords', () => {
    const proj = fitProjectionToView(getD3Projection(baseState()), 800, 600);
    const gp = d3Geo.geoPath(proj);
    const cap = fcOf(poly([[
      [150, -70], [170, -75], [180, -84], [-180, -84.5], [-150, -86], [-30, -86.5],
      [90, -85.8], [140, -80], [150, -70],
    ]]));
    const d = gp(cutFeatureCollectionToBand(cap)) ?? '';
    const tokens = d.match(/[MLZ]|-?\d+(?:\.\d+)?(?:e-?\d+)?/g) ?? [];
    const segs: [number, number, number, number][] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === 'L') {
        segs.push([Number(tokens[i - 2]), Number(tokens[i - 1]), Number(tokens[i + 1]), Number(tokens[i + 2])]);
      }
    }
    for (const [x0, y0, x1, y1] of segs) {
      if (Math.abs(y0 - y1) < 0.01 && Math.abs(x1 - x0) > 300) {
        // Only the rim rows themselves may run wide.
        expect(Math.abs(y0 - 16)).toBeLessThan(2);
        expect(Math.abs(y0 - 584)).toBeLessThan(2);
      }
    }
  });
});

describe('normalizeLon', () => {
  it('wraps into [-180, 180)', () => {
    expect(normalizeLon(0)).toBe(0);
    expect(normalizeLon(180)).toBe(-180);
    expect(normalizeLon(-180)).toBe(-180);
    expect(normalizeLon(190)).toBe(-170);
    expect(normalizeLon(-190)).toBe(170);
    expect(normalizeLon(540)).toBe(-180);
  });
});

describe('rotate helpers', () => {
  it('rotation brings the central point to the frame origin', () => {
    const rotate = (p: [number, number]): [number, number] => [p[0] - 37, p[1] + 55];
    const rotated = rotateFeatureCollection(
      fcOf(poly([[[37, -55], [40, -55], [40, -50], [37, -55]]])),
      rotate,
    );
    const geom = rotated.features[0].geometry as Polygon;
    expect(geom.coordinates[0][0]).toEqual([0, 0]);
  });

  it('rotatePolygon returns the same shape mapping for a single polygon', () => {
    const p = poly([[[0, 0], [10, 0], [10, 10], [0, 0]]]);
    const r = rotatePolygon(p, ([lon, lat]) => [lon + 1, lat - 2] as [number, number]);
    expect(r.coordinates[0][1]).toEqual([11, -2]);
  });
});
