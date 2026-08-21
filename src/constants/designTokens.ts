// Shared design tokens (spec §5). Colors used by both the 2D SVG map and the
// 3D scene so the neon palette stays consistent across the app.
export const NEON_BLUE = '#00e5ff';
export const NEON_ORANGE = '#ff6a00';
export const NEON_YELLOW = '#ffe600';
export const NEON_WHITE = '#ffffff';
export const BG = '#05050A';

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

// Additional palette tokens for the new visualization methods, touch-point
// markers and cut line. Kept in sync with the 2D map and the 3D scene.
export const NEON_GREEN = '#00ff66'; // touch-point / tangency marker
export const NEON_RED = '#ff3333'; // cut line
