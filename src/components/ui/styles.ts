import { NEON_BLUE } from '../../constants/designTokens';

// Shared glass-panel + control styling (spec §5 "spaceship control panel" look).
// Colors come from CSS variables defined in index.css @theme so Tailwind can
// detect the literal class strings at build time.
export const labelClass = 'text-[11px] uppercase tracking-wider text-neon-blue/80 whitespace-nowrap text-left';

export const activeTab = 'z-10 bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]';
export const inactiveTab = 'text-neon-blue/70 hover:text-neon-blue hover:bg-neon-blue/5';

// Icon-only button (no rectangular backing) — just the neon icon.
export const iconBtnPlain =
  'flex h-9 w-9 items-center justify-center rounded text-neon-blue/80 transition hover:text-neon-blue hover:bg-neon-blue/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70';
export const iconGlow = (active: boolean): string =>
  active
    ? `drop-shadow(0 0 4px ${NEON_BLUE}) drop-shadow(0 0 10px rgba(0,229,255,1)) drop-shadow(0 0 20px rgba(0,229,255,0.9)) drop-shadow(0 0 32px rgba(0,229,255,0.6))`
    : 'drop-shadow(0 0 4px rgba(0,229,255,0.45))';

// ---- Shared layout / surface primitives (design system) ----

// The translucent "glass" panel used by modals and the map's floating chips.
export const glassPanel =
  'rounded-lg border border-white/10 bg-white/5 backdrop-blur-md text-gray-300';

// Full-screen modal overlay (dimmed, blurred) + the centred modal shell.
export const modalOverlay =
  'fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm';
export const modalShell =
  'flex max-h-[80vh] flex-col overflow-hidden rounded-lg border border-white/10 bg-panel-bg p-4 shadow-2xl';

// A labelled section inside the control panel.
export const fieldRow = 'flex items-center gap-[12px]';

// Slider track styling (accent + accessible focus ring). `min-w-0` lets the
// range input shrink below its intrinsic ~129px so rows never overflow.
export const sliderClass =
  'h-1 min-w-0 flex-1 cursor-pointer rounded-full bg-white/10 accent-neon-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70 disabled:opacity-40';

export const radioGroup = 'flex gap-1';
export const radioOption =
  'rounded px-2 py-1 text-[11px] uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70';
export const radioOptionActive = 'bg-neon-blue/15 text-neon-blue';
export const radioOptionInactive = 'text-neon-blue/70 hover:bg-neon-blue/5';

export const presetChip =
  'rounded border border-neon-blue/40 px-2 py-1 text-[11px] text-neon-blue/80 transition hover:bg-neon-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70';
export const presetChipActive = 'bg-neon-blue/20 text-neon-blue';
