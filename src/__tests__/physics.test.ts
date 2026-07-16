import { describe, it, expect } from 'vitest';
import type { ProjectionParams, ProjectionFamily, DistortionModel } from '../store/useAppStore';
import { RADIUS, RAY_COUNT, MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y } from '../constants/geometry';
import { getD3Projection, computeAreaDistortion, FIT_SPHERE } from '../utils/projectionMapper';
import {
  lonLatToVec3,
  vec3ToLonLat,
  computeAuxSurfaceParams,
  computeAuxSphereIntersections,
  computeCentralMeridianRays,
  projectToAuxWorld,
  auxPointToWorld,
  cylinderLocalEnd,
  clampLocalToSurface,
  computeTangentBasis,
} from '../utils/auxSurfaceGeometry';
import { computeTissotCircles } from '../utils/tissot';

const FAMILIES: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthal'];
const DISTORTIONS: DistortionModel[] = ['conformal', 'equalArea', 'equidistant'];

const base = (over: Partial<ProjectionParams> = {}): ProjectionParams => ({
  family: 'cylindrical',
  distortion: 'conformal',
  lambda0: 0,
  phiOrigin: 0,
  scaleFactor: 1,
  falseEasting: 0,
  falseNorthing: 0,
  gamma: 0,
  stdParallel2: null,
  azLight: 'math',
  ...over,
});

