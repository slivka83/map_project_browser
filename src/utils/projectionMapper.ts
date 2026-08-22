import * as d3Geo from 'd3-geo';
import type { GeoProjection, GeoConicProjection } from 'd3-geo';
import type { Polygon } from 'geojson';
import type { ProjectionParams } from '../store/useAppStore';
import {
  MAP_SCALE,
  VIEW_CENTER_X,
  VIEW_CENTER_Y,
  CLIP_LAT,
  CLAMP_LAT,
  FIT_MARGIN,
  signedStandardParallelDeg,
} from '../constants/geometry';

const clampScale = (s: number): number => Math.max(0, Math.min(1, s));

// Tags the cylindrical GeoProjection instances with their central latitude
// (Параллель 1) so fitProjectionToView can centre the 2D map window on it. The
// map itself is always a STANDARD (non-tilted) cylindrical projection — the
// chosen parallel only shifts the window vertically; it never tilts the map.
const cylCenterMap = new WeakMap<GeoProjection, number>();

// Geometric cylindrical projection in the CYLINDER frame: x = λ·cosφ_s, y = h(φ)
// with the standard parallel at the contact φ_s (φ_s = arccos(scaleFactor)). The
// 2D map is a FLAT standard cylindrical map: getD3Projection applies only the
// central-meridian rotation [-lambda0, 0, 0] — the central latitude (Параллель
// 1) NEVER tilts the map, fitProjectionToView shifts the viewport window so the
// chosen parallel sits on the middle row instead (cylCenterMap). The tilt (gamma)
// is likewise ignored for the cylindrical family. The 3D tube still tilts in
// space (see auxSurfaceGeometry.ts); its rays are built from the φ₁ = 0
// projection and rotate rigidly with the tube, so the map stays flat while the
// 3D shows the tilted surface.
// The cylinder is a FINITE tube of radius r = scaleFactor·R touching the globe
// at the contact latitudes ±φ_s measured from the cylinder axis. The projection
// keeps the chosen property (conformal / equal-area / equidistant) by its height
// law; the map window (see fitProjectionToView) never extends beyond ±CLIP_LAT.
function makeCylindricalProjection(
  distortion: ProjectionParams['distortion'],
  scaleFactor: number,
): GeoProjection {
  const s = clampScale(scaleFactor);
  const phiS = Math.acos(s); // contact latitude from the cylinder axis (radians)
  const cosS = Math.cos(phiS);
  // The raw height law is clamped only to ±CLAMP_LAT (just beyond the visible
  // window edge, which never exceeds ±CLIP_LAT) purely to keep the Mercator law
  // finite at the pole (y = ln(tan(π/4+φ/2)) → ∞ at φ = 90°) and d3 robust
  // against non-finite coordinates. The clamped cap is always outside the map
  // window (see fitProjectionToView) and is never drawn.
  const clampRad = (CLAMP_LAT * Math.PI) / 180;
  const clampPhi = (φ: number): number => Math.max(-clampRad, Math.min(clampRad, φ));
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
  // precision(0) disables adaptive resampling. With it ON, d3's resampler
  // approximates each segment with great-circle arcs, which would bend the
  // straight parallels into arcs (the "egg"). The map is always the standard
  // (non-oblique) cylindrical projection, so resampling is never needed.
  proj.precision(0);
  return proj;
}

