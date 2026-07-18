import type { ProjectionFamily } from '../../store/useAppStore';

export function FamilyIcon({ family }: { family: ProjectionFamily }) {
  if (family === 'cylindrical') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12" />
        <path d="M19 6v12" />
        <path d="M5 18a7 3 0 0 0 14 0" />
      </svg>
    );
  }
  if (family === 'conic') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 4 18 19H6Z" />
        <path d="M6 19a6 2 0 0 0 12 0" />
      </svg>
    );
  }
  if (family === 'azimuthalPerspective') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4v16M4 12h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 0 0 16M12 4a8 8 0 0 1 0 16" opacity="0.6" />
    </svg>
  );
}

export function EpsgIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </svg>
  );
}

export function TissotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v4h4" />
    </svg>
  );
}

export function BorderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 5h14v14H5z" />
      <path d="M5 12h14M12 5v14" />
    </svg>
  );
}

export function DetailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 3 21 8l-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </svg>
  );
}

export function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IntersectionIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.4 8.6c3 1.2 14 1.2 17 0" />
      <path d="M3.4 15.4c3 -1.2 14 -1.2 17 0" />
    </svg>
  );
}

export function HoverRayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="7" cy="7" r="3.2" />
      <path d="M9.3 9.3 19 19" />
      <circle cx="19" cy="19" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---- New icons for the visualization panel, catalog and badges ----

export function RulerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 8l13-5 5 13-13 5z" />
      <path d="M8 7l1.5 1M12 9l1.5 1M16 11l1.5 1" />
    </svg>
  );
}

export function HeatmapIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 14h16M4 9h16M9 4v16M14 4v16" opacity="0.55" />
    </svg>
  );
}

export function FiguresIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="3" />
      <rect x="13" y="13" width="6" height="6" rx="1" />
    </svg>
  );
}

export function RaysIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2.4" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2" />
    </svg>
  );
}

export function GraticuleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3v18" />
    </svg>
  );
}

export function UnfoldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3v6m0 6v6" />
      <path d="M8 9h8a4 4 0 0 1 4 4v0M16 9a4 4 0 0 0-4-4M8 9a4 4 0 0 1-4-4" opacity="0.6" />
    </svg>
  );
}

export function NorthSouthIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M12 21V3" />
      <path d="M9 6l3-3 3 3M9 18l3 3 3-3" />
    </svg>
  );
}

export function SatelliteIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M5 13l4 4M9 17l-2 2M11 9l4 4" />
      <rect x="13" y="3" width="5" height="4" rx="1" transform="rotate(45 15.5 5)" />
      <path d="M14 14l4 4M18 18a4 4 0 0 1-4 4" opacity="0.6" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

// Catalog-group surface icons.
export function CylinderSurfaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12M19 6v12M5 18a7 3 0 0 0 14 0" />
    </svg>
  );
}

export function ConeSurfaceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 4 18 19H6Z" />
      <path d="M6 19a6 2 0 0 0 12 0" />
    </svg>
  );
}

export function LightSourceIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" />
    </svg>
  );
}

export function PlaneMathIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18M12 3a9 9 0 0 1 0 18" opacity="0.6" />
    </svg>
  );
}