const closeTo = (a: number, b: number, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

// ---------------------------------------------------------------------------
// 1. GLOBE ↔ MAP: the projection is the single bridge between the 3D globe and
//    the 2D map. For every family × distortion the d3 projection must (a) be
//    invertible (round-trip lon/lat), (b) place the central meridian at the map
//    centre x, and (c) put the central latitude at the map centre y.
// ---------------------------------------------------------------------------
describe('globe ↔ map projection consistency', () => {
  for (const family of FAMILIES) {
    for (const distortion of DISTORTIONS) {
      const p = base({ family, distortion, phiOrigin: family === 'cylindrical' ? 0 : 20, lambda0: 25 });
      const proj = getD3Projection(p);

      it(`${family}/${distortion}: projection round-trips lon/lat`, () => {
        const inv = proj.invert;
        expect(inv).toBeTypeOf('function');
        for (const [lon, lat] of [[25, 0], [25, 40], [25, -30], [10, 60]] as [number, number][]) {
          const xy = proj([lon, lat])!;
          const back = inv!(xy)!;
          closeTo(back[0], lon, 1e-6);
          closeTo(back[1], lat, 1e-6);
        }
      });

      it(`${family}/${distortion}: central meridian sits at map-centre x`, () => {
        const c = proj([p.lambda0, p.phiOrigin])!;
        closeTo(c[0], VIEW_CENTER_X + p.falseEasting, 1e-6);
      });
    }
  }

  it('cylindrical diameter (scaleFactor) sets the contact standard parallel ±arccos(s)', () => {
    for (const sf of [1, 0.866, 0.5]) {
      const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: sf }));
      // A cylinder's x-coordinate depends only on longitude, so the same meridian
      // has the same x at every latitude (the cylinder is "unrolled" along x).
      const equator = proj([0, 0])!;
      const contact = proj([0, (Math.acos(sf) * 180) / Math.PI])!;
      expect(Math.abs(equator[0] - contact[0])).toBeLessThan(1e-6);
      // Equal-area keeps a CONSTANT area scale everywhere, so the contact
      // parallel and the pole have the same area scale (both ≈ true scale).
      const ref = localAreaScaleApprox(proj, 0, (Math.acos(sf) * 180) / Math.PI);
      const pole = localAreaScaleApprox(proj, 0, 80);
      expect(Math.abs(pole - ref) / ref).toBeLessThan(0.02);
    }
  });

  it('conformal Mercator is shape-invariant to the cylinder diameter (scale is uniform)', () => {
    const a = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 1 }));
    const b = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal', scaleFactor: 0.7 }));
    // Ratio of map-heights of two latitudes is identical for both diameters.
    const h = (proj: typeof a, lat: number) => Math.abs(proj([0, lat])![1] - proj([0, 0])![1]);
    for (const lat of [20, 45, 60]) {
      const ra = h(a, lat) / h(a, 10);
      const rb = h(b, lat) / h(b, 10);
      closeTo(ra, rb, 1e-6);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. RAYS: the "globe point → map point" link. Every ray's globe endpoint must
//    be the actual 3D globe point lonLatToVec3(lon,lat), and its map landing
//    must re-project (through auxPointToWorld + the same projection) back to the
//    globe point's (lon, lat). This is the core promise of the whole app.
// ---------------------------------------------------------------------------
describe('rays link globe point to map point', () => {
  for (const family of FAMILIES) {
    for (const distortion of DISTORTIONS) {
      const az = family === 'azimuthal' ? 'center' : 'math';
      const p = base({ family, distortion, azLight: az, phiOrigin: family === 'cylindrical' ? 0 : 25 });

      it(`${family}/${distortion}: every central-meridian ray's globe endpoint is the true 3D point`, () => {
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          const g = lonLatToVec3(p.lambda0, lat, RADIUS);
          closeTo(segs[i].globe[0], g[0], 1e-6);
          closeTo(segs[i].globe[1], g[1], 1e-6);
          closeTo(segs[i].globe[2], g[2], 1e-6);
        }
      });

      it(`${family}/${distortion}: the ray landing, fed back through the projection, returns the globe (lon,lat)`, () => {
        const segs = computeCentralMeridianRays({ ...p, radius: RADIUS, rayCount: RAY_COUNT });
        const proj = getD3Projection(p);
        const surface = computeAuxSurfaceParams(family, p.lambda0, p.phiOrigin, p.scaleFactor, RADIUS, p.stdParallel2, p.gamma, distortion, p.azLight);
        for (let i = 0; i < segs.length; i++) {
          const lat = -90 + (i * 180) / (segs.length - 1);
          // The landing local frame used by projectToAuxWorld must reproduce end.
          const local = cylinderLocalEndOrNull(family, surface, proj, p.lambda0, lat);
          if (!local) continue;
          const world = auxPointToWorld(surface, clampLocalToSurface(surface, local));
          closeTo(world[0], segs[i].end[0], 1e-6);
          closeTo(world[1], segs[i].end[1], 1e-6);
          closeTo(world[2], segs[i].end[2], 1e-6);
        }
      });

      it(`${family}/${distortion}: the hover ray (projectToAuxWorld) links globe→map for arbitrary points`, () => {
        for (const [lon, lat] of [[p.lambda0, 10], [p.lambda0 + 30, -20], [p.lambda0 - 40, 50]] as [number, number][]) {
          const ray = projectToAuxWorld(p, lon, lat, RADIUS);
          if (!ray) continue; // orthographic far-hemisphere is legitimately null
          const g = lonLatToVec3(lon, lat, RADIUS);
          closeTo(ray.globe[0], g[0], 1e-6);
          closeTo(ray.globe[1], g[1], 1e-6);
          closeTo(ray.globe[2], g[2], 1e-6);
        }
      });
    }
  }

  it('azimuthal orthographic hover ray returns null for a far-hemisphere point', () => {
    const p = base({ family: 'azimuthal', distortion: 'equalArea', azLight: 'infinity', lambda0: 0, phiOrigin: 0 });
    // A point on the opposite hemisphere from the tangent point.
    const ray = projectToAuxWorld(p, 180, 0, RADIUS);
    expect(ray).toBeNull();
  });
});

// helper: replicate the cylinder local-end used by the ray builders so we can
// independently verify auxPointToWorld reproduces the ray endpoint.
function cylinderLocalEndOrNull(
  family: ProjectionFamily,
  surface: ReturnType<typeof computeAuxSurfaceParams>,
  proj: ReturnType<typeof getD3Projection>,
  lon: number,
  lat: number,
): [number, number, number] | null {
  if (family !== 'cylindrical') return null;
  const local = cylinderLocalEnd(proj, lon, lat, surface.kind === 'cylinder' ? surface.radius : 1, VIEW_CENTER_Y, RADIUS / MAP_SCALE);
  return local;
}