export const getD3Projection = (state: ProjectionParams): GeoProjection => {
  const { family, distortion, lambda0, phiOrigin, scaleFactor, falseEasting, falseNorthing, gamma, azLight } = state;

  let proj: GeoProjection;

  if (family === 'cylindrical') {
    if (distortion === 'conformal') {
      proj = makeCylindricalProjection('conformal', scaleFactor);
    } else if (distortion === 'equalArea') {
      proj = makeCylindricalProjection('equalArea', scaleFactor);
    } else {
      proj = makeCylindricalProjection('equidistant', scaleFactor);
    }
    // The 2D cylindrical map is a FLAT standard map: only the central meridian
    // rotates it. The central latitude φ₁ (Параллель 1) does NOT tilt the map —
    // fitProjectionToView shifts the viewport window so the chosen parallel sits
    // on the middle row. (The 3D tube still tilts by φ₁; its rays are built from
    // the φ₁ = 0 projection and rotate rigidly with the tube.)
    proj
      .rotate([-lambda0, 0, 0])
      .scale(MAP_SCALE * scaleFactor)
      .translate([VIEW_CENTER_X + falseEasting, VIEW_CENTER_Y + falseNorthing]);
    // Mark cylindrical projections so fitProjectionToView can centre the window
    // on the central parallel and clip it at the window rows.
    cylCenterMap.set(proj, phiOrigin);
    // precision(0) keeps the parallels straight horizontal lines (no "egg");
    // there is no oblique aspect anymore, so adaptive resampling is never needed.
    proj.precision(0);
    return proj;
  }

  if (family === 'conic') {
    if (distortion === 'conformal') proj = d3Geo.geoConicConformal();
    else if (distortion === 'equalArea') proj = d3Geo.geoConicEqualArea();
    else proj = d3Geo.geoConicEquidistant();
    // The standard parallel already carries phiOrigin's sign (see
    // signedStandardParallelDeg), so NO extra hemisphere sign is applied — that
    // would double-flip and build a northern cone for a southern phiOrigin.
    const phi1 = signedStandardParallelDeg(phiOrigin);
    const phi2 = state.stdParallel2 != null ? state.stdParallel2 : phi1;
    proj = (proj as GeoConicProjection).parallels([phi1, phi2]);
    const rotZ = -gamma;
    proj
      .rotate([-lambda0, -phiOrigin, rotZ])
      .scale(MAP_SCALE * scaleFactor)
      .translate([VIEW_CENTER_X + falseEasting, VIEW_CENTER_Y + falseNorthing]);
    return proj;
  }

  // azimuthalPerspective: the light-source position defines the projection
  // (center → gnomonic, antipode → stereographic, infinity → orthographic).
  if (azLight === 'center') proj = d3Geo.geoGnomonic();
  else if (azLight === 'antipode') proj = d3Geo.geoStereographic();
  else proj = d3Geo.geoOrthographic();
  const rotZ = -gamma;
  proj
    .rotate([-lambda0, -phiOrigin, rotZ])
    .scale(MAP_SCALE * scaleFactor)
    .translate([VIEW_CENTER_X + falseEasting, VIEW_CENTER_Y + falseNorthing]);
  return proj;
};



