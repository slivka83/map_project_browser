import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import type { Polygon } from 'geojson';
import type { ProjectionParams } from '../store/useAppStore';
import { MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y, CLIP_LAT, FIT_MARGIN, signedStandardParallelDeg } from '../constants/geometry';

const clampScale = (s: number): number => Math.max(0, Math.min(1, s));

// Geometric cylindrical projection in the CYLINDER-LOCAL frame (the cylinder
// axis is the local y-axis; a d3 rotation of [-lambda0, -phiOrigin, -gamma]
// brings the globe into this frame, so the tilt is absorbed BEFORE this runs).
// The cylinder is a FINITE tube of radius r = scaleFactor·R touching the globe
// at the contact latitudes ±φ_s (φ_s = arccos(scaleFactor)) measured from the
// cylinder axis. The projection keeps the chosen property (conformal / equal-
// area / equidistant) by its height law, with the standard parallel at φ_s, and
// is clipped to the tube's finite height (±CLIP_LAT from the axis) so there is
// no Mercator-style pole singularity: points beyond the tube are simply not on
// the surface, exactly like the 3D tube. This makes the 2D map the literal
// unrolling of the 3D cylinder where the rays land — consistent with the scene
// and free of the broken transverse-Mercator infinity under a tilt.
function makeCylindricalProjection(
  distortion: ProjectionParams['distortion'],
  scaleFactor: number,
): GeoProjection {
  const s = clampScale(scaleFactor);
  const phiS = Math.acos(s); // contact latitude from the cylinder axis (radians)
  const cosS = Math.cos(phiS);
  // The tube is finite: latitudes beyond ±CLIP_LAT (measured from the cylinder
  // axis, i.e. the LOCAL frame) are off the surface. We clamp φ into that band
  // INSIDE the height law rather than using proj.clipAngle(): clipAngle cuts by a
  // small-circle around the projection centre, which bends the top/bottom edges
  // of the map into an arc (the "egg") — a normal cylindrical map's parallels
  // must stay straight horizontal lines. Clamping φ keeps every parallel straight
  // and the map a proper rectangular band, while still finite (no Mercator-pole
  // infinity under a tilt).
  const clipRad = (CLIP_LAT * Math.PI) / 180;
  const clampPhi = (φ: number): number => Math.max(-clipRad, Math.min(clipRad, φ));
  type RawProjection = ((λ: number, φ: number) => [number, number]) & {
    invert?: (x: number, y: number) => [number, number];
  };
  let raw: RawProjection;
  if (distortion === 'conformal') {
    // Secant Mercator in the local frame: x = λ·cosφ_s, y = cosφ_s·ln(tan(π/4+φ/2)).
    // Uniform scale cosφ_s keeps it conformal and makes φ_s true-to-scale.
    raw = ((λ: number, φ: number): [number, number] => [
      λ * cosS,
      cosS * Math.log(Math.tan(Math.PI / 4 + clampPhi(φ) / 2)),
    ]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [
      x / cosS,
      2 * Math.atan(Math.exp(y / cosS)) - Math.PI / 2,
    ];
  } else if (distortion === 'equalArea') {
    // x = λ·cosφ_s, y = sinφ / cosφ_s  → area scale = cosφ_s (constant) on the band.
    raw = ((λ: number, φ: number): [number, number] => [λ * cosS, Math.sin(clampPhi(φ)) / cosS]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [x / cosS, Math.asin(Math.max(-1, Math.min(1, y * cosS)))];
  } else {
    // Equidistant: x = λ·cosφ_s, y = φ  (aspect narrows as the diameter shrinks).
    raw = ((λ: number, φ: number): [number, number] => [λ * cosS, clampPhi(φ)]) as RawProjection;
    raw.invert = (x: number, y: number): [number, number] => [x / cosS, y];
  }
  const proj = d3Geo.geoProjection(raw);
  // precision(0) disables adaptive resampling. With it ON, d3's resampler treats
  // the rotate-wrapped cylindrical projection as oblique and approximates each
  // segment with great-circle arcs — bending the straight top/bottom parallels
  // into an arc, so the whole map looked like an "egg". Turning it off keeps the
  // parallels straight (a proper rectangular cylindrical map); the input data
  // (graticule / coastlines) already carry enough vertices to stay smooth, and
  // under a tilt the straight-in-data lines correctly bend on the globe.
  proj.precision(0);
  return proj;
}

export const getD3Projection = (state: ProjectionParams): GeoProjection => {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, azLight } = state;

  let proj: GeoProjection;

  if (family === 'cylindrical') {
    // The cylinder radius is `scaleFactor`·R, so it meets the globe at the contact
    // parallels ±φ_s where cos φ_s = scaleFactor (φ_s = arccos(scaleFactor)). Those
    // are the (true-scale) standard parallels of the developed surface — for the
    // conformal family a uniformly-scaled Mercator: rendering uses d3's plain
    // `geoMercator()` (a tangent Mercator, whose SHAPE is independent of the
    // uniform scale, so a secant conformal cylinder looks identical). The
    // cylinder's CONTACT (±φ_s) is what moves with the tilt: the d3 rotation below
    // re-orients the cylinder axis, so tilting the cylinder (gamma) carries the
    // low-distortion band to the new cylinder equator (Antarctica on it keeps the
    // least scale error). `computeAreaDistortion` references the contact ±φ_s, so
    // the reported distortion still drops as the diameter shrinks. Equal-area /
    // equidistant set their standard parallel directly to the contact (measured
    // from the cylinder axis, not from phiOrigin).
    if (distortion === 'conformal') {
      proj = makeCylindricalProjection('conformal', scaleFactor);
    } else if (distortion === 'equalArea') {
      proj = makeCylindricalProjection('equalArea', scaleFactor);
    } else {
      proj = makeCylindricalProjection('equidistant', scaleFactor);
    }
  } else if (family === 'conic') {
    if (distortion === 'conformal') proj = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') proj = d3Geo.geoConicEqualArea();
    else proj = d3Geo.geoConicEquidistant();
    // Secant cone: two standard parallels φ1 (the central-latitude tangent
    // parallel) and φ2 (the store's stdParallel2, when set). A tangent cone has
    // φ1 = φ2. The signed parallel keeps phiOrigin's hemisphere, so a southern
    // phiOrigin yields a southern standard parallel matching the 3D aux cone;
    // the equatorial fallback keeps the cone non-degenerate.
    const phi1 = signedStandardParallelDeg(phiOrigin);
    const phi2 = state.stdParallel2 != null ? state.stdParallel2 : phi1;
    proj = (proj as GeoConicProjection).parallels([phi1, phi2]);
  } else {
    // The azimuthal light-source position defines the projection: a point light
    // at the globe centre → gnomonic, at the antipode → stereographic, at
    // infinity (parallel beams) → orthographic. `math` mode falls back to the
    // distortion-selected analytic projection (equal-area / equidistant, while
    // conformal azimuthal is itself stereographic).
    if (azLight === 'center') proj = d3Geo.geoGnomonic();
    else if (azLight === 'antipode') proj = d3Geo.geoStereographic();
    else if (azLight === 'infinity') proj = d3Geo.geoOrthographic();
    else if (distortion === 'conformal') proj = d3Geo.geoStereographic();
    else if (distortion === 'equalArea') proj = d3Geo.geoAzimuthalEqualArea();
    else proj = d3Geo.geoAzimuthalEquidistant();
  }

  // Apply rotation / scale / translate from the store state (spec §4). The 2D
  // map is the projection ONTO the (developable) surface. Tilting a cylinder is
  // geometrically equivalent to tilting the GLOBE relative to the (fixed, straight)
  // cylinder — i.e. it shifts the cylinder's central latitude. So for the
  // cylindrical family `gamma` is folded into `phiOrigin` (NOT as a roll/third
  // rotation component, which would skew the map into an "egg"). The map therefore
  // stays a straight rectangle (precision(0) keeps its parallels flat) while its
  // CONTENT (coastlines, graticule) shifts exactly as the 3D tube does when tilted.
  // Conic / azimuthal genuinely change their orientation in space, so they keep
  // the true `gamma` roll.
  const tiltLat = family === 'cylindrical' ? phiOrigin + gamma : phiOrigin;
  proj
    .rotate([-(lambda0), -tiltLat, family === 'cylindrical' ? 0 : -gamma])
    .scale(MAP_SCALE * scaleFactor)
    .translate([VIEW_CENTER_X + falseEasting, VIEW_CENTER_Y + falseNorthing]);

  return proj;
};

// Local area scale factor (projected px² per steradian) of `proj` at (lon,lat),
// measured from a small quad of half-size `d` degrees. Returns null when any
// corner falls outside the projection's clip, or when the projected quad folds
// onto itself (a discontinuity such as the azimuthal antipode) so it can't
// represent a real local area.
function localAreaScale(proj: GeoProjection, lon: number, lat: number, d: number): number | null {
  const corners: ([number, number] | null)[] = [
    proj([lon - d, lat - d]) as [number, number] | null,
    proj([lon + d, lat - d]) as [number, number] | null,
    proj([lon + d, lat + d]) as [number, number] | null,
    proj([lon - d, lat + d]) as [number, number] | null,
  ];
  if (corners.some((c) => !c || !isFinite(c[0]) || !isFinite(c[1]))) return null;
  const p = corners as [number, number][];
  // A folded (self-intersecting) projected quad — e.g. a cell straddling the
  // azimuthal antipode — yields a meaningless area; skip it so it can't
  // masquerade as the least-distorted reference and inflate the distortion.
  if (quadSelfIntersects(p)) return null;
  // Shoelace area of the projected quad.
  let projArea = 0;
  for (let i = 0; i < p.length; i++) {
    const [x1, y1] = p[i];
    const [x2, y2] = p[(i + 1) % p.length];
    projArea += x1 * y2 - x2 * y1;
  }
  projArea = Math.abs(projArea) / 2;
  const rad = Math.PI / 180;
  const trueArea = Math.cos(lat * rad) * (2 * d * rad) * (2 * d * rad);
  if (trueArea <= 0) return null;
  return projArea / trueArea;
}

// Orientation of the ordered triple (a, b, c); sign tells which side c is of
// the directed segment a→b.
function orient(a: [number, number], b: [number, number], c: [number, number]): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
}