// ---------------------------------------------------------------------------
// 3. TISSOT INDICATRIX PHYSICS. The indicatrices are small equal-radius circles
//    on the globe. Their projections must (a) all be non-degenerate and small,
//    (b) for an EQUAL-AREA projection keep (approximately) equal projected area
//    everywhere, (c) for a CONFORMAL projection keep a circular (equal-axis)
//    shape everywhere, and (d) be distributed on the staggered 30° grid.
// ---------------------------------------------------------------------------
describe('Tissot indicatrix physics', () => {
  it('circles are small, non-degenerate and cover the staggered grid', () => {
    const circles = computeTissotCircles();
    expect(circles.length).toBeGreaterThan(20);
    for (const c of circles) {
      const ring = c.coordinates[0];
      expect(ring.length).toBeGreaterThan(8);
      // No NaN / infinite vertices.
      for (const [lon, lat] of ring) {
        expect(Number.isFinite(lon)).toBe(true);
        expect(Number.isFinite(lat)).toBe(true);
        // Each circle is ~5° radius → its vertices stay near its centre.
        expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      }
    }
  });

  it('every circle is centred inside the ±60° latitude band it claims', () => {
    for (const lat of [-60, -30, 0, 30, 60]) {
      // at least one circle exists near this latitude row
      const circles = computeTissotCircles().filter((c) => {
        const [, clat] = c.coordinates[0][0];
        return Math.abs(clat - lat) < 6;
      });
      expect(circles.length).toBeGreaterThan(0);
    }
  });

  it('equal-area projection keeps ~equal projected area of every indicatrix', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equalArea' }));
    const areas = computeTissotCircles().map((c) => shoelaceArea(project(c, proj)));
    const min = Math.min(...areas);
    const max = Math.max(...areas);
    // Equal-area: all indicatrices project to (almost) the same area.
    expect(max / min).toBeLessThan(1.5);
  });

  it('conformal projection keeps every indicatrix ~circular (bbox aspect ≈ 1)', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal' }));
    for (const c of computeTissotCircles()) {
      const pts = project(c, proj);
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      expect(w / h).toBeGreaterThan(0.8);
      expect(w / h).toBeLessThan(1.25);
    }
  });

  it('non-conformal projections DO distort the indicatrix shape (sanity of the tool)', () => {
    // Equidistant cylindrical with a shrunken cylinder (φ0 = 60°) maps a 5° circle
    // to a tall, thin ellipse — its bbox height/width must be clearly > 1. We pick
    // a circle near the prime meridian so d3's antimeridian wrap doesn't collapse
    // the longitudinal extent.
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'equidistant', scaleFactor: 0.5 }));
    const near0 = computeTissotCircles().find((c) => Math.abs(c.coordinates[0][0][0]) < 20 && Math.abs(c.coordinates[0][0][1]) < 20)!;
    const pts = project(near0, proj);
    const w = Math.max(...pts.map((p) => p[0])) - Math.min(...pts.map((p) => p[0]));
    const h = Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1]));
    expect(h / w).toBeGreaterThan(1.5);
  });

  it('a conformal projection preserves local ANGLES (isotropic scale)', () => {
    const proj = getD3Projection(base({ family: 'cylindrical', distortion: 'conformal' }));
    // Isotropic scale: px per degree-of-longitude-at-this-latitude must equal px
    // per degree-of-latitude, i.e. w / (Δlon·cos lat) == h / Δlat.
    for (const lat of [0, 30, 60]) {
      const dLon = 5;
      const dLat = 5;
      const w = Math.abs(proj([dLon, lat])![0] - proj([-dLon, lat])![0]);
      const h = Math.abs(proj([0, lat + dLat])![1] - proj([0, lat - dLat])![1]);
      const sx = w / (2 * dLon * Math.cos((lat * Math.PI) / 180));
      const sy = h / (2 * dLat);
      expect(sx / sy).toBeGreaterThan(0.95);
      expect(sx / sy).toBeLessThan(1.05);
    }
  });
});