// Local area scale factor (projected px² per steradian) of `proj` at (lon,lat),
// measured from a small quad of half-size `d` degrees. Returns null when any
// corner falls outside the projection's clip, or when the projected quad folds
// onto itself (a discontinuity such as the azimuthal antipode) so it can't
// represent a real local area.
export function localAreaScale(proj: GeoProjection, lon: number, lat: number, d: number): number | null {
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
  let aRef: number | null;
  if (params.family === 'cylindrical') {
    const s = Math.max(0, Math.min(1, params.scaleFactor));
    const phiS = (Math.acos(s) * 180) / Math.PI; // standard-parallel latitude magnitude, in degrees
    // The 2D cylindrical map is the STANDARD (un-tilted) projection, so the
    // contact (least-distorted) parallels sit at geographic ±phiS regardless of
    // Параллель 1 — the map only shifts its window, it does not rotate.
    const cands = [phiS, -phiS];
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
  } else if (params.family === 'conic') {
    // Near the equator the conic standard parallel falls back to ±30° (see
    // signedStandardParallelDeg); the reference area scale must be measured at
    // that same parallel, not at phiOrigin (which may sit far from it).
    const phi1 = signedStandardParallelDeg(params.phiOrigin);
    const centre = localAreaScale(proj, params.lambda0, phi1, d);
    aRef = centre != null && centre > 0 ? centre : null;
  } else {
    const lam = params.lambda0;
    const centre = localAreaScale(proj, lam, params.phiOrigin, d);
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
// standard parallel), not through the overall map size.
//
// For the conic / azimuthal families `fitExtent` uses a **clipped ±85° sphere**
// (`FIT_SPHERE`), NOT a full `{type:'Sphere'}`: for `geoConicConformal` the pole
// maps to infinity, so a full-Sphere `fitExtent` collapses the scale to near-zero
// (the globe renders as an empty half-disk); the clip keeps the fitted scale
// finite. The 3D scene keeps the fixed `scale(100)` from getD3Projection; only
// the 2D map overrides it via this helper.
//
// The cylindrical family is different: the 2D map is a FLAT standard cylindrical
// projection, and Параллель 1 (the 3D tube's tilt angle) only SHIFTS the map —
// the scale is computed once from the full ±CLIP_LAT band and never depends on
// it, so moving the parallel is a pure vertical scroll (like longitude's
// horizontal wrap). The translate centres the chosen parallel on the middle row,
// and the clipExtent is the FIXED viewport frame: it never moves — only the
// content scrolls beneath a stable window, exactly like longitude.
export function fitProjectionToView(
  proj: GeoProjection,
  width: number,
  height: number,
  margin = FIT_MARGIN,
  fitTarget: Polygon | null = null,
): GeoProjection {
  const phiOrigin = cylCenterMap.get(proj);
  if (phiOrigin !== undefined && fitTarget == null) {
    const rot = proj.rotate();
    // Probe the projection in the raw (un-rotated, unit-scale) frame.
    proj.rotate([0, 0, 0]).scale(1).translate([0, 0]);
    const halfWidth = (proj([180, 0]) as [number, number])[0];
    const topY = (proj([0, CLIP_LAT]) as [number, number])[1];
    const botY = (proj([0, -CLIP_LAT]) as [number, number])[1];
    const rawY = (lat: number): number => (proj([0, lat]) as [number, number])[1];
    proj.rotate(rot);
    const y85 = -topY; // raw height of the ±CLIP_LAT band edge
    // The scale comes from the FULL ±CLIP_LAT band and is INDEPENDENT of
    // Параллель 1: moving it only SHIFTS the map vertically — exactly how
    // longitude shifts it horizontally. No zoom.
    const s = Math.min((width - 2 * margin) / (2 * halfWidth), (height - 2 * margin) / (botY - topY));
    // Centre the chosen parallel on the middle row (clamped into the band).
    const centerRaw = Math.min(y85, Math.max(-y85, -rawY(phiOrigin)));
    const t: [number, number] = [width / 2, height / 2 + centerRaw * s];
    proj.scale(s).translate(t);
    // The clip is the FIXED viewport frame: it never moves with Параллель 1 —
    // the content SCROLLS beneath a stable window (like longitude's horizontal
    // wrap), so the map never slides as a sheet. Only the translate moves.
    proj.clipExtent([
      [t[0] - halfWidth * s, margin],
      [t[0] + halfWidth * s, height - margin],
    ]);
    return proj;
  }
  proj.fitExtent(
    [
      [margin, margin],
      [width - margin, height - margin],
    ],
    fitTarget ?? FIT_SPHERE,
  );
  // For the cylindrical family (explicit fitTarget path), clip at the ±CLIP_LAT
  // band rows so the clamped cap is never drawn.
  if (cylCenterMap.has(proj)) {
    const s = proj.scale();
    const t = proj.translate();
    const rot = proj.rotate();
    proj.rotate([0, 0, 0]).scale(1).translate([0, 0]);
    const halfWidth = (proj([180, 0]) as [number, number])[0];
    const topY = (proj([0, CLIP_LAT]) as [number, number])[1];
    const botY = (proj([0, -CLIP_LAT]) as [number, number])[1];
    proj.rotate(rot).scale(s).translate(t);
    proj.clipExtent([
      [t[0] - halfWidth * s, t[1] + topY * s],
      [t[0] + halfWidth * s, t[1] + botY * s],
    ]);
  }
  return proj;
}
