// Shared design tokens (spec §5). Colors used by both the 2D SVG map and the
// 3D scene so the neon palette stays consistent across the app.
export const NEON_BLUE = '#00e5ff';
export const NEON_ORANGE = '#ff6a00';
export const NEON_YELLOW = '#ffe600';
export const NEON_WHITE = '#ffffff';
export const BG = '#05050A';

// Uniformly multiplies each RGB channel of a #rrggbb colour by `factor`
// (0 < factor ≤ 1) — the simple way to darken the neon palette on the
// near-black background without introducing a hue shift.
export const darkenHex = (hex: string, factor: number): string => {
  const n = hex.replace('#', '');
  const channel = (i: number): string =>
    Math.round(parseInt(n.slice(i, i + 2), 16) * factor)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(0)}${channel(2)}${channel(4)}`;
};

// The 3D globe's coastline ink: NEON_BLUE darkened by 25% (user decision
// 2026-08) so the continent outlines don't outshine the rest of the scene.
// The flat map keeps full-strength NEON_BLUE.
export const GLOBE_COASTLINE = darkenHex(NEON_BLUE, 0.75);

// Alpha-tinted neon variants (derivatives of NEON_BLUE / NEON_ORANGE).
export const NEON_BLUE_LINE = 'rgba(0, 229, 255, 0.55)';
export const NEON_ORANGE_SOFT = 'rgba(255, 106, 0, 0.4)';

// Muted stroke for the map graticule (parallels/meridians grid).
export const GRATICULE_STROKE = '#334155';

// Thin divider line + glow between the control panel and the 3D globe column.
export const NEON_DIVIDER = 'rgba(0, 229, 255, 0.16)';
export const NEON_DIVIDER_GLOW = '0 0 3px rgba(0, 229, 255, 0.28), 0 0 6px rgba(0, 229, 255, 0.15)';

// Neon underlay behind the left column (ControlPanel + GlobeScene): a thin
// neon-blue border with a soft inner/outer glow.
export const NEON_UNDERLAY_BORDER = '1px solid rgba(0, 229, 255, 0.30)';
export const NEON_UNDERLAY_BG = 'rgba(0, 229, 255, 0.04)';
export const NEON_UNDERLAY_GLOW = '0 0 22px rgba(0, 229, 255, 0.18), inset 0 0 16px rgba(0, 229, 255, 0.06)';