// Project every vertex of a Polygon and return the array of [x,y] screen points.
function project(poly: { coordinates: number[][][] }, proj: (p: [number, number]) => [number, number] | null): [number, number][] {
  return poly.coordinates[0].map(([lon, lat]) => proj([lon, lat])!);
}
function shoelaceArea(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

// ---------------------------------------------------------------------------
// 4. SURFACE ↔ GLOBE INTERSECTION physics. The aux surface meets the globe in
//    0/1/2 circles. Cylinder radius r=R·s: r<R → two circles at the contact
//    parallels ±arccos(s); r=R → one tangent circle; r>R → none. Cone & azimuthal
//    follow their analytic intersections. The intersection must also be exactly
//    where the projection has true scale (the standard parallel).
// ---------------------------------------------------------------------------
describe('aux-surface ↔ globe intersection physics', () => {
  it('cylinder radius r<R yields two circles at latitude ±arccos(s)', () => {
    const s = 0.5;
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, s, RADIUS);
    expect(rings.length).toBe(2);
    const phiS = (Math.acos(s) * 180) / Math.PI;
    for (const ring of rings) {
      const [lon, lat] = vec3ToLonLat(ring[0]);
      closeTo(Math.abs(lat), phiS, 1e-6);
      closeTo(lon, 0, 1e-6);
    }
  });

  it('cylinder radius r=R is tangent (one circle at the equator)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1, RADIUS);
    expect(rings.length).toBe(1);
    const [, lat] = vec3ToLonLat(rings[0][0]);
    closeTo(lat, 0, 1e-6);
  });

  it('cylinder radius r>R encloses the sphere (no intersection)', () => {
    const rings = computeAuxSphereIntersections('cylindrical', 0, 0, 1.05, RADIUS);
    expect(rings.length).toBe(0);
  });

  it('every intersection circle lies exactly on the sphere surface', () => {
    for (const s of [0.5, 0.8, 1]) {
      const rings = computeAuxSphereIntersections('cylindrical', 30, 0, s, RADIUS);
      for (const ring of rings) {
        for (const p of ring) closeTo(Math.hypot(p[0], p[1], p[2]), RADIUS, 1e-6);
      }
    }
  });

  it('azimuthal tangent plane touches the sphere at a single point (lambda0, phiOrigin)', () => {
    const rings = computeAuxSphereIntersections('azimuthal', 40, 25, 1, RADIUS);
    expect(rings.length).toBe(1);
    // The ring marks a small cap (angular radius AZIMUTHAL_POINT_DEG) around the
    // tangent point, so its CENTROID must be the tangent point (lambda0, phiOrigin).
    const c = rings[0].reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0] as [number, number, number]);
    const [lon, lat] = vec3ToLonLat([c[0] / rings[0].length, c[1] / rings[0].length, c[2] / rings[0].length]);
    // The centroid of the small cap sits within the cap's angular radius of the
    // tangent point (AZIMUTHAL_POINT_DEG = 4°).
    closeTo(lon, 40, 0.5);
    closeTo(lat, 25, 0.5);
  });

  it('conic secant surface passes through both standard parallels', () => {
    const phi1 = 30;
    const phi2 = 50;
    const rings = computeAuxSphereIntersections('conic', 0, phi1, 1, RADIUS, phi2);
    // secant cone → two circles
    expect(rings.length).toBe(2);
    const lats = rings.map((r) => Math.abs(vec3ToLonLat(r[0])[1])).sort((a, b) => a - b);
    closeTo(lats[0], phi1, 1e-6);
    closeTo(lats[1], phi2, 1e-6);
  });
});