// True when the two non-adjacent edge pairs of the quad cross — i.e. the quad
// is a self-intersecting "bow-tie" in the projection plane.
function quadSelfIntersects(p: [number, number][]): boolean {
  const seg = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
    orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0;
  return seg(p[0], p[1], p[2], p[3]) || seg(p[1], p[2], p[3], p[0]);
}

// Beyond this multiple of the centre area scale a sampled cell is certainly an
// artifact (a projection discontinuity stretched the quad), not real distortion.
const ARTIFACT_SCALE_LIMIT = 50;

// Area-weighted mean area distortion of a projection, as a percentage. The
// reference is the projection's LEAST-distorted area scale (taken as 100%) —
// the standard parallel / the surface–globe intersection where the area scale
// is minimal. For a tangent surface that is the centre; for a secant (immersed)
// cylinder it is the two intersection parallels, so the reported distortion
// responds to the cylinder diameter and matches the 3D intersection rings. An
// equal-area projection keeps a constant area scale everywhere → 0%.
export function computeAreaDistortion(params: ProjectionParams): number {
  const proj = getD3Projection(params);
  const d = 0.25; // half-size of the sampling quad, degrees (small → low curvature error)
  // Reference = the area scale at the standard parallel (where true scale = 1),
  // NOT the map centre. Local area scale is measured in pixel²/steradian, so the
  // reference must be the value AT the undistorted latitude, not a fixed constant
  // (the constant factor differs per distortion type). For a cylindrical family
  // the standard parallels are the surface–globe intersections at ±arccos(
  // scaleFactor) (a tangent cylinder is the single-intersection limit at
  // scaleFactor = 1); referencing them makes the reported distortion DROP as the
  // cylinder diameter shrinks, matching the 3D intersection rings. Conic/azimuthal
  // treat scaleFactor as a true zoom, so they keep the centre as the reference.
  let aRef: number | null;
  if (params.family === 'cylindrical') {
    const s = Math.max(0, Math.min(1, params.scaleFactor));
    const phiS = (Math.acos(s) * 180) / Math.PI; // standard-parallel latitude magnitude, in degrees
    // World latitude φ_s displays at φ_s − phiOrigin under the projection's
    // latitude rotation; both intersection parallels are candidates.
    const cands = [phiS - params.phiOrigin, -phiS - params.phiOrigin];
    let best: number | null = null;
    for (const lat of cands) {
      const a = localAreaScale(proj, params.lambda0, lat, d);
      if (a != null && a > 0) best = best == null ? a : Math.min(best, a);
    }
    if (best == null) {
      const centre = localAreaScale(proj, params.lambda0, params.phiOrigin, d);
      best = centre != null && centre > 0 ? centre : null;
    }
    aRef = best;
  } else {
    const centre = localAreaScale(proj, params.lambda0, params.phiOrigin, d);
    aRef = centre != null && centre > 0 ? centre : null;
  }
  const scales: number[] = [];
  const weights: number[] = [];
  for (let lat = -80; lat <= 80; lat += 10) {
    for (let lon = -180; lon < 180; lon += 10) {
      // Skip quads that straddle the antimeridian (lon ±180): the projection
      // wraps them across the whole map, producing a phantom huge area-scale.
      if (lon - d <= -180 || lon + d >= 180) continue;
      const a = localAreaScale(proj, lon, lat, d);
      if (a == null || a <= 0) continue;
      // Drop cells stretched far past the centre scale (discontinuity artifacts).
      if (aRef != null && a > aRef * ARTIFACT_SCALE_LIMIT) continue;
      scales.push(a);
      weights.push(Math.cos((lat * Math.PI) / 180));
    }
  }
  if (scales.length === 0) return 0;
  const reference = aRef != null ? aRef : Math.min(...scales);
  if (reference <= 0) return 0;
  let num = 0;
  let den = 0;
  for (let i = 0; i < scales.length; i++) {
    // "Excess" area is non-negative; sub-reference samples are sampling noise.
    num += weights[i] * Math.max(0, scales[i] / reference - 1);
    den += weights[i];
  }
  return den > 0 ? (num / den) * 100 : 0;
}

