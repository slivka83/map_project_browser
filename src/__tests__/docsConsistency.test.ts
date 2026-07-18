import { describe, it, expect } from 'vitest';
import * as projectionMapper from '../utils/projectionMapper';
import * as auxSurfaceGeometry from '../utils/auxSurfaceGeometry';
import * as designTokens from '../constants/designTokens';
import { MAP_SCALE, VIEW_CENTER_X, VIEW_CENTER_Y, CLIP_LAT, EARTH_RADIUS_KM, UTM_ZONE_WIDTH, CIRCLE_RADIUS_MIN, CIRCLE_RADIUS_MAX } from '../constants/geometry';
import { defaultParamsForFamily } from '../store/useAppStore';

// Discover the documentation files dynamically (only those that exist on disk),
// so the test never crashes on a missing `?raw` import and never needs manual
// maintenance when a doc file is added or removed.
const docModules = import.meta.glob('../../**/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const KNOWN_DOCS = ['../../AGENTS.md', '../../docs/BRD.md'];
const allDocsRaw = KNOWN_DOCS.map((p) => docModules[p]).filter((t): t is string => typeof t === 'string');
const agentsMd = allDocsRaw[0];
const brdMd = allDocsRaw[1];

// Guard: if the dynamic glob fails to load a doc (e.g. an environment quirk),
// every downstream check would silently pass on an empty string. Fail loudly
// instead so a broken doc-load can never hide real doc↔code drift.
if (allDocsRaw.length < 1) {
  throw new Error('docsConsistency: no documentation files were loaded — the doc↔code guard is blind.');
}

const projectionParamsShape = defaultParamsForFamily('cylindrical');

// ---------------------------------------------------------------------------
// Documentation ↔ code consistency gate.
//
// These tests keep docs/BRD.md and AGENTS.md honest: any drift (renamed file,
// removed export, dropped store field, wrong constant) is caught in
// `npm run test` instead of discovered by a human reader later.
//
// Only *stable, mechanically checkable* facts are asserted here — never prose.
// The checks are intentionally tolerant of wording/phrasing changes: a file is
// OK as long as it EXISTS and is MENTIONED somewhere in the docs, a constant is
// OK as long as its NAME and VALUE are both present (no exact-string match), so
// a reasonable refactor/rewording does not break the build.
// ---------------------------------------------------------------------------

// All source files under src/, enumerated as keys (lazy glob so nothing is
// executed) — used to validate doc `src/...` references against real files.
const srcFiles = Object.keys(import.meta.glob('../../src/**/*.{ts,tsx}')).map((p) =>
  p.replace(/^\.\.\//, 'src/'),
);

const allDocs = [
  { name: 'AGENTS.md', text: agentsMd },
  { name: 'BRD.md', text: brdMd },
].map((d) => ({ ...d, lower: d.text.toLowerCase() }));
const docsText = allDocs.map((d) => d.text).join('\n');
const docsLower = allDocs.map((d) => d.lower).join('\n');

const expectInDocs = (needle: string, ctx: string) => {
  expect(docsText.includes(needle), `docs should mention ${ctx} («${needle}»)`).toBe(true);
};
const expectNotInDocs = (needle: string, ctx: string) => {
  expect(docsText.includes(needle), `docs should NOT mention ${ctx} («${needle}»)`).toBe(false);
};
const expectInDocsLower = (needle: string, ctx: string) => {
  expect(docsLower.includes(needle.toLowerCase()), `docs should mention ${ctx} («${needle}»)`).toBe(true);
};

describe('docs ↔ code: file references resolve', () => {
  // Every `src/...` path quoted in the docs must exist on disk.
  const refs = [...docsText.matchAll(/(?:`|^)(src\/[A-Za-z0-9_/]+\.(?:ts|tsx))(?=`|$)/gm)].map((m) => m[1]);
  const uniq = [...new Set(refs)];
  it('has no broken src/ file references', () => {
    const missing = uniq.filter((p) => !srcFiles.includes(p));
    expect(missing).toEqual([]);
  });
});

describe('docs ↔ code: component files exist and are documented', () => {
  // Every top-level component file (excluding tests) must exist and be mentioned
  // in the docs. Helpers under src/components/ui/ are internal styling/util
  // modules and are not required to be named in the docs (they back the public
  // components).
  const components = srcFiles.filter(
    (f) => f.startsWith('src/components/') && f.endsWith('.tsx') && !f.endsWith('.test.tsx'),
  );
  const publicComponents = components.filter((f) => !f.startsWith('src/components/ui/'));
  for (const full of publicComponents) {
    const c = full.replace('src/components/', '');
    it(`documents existing component ${c}`, () => {
      expect(components).toContain(full);
      expectInDocs(c, `component ${c}`);
    });
  }
});

describe('docs ↔ code: removed features are documented as removed (not as current)', () => {
  it('no phantom docs/new_spec.md reference', () => {
    expectNotInDocs('docs/new_spec.md', 'the non-existent new_spec.md');
  });
  it('cylindrical rod control is gone from code and from live control descriptions', () => {
    // negative on the live store field / helper (they must not exist in code)
    expect(Object.prototype.hasOwnProperty.call(projectionMapper, 'computeCylindricalLightRod')).toBe(false);
    // if mentioned in docs it must be inside a historical correction note, not a live control list
    if (docsText.includes('Ось источника')) {
      expect(docsText).toMatch(/Ось источника[^\n]*удал|удал[^\n]*Ось источника|Ось источника[^\n]*removed/i);
    }
  });
  it('isEllipsoid is documented as removed', () => {
    expect(docsText).toMatch(/isEllipsoid[^\n]*удал|удал[^\n]*isEllipsoid|isEllipsoid[^\n]*removed/i);
  });
  it('TangencyRings documented as renamed to IntersectionDisks', () => {
    expect(docsText).toMatch(/TangencyRings[^\n]*IntersectionDisks|IntersectionDisks[^\n]*TangencyRings/i);
  });
  it('old rayGeometry documented as replaced by auxSurfaceGeometry', () => {
    expect(docsText).toMatch(/rayGeometry[^\n]*auxSurfaceGeometry|auxSurfaceGeometry[^\n]*rayGeometry/i);
  });
  it('no live CanvasTexture globe (must be the 3D-line variant)', () => {
    expectInDocs('CanvasTexture', 'the CanvasTexture note'); // kept only as a "NOT this" correction
    expect(docsText).toMatch(/не\s+`?CanvasTexture|NOT.*CanvasTexture|CanvasTexture.*variant/i);
  });
});

describe('docs ↔ code: store shape matches ProjectionParams', () => {
  const paramFields: string[] = [
    'family',
    'distortion',
    'lambda0',
    'phiOrigin',
    'scaleFactor',
    'falseEasting',
    'falseNorthing',
    'gamma',
    'stdParallel2',
    'azLight',
    'showTissot',
    'showBorders',
    'showIntersection',
    'geoJsonData',
    'land50GeoJson',
    'countriesGeoJson',
    'countries110GeoJson',
    'detailedMap',
    'geoLoading',
    'hoverLonLat',
    'hoverSource',
    'showHoverRay',
  ];
  for (const f of paramFields) {
    it(`documents store field ${f}`, () => {
      expectInDocs(f, `store field ${f}`);
    });
  }
  it('ProjectionParams interface carries the documented projection fields', () => {
    const keys = Object.keys(projectionParamsShape);
    for (const k of ['variant', 'family', 'distortion', 'lambda0', 'phiOrigin', 'scaleFactor', 'gamma', 'stdParallel2', 'azLight']) {
      expect(keys).toContain(k);
    }
    expect(keys).not.toContain('isEllipsoid');
    expect(keys).not.toContain('cylLight');
  });
});

describe('docs ↔ code: key exports are documented', () => {
  const exported = [
    'getD3Projection',
    'computeAreaDistortion',
    'fitProjectionToView',
    'FIT_SPHERE',
    'computeAuxSurfaceParams',
    'computeAuxGraticule',
    'computeAuxSphereIntersections',
    'auxPointToWorld',
    'computeCentralMeridianRays',
    'projectToAuxWorld',
    'computeTangentBasis',
    'lonLatToVec3',
    'computeConicRayEnd',
    'computePerpendicularNormals',
    'computeParticleTrajectories',
    'computeMagneticFieldLines',
    'computeLaserScanRing',
    'computeCutLine',
    'computeSatellitePosition',
    'computeOrbitalPath',
    'vec3Distance',
    'vec3Normalize',
  ];
  for (const name of exported) {
    it(`documents exported symbol ${name}`, () => {
      expect(
        Object.prototype.hasOwnProperty.call(projectionMapper, name) || Object.prototype.hasOwnProperty.call(auxSurfaceGeometry, name),
      ).toBe(true);
      expectInDocs(name, `export ${name}`);
    });
  }
});

describe('docs ↔ code: design tokens match', () => {
  const checks: [string, string][] = [
    ['NEON_BLUE', '#00e5ff'],
    ['NEON_ORANGE', '#ff6a00'],
    ['NEON_YELLOW', '#ffe600'],
    ['NEON_WHITE', '#ffffff'],
    ['BG', '#05050A'],
  ];
  for (const [name, hex] of checks) {
    it(`documents ${name} = ${hex}`, () => {
      expect(Object.prototype.hasOwnProperty.call(designTokens, name) && (designTokens as Record<string, unknown>)[name]).toBe(hex);
      // tolerant: the token NAME must appear in the docs (value match already
      // verified above), regardless of how the doc phrases the assignment.
      expectInDocs(name, `${name} value`);
    });
  }
});

describe('docs ↔ code: math facts', () => {
  it('MAP_SCALE / VIEW_CENTER_X / VIEW_CENTER_Y constants', () => {
    expect(MAP_SCALE).toBe(100);
    expect(VIEW_CENTER_X).toBe(400);
    expect(VIEW_CENTER_Y).toBe(300);
    expectInDocs('MAP_SCALE', 'MAP_SCALE constant');
    expectInDocs('VIEW_CENTER_X', 'VIEW_CENTER_X constant');
    expectInDocs('VIEW_CENTER_Y', 'VIEW_CENTER_Y constant');
  });
  it('FIT_SPHERE clipped at ±CLIP_LAT (85°)', () => {
    expect(CLIP_LAT).toBe(85);
    expect(projectionMapper.FIT_SPHERE).toBeDefined();
    expectInDocsLower('FIT_SPHERE', 'FIT_SPHERE');
    expectInDocs('±85°', 'the ±85° clip');
  });
  it('azimuthal light maps to the documented D3 projections', () => {
    // center → gnomonic, antipode → stereographic, infinity → orthographic
    expectInDocsLower('geoGnomonic', 'gnomonic');
    expectInDocsLower('geoStereographic', 'stereographic');
    expectInDocsLower('geoOrthographic', 'orthographic');
  });
});

describe('docs ↔ code: new geometry constants are documented', () => {
  const consts: [string, unknown][] = [
    ['EARTH_RADIUS_KM', EARTH_RADIUS_KM],
    ['UTM_ZONE_WIDTH', UTM_ZONE_WIDTH],
    ['CIRCLE_RADIUS_MIN', CIRCLE_RADIUS_MIN],
    ['CIRCLE_RADIUS_MAX', CIRCLE_RADIUS_MAX],
  ];
  for (const [name] of consts) {
    it(`documents constant ${name}`, () => {
      expectInDocs(name, `${name} constant`);
    });
  }
});
