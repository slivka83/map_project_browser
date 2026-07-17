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

// Thin divider line + glow between the control panel and the 3D globe column.
export const NEON_DIVIDER = 'rgba(0, 229, 255, 0.16)';
export const NEON_DIVIDER_GLOW = '0 0 3px rgba(0, 229, 255, 0.28), 0 0 6px rgba(0, 229, 255, 0.15)';