// Fit object used to size the 2D map. A full {type:'Sphere'} is infinite for
// some projections (e.g. conic conformal, where the pole maps to infinity), so
// `fitExtent` there collapses to a degenerate scale. Clipping the fit target to
// a ±CLIP_LAT band keeps the bounds finite and the map filling the viewport.
function makeFitSphere(): Polygon {
  const top: [number, number][] = [];
  const bot: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon += 10) top.push([lon, CLIP_LAT]);
  for (let lon = 180; lon >= -180; lon -= 10) bot.push([lon, -CLIP_LAT]);
  return { type: 'Polygon', coordinates: [[...top, ...bot, [-180, CLIP_LAT]]] };
}
export const FIT_SPHERE: Polygon = makeFitSphere();

// True when the screen point (x, y) lies over the rendered (clipped ±85°)
// globe area, so a hover there maps to a meaningful (lon, lat). We reject
// points outside the projected sphere's bounding box (e.g. the letter-boxed
// margins around a fitted map) and points that re-project far from the cursor
// (the hidden hemisphere of an azimuthal projection, or projection
// discontinuities, round-trip to a different location). Prevents the hover
// marker / ray from being drawn for cursor positions that are off the map.
export function isPointerOverGlobe(path: d3Geo.GeoPath, x: number, y: number): boolean {
  const proj = path.projection() as d3Geo.GeoProjection | null;
  if (!proj) return false;
  const inv = proj.invert?.([x, y]);
  if (!inv || !isFinite(inv[0]) || !isFinite(inv[1])) return false;
  const fwd = proj([inv[0], inv[1]]);
  if (!fwd || !isFinite(fwd[0]) || !isFinite(fwd[1])) return false;
  const b = path.bounds({ type: 'Sphere' });
  if (fwd[0] < b[0][0] - 1 || fwd[0] > b[1][0] + 1 || fwd[1] < b[0][1] - 1 || fwd[1] > b[1][1] + 1) {
    return false;
  }
  if (Math.hypot(fwd[0] - x, fwd[1] - y) > 1.5) return false;
  return true;
}

// Fit a configured projection so the map fills the whole available
// `width`×`height` area (small uniform `margin`), preserving the projection's
// OWN aspect ratio — like `object-fit: contain`. The map thus always occupies
// the full viewport regardless of `scaleFactor`; a changing diameter is visible
// through the projection's aspect (equal-area/equidistant change shape with the
// standard parallel), not through the overall map size. `fitExtent` uses a
// **clipped ±85° sphere** (`FIT_SPHERE`), NOT a full `{type:'Sphere'}`: for
// `geoConicConformal` the pole maps to infinity, so a full-Sphere `fitExtent`
// collapses the scale to near-zero (the globe renders as an empty half-disk);
// the clip keeps the fitted scale finite. The 3D scene keeps the fixed
// `scale(100)` from getD3Projection; only the 2D map overrides it via this helper.
export function fitProjectionToView(
  proj: GeoProjection,
  width: number,
  height: number,
  margin = FIT_MARGIN,
): GeoProjection {
  proj.fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    FIT_SPHERE,
  );
  return proj;
}
