import type { CSSProperties } from 'react';

// Thin divider line with a neon glow that stays on the line only (no block
// background), used to separate the interface regions.
export function Divider({ vertical = false }: { vertical?: boolean }) {
  const style: CSSProperties = vertical
    ? {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: '33.333%',
        width: 1,
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
      }
    : {
        position: 'absolute',
        left: 0,
        right: 0,
        top: '33.333%',
        height: 1,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 8px rgba(0, 229, 255, 0.6)',
      };
  return <div style={style} aria-hidden="true" />;
}