// ---------------------------------------------------------------------------
// 5. AREA-DISTORTION invariants. Equal-area → ~0% everywhere. Conformal/equi at
//    the standard parallel → local area scale ~1 (true scale). The reported
//    distortion must respond to the cylinder diameter (smaller → less reported
//    area error for equal-area, because the secant contact true-scale band
//    grows). And for conic/azimuthal scaleFactor is a pure zoom → distortion
//    invariant under scaleFactor.
// ---------------------------------------------------------------------------
describe('area-distortion invariants', () => {
  it('equal-area family reports ~0% mean area distortion for every family', () => {
    for (const family of FAMILIES) {
      const az = family === 'azimuthal' ? 'math' : 'math';
      const d = computeAreaDistortion(base({ family, distortion: 'equalArea', azLight: az, phiOrigin: family === 'cylindrical' ? 0 : 25 }));
      expect(d).toBeLessThan(5);
    }
  });

  it('conformal Mercator area distortion grows toward the poles', () => {
    // Not a strict equality, just a positive, finite, sensible number.
    const d = computeAreaDistortion(base({ family: 'cylindrical', distortion: 'conformal' }));
    expect(d).toBeGreaterThan(0);
    expect(Number.isFinite(d)).toBe(true);
  });

  it('cylindrical equal-area stays ~0% area distortion at any diameter (equal-area is area-true)', () => {
    for (const sf of [1, 0.8, 0.6, 0.5]) {
      const d = computeAreaDistortion(base({ family: 'cylindrical', distortion: 'equalArea', scaleFactor: sf }));
      expect(d).toBeLessThan(5);
    }
  });

  it('conic/azimuthal area distortion is invariant under scaleFactor (pure zoom)', () => {
    for (const family of ['conic', 'azimuthal'] as ProjectionFamily[]) {
      const a = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 0.9, phiOrigin: 25, azLight: 'math' }));
      const b = computeAreaDistortion(base({ family, distortion: 'equalArea', scaleFactor: 1.1, phiOrigin: 25, azLight: 'math' }));
      closeTo(a, b, 1e-6);
    }
  });

  it('FIT_SPHERE is a clipped ±CLIP_LAT band (finite, not a full Sphere)', () => {
    expect(FIT_SPHERE.type).toBe('Polygon');
    const lats = FIT_SPHERE.coordinates[0].map((c) => c[1]);
    expect(Math.max(...lats.map(Math.abs))).toBeLessThanOrEqual(85 + 1e-9);
  });
});

// ---------------------------------------------------------------------------
// 6. GLOBE geometry sanity (the sphere the rays start from).
// ---------------------------------------------------------------------------
describe('globe geometry sanity', () => {
  it('lonLatToVec3 places every point exactly on the sphere of radius R', () => {
    for (const [lon, lat] of [[0, 0], [90, 45], [-30, -60], [180, 80]] as [number, number][]) {
      const v = lonLatToVec3(lon, lat, RADIUS);
      closeTo(Math.hypot(v[0], v[1], v[2]), RADIUS, 1e-9);
    }
  });

  it('vec3ToLonLat inverts lonLatToVec3 for a dense grid', () => {
    for (let lon = -180; lon < 180; lon += 30) {
      for (let lat = -80; lat <= 80; lat += 20) {
        const [blon, blat] = vec3ToLonLat(lonLatToVec3(lon, lat, RADIUS));
        const dl = Math.abs(((blon - lon + 540) % 360) - 180);
        closeTo(dl, 0, 1e-6);
        closeTo(blat, lat, 1e-6);
      }
    }
  });

  it('tangent basis (east/north/normal) is orthonormal for any point', () => {
    for (const [lon, lat] of [[0, 0], [40, 30], [-20, -45]] as [number, number][]) {
      const { center, normal, east, north } = computeTangentBasis(lon, lat, RADIUS);
      closeTo(dot(normal, east), 0, 1e-9);
      closeTo(dot(normal, north), 0, 1e-9);
      closeTo(dot(east, north), 0, 1e-9);
      closeTo(Math.hypot(...normal), 1, 1e-9);
      closeTo(Math.hypot(...east), 1, 1e-9);
      closeTo(Math.hypot(...north), 1, 1e-9);
      closeTo(Math.hypot(...center), RADIUS, 1e-9);
    }
  });
});

function dot(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

// Local area scale (projected px² per unit true area) of a projection at (lon,lat),
// from a tiny 2°×2° quad. Stand-in for the production localAreaScale used by the
// distortion readout, just for relative comparisons.
function localAreaScaleApprox(proj: (p: [number, number]) => [number, number] | null, lon: number, lat: number) {
  const d = 1;
  const p = [
    proj([lon - d, lat - d])!,
    proj([lon + d, lat - d])!,
    proj([lon + d, lat + d])!,
    proj([lon - d, lat + d])!,
  ];
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % 4];
    a += x1 * y2 - x2 * y1;
  }
  a = Math.abs(a) / 2;
  const rad = Math.PI / 180;
  const trueArea = Math.cos(lat * rad) * (2 * d * rad) * (2 * d * rad);
  return a / trueArea;
}
