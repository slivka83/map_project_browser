// Shared design tokens (spec §5). Colors used by both the 2D SVG map and the
// 3D scene so the neon palette stays consistent across the app.
export const NEON_BLUE = '#00e5ff';
export const NEON_ORANGE = '#ff6a00';
export const NEON_YELLOW = '#ffe600';
export const NEON_WHITE = '#ffffff';
export const BG = '#05050A';

// Glass-panel background used by ControlPanel / Dropdown / EpsgCatalog.
export const PANEL_BG = '#0b0b14';

// Alpha-tinted neon variants (derivatives of NEON_BLUE / NEON_ORANGE).
export const NEON_BLUE_SOFT = 'rgba(0, 229, 255, 0.5)';
export const NEON_BLUE_LINE = 'rgba(0, 229, 255, 0.55)';
export const NEON_ORANGE_SOFT = 'rgba(255, 106, 0, 0.4)';

// Neon glow used for active overlay icons (drop-shadow CSS filter string).
export const NEON_BLUE_GLOW = `drop-shadow(0 0 6px ${NEON_BLUE}) drop-shadow(0 0 12px rgba(0,229,255,0.8))`;

// Thin divider line + glow between the control panel and the 3D globe column.
export const NEON_DIVIDER = 'rgba(0, 229, 255, 0.16)';
export const NEON_DIVIDER_GLOW = '0 0 3px rgba(0, 229, 255, 0.28), 0 0 6px rgba(0, 229, 255, 0.15)';
