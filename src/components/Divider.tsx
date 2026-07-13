import type { CSSProperties } from 'react';

// Thin vertical divider line (1px) with a neon glow that stays on the line
// only (no block background). Used to split the 1/3–2/3 columns.
export function Divider() {
  const style: CSSProperties = {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.333%',
    width: 1,
    borderLeft: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
  };
  return <div style={style} aria-hidden="true" />;
}
