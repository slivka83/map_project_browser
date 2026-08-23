import { describe, it, expect } from 'vitest';
import type { FeatureCollection, Polygon } from 'geojson';
import { cutFeatureCollectionToBand, normalizeLon, rotateFeatureCollection, rotatePolygon } from './geoBandClip';
import { CLIP_LAT } from '../constants/geometry';

const poly = (rings: number[][][]): Polygon => ({ type: 'Polygon', coordinates: rings as never });
const fcOf = (...geoms: Polygon[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features: geoms.map((geometry) => ({ type: 'Feature', properties: {}, geometry })),
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
    const geom = cut.features[0].geometry as Polygon;
    expect(geom.coordinates).toHaveLength(2); // outer + hole
    expect(geom.coordinates[1]).toEqual(lake);
  });

  it('drops a hole that lies entirely beyond the band while keeping the outer ring', () => {
    const outer = [[[0, 70], [30, 70], [30, CLIP_LAT - 2], [0, CLIP_LAT - 2], [0, 70]]];
    const polarHole = [[10, CLIP_LAT + 1], [20, CLIP_LAT + 2], [15, CLIP_LAT + 3], [10, CLIP_LAT + 1]];
    const cut = cutFeatureCollectionToBand(fcOf(poly([...outer, polarHole])));
    expect(cut.features).toHaveLength(1);
    const geom = cut.features[0].geometry as Polygon;
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
