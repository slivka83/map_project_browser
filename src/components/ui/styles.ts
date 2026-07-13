// Shared glass-panel + control styling (spec §5 "spaceship control panel" look).
// Colors come from CSS variables defined in index.css @theme so Tailwind can
// detect the literal class strings at build time.
export const panelClass = 'bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-3';
export const labelClass = 'text-[11px] uppercase tracking-wider text-neon-blue/80 whitespace-nowrap text-left';

export const activeTab = 'z-10 bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]';
export const inactiveTab = 'text-neon-blue/70 hover:text-neon-blue hover:bg-neon-blue/5';

// Square icon button used by overlay toggles and panel actions.
export const iconBtn = 'flex h-9 w-[54px] items-center justify-center rounded border border-neon-blue/50 bg-panel-bg text-neon-blue drop-shadow-[0_0_3px_var(--color-neon-blue-soft)] transition';

// Icon-only button (no rectangular backing) — just the neon icon.
export const iconBtnPlain =
  'flex h-9 w-9 items-center justify-center text-neon-blue/80 drop-shadow-[0_0_8px_var(--color-neon-blue-soft)] transition hover:text-neon-blue';
