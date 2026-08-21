import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS,
  AZIMUTHAL_MATH_VARIANT_OPTIONS,
  variantDef,
  type ProjectionVariant,
} from '../utils/projectionVariants';
import type { ProjectionFamily } from '../store/useAppStore';
import { CylinderSurfaceIcon, ConeSurfaceIcon, LightSourceIcon, PlaneMathIcon } from './ui/icons';
import { modalOverlay, modalShell } from './ui/styles';
import type { ReactNode } from 'react';
import { FAMILY_LABEL } from './ui/labels';

interface CatalogRow {
  family: ProjectionFamily;
  familyLabel: string;
  familyIcon: ReactNode;
  variant: ProjectionVariant;
}

const FAMILY_ICONS: Record<ProjectionFamily, ReactNode> = {
  cylindrical: <CylinderSurfaceIcon />,
  conic: <ConeSurfaceIcon />,
  azimuthalPerspective: <LightSourceIcon />,
  azimuthalMath: <PlaneMathIcon />,
};

const ALL_ROWS: CatalogRow[] = [
  ...CYLINDRICAL_VARIANT_OPTIONS.map((o) => ({ family: 'cylindrical' as const, familyLabel: FAMILY_LABEL.cylindrical, familyIcon: FAMILY_ICONS.cylindrical, variant: o.value })),
  ...CONIC_VARIANT_OPTIONS.map((o) => ({ family: 'conic' as const, familyLabel: FAMILY_LABEL.conic, familyIcon: FAMILY_ICONS.conic, variant: o.value })),
  ...AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS.map((o) => ({ family: 'azimuthalPerspective' as const, familyLabel: FAMILY_LABEL.azimuthalPerspective, familyIcon: FAMILY_ICONS.azimuthalPerspective, variant: o.value })),
  ...AZIMUTHAL_MATH_VARIANT_OPTIONS.map((o) => ({ family: 'azimuthalMath' as const, familyLabel: FAMILY_LABEL.azimuthalMath, familyIcon: FAMILY_ICONS.azimuthalMath, variant: o.value })),
];

interface Props {
  onClose: () => void;
  onSelect: (family: ProjectionFamily, variant: ProjectionVariant) => void;
}

// One table for all 14 projections. Columns: family (icon + label), the
// projection name, what it preserves / its property, and the developable surface.
const COLUMNS: { key: 'family' | 'label' | 'propertyLabel' | 'surfaceTypeLabel'; header: string; width: string }[] = [
  { key: 'family', header: 'Семейство', width: '20%' },
  { key: 'label', header: 'Название', width: '35%' },
  { key: 'propertyLabel', header: 'Свойства', width: '33%' },
  { key: 'surfaceTypeLabel', header: 'Поверхность', width: '12%' },
];

export default function ProjectionCatalog({ onClose, onSelect }: Props) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_ROWS;
    const q = query.toLowerCase();
    return ALL_ROWS.filter((row) => {
      const def = variantDef(row.variant);
      return (
        row.familyLabel.toLowerCase().includes(q) ||
        def.label.toLowerCase().includes(q) ||
        def.propertyLabel.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return createPortal(
    <div className={modalOverlay} onClick={onClose}>
      <div
        className={`${modalShell} h-[80vh] w-[860px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neon-blue">Выбор проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
          >
            ✕
          </button>
        </div>

        <div className="mb-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск проекции..."
            className="w-full rounded border border-neon-blue/50 bg-panel-bg px-3 py-2 text-sm text-neon-blue outline-none placeholder:text-white/30 drop-shadow-[0_0_3px_var(--color-neon-blue-soft)] focus-visible:ring-2 focus-visible:ring-neon-blue/70"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {COLUMNS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-panel-bg/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wider text-neon-blue/50">
                {COLUMNS.map((c) => (
                  <th key={c.key} className="whitespace-nowrap px-3 py-2 font-medium">
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const def = variantDef(row.variant);
                return (
                  <tr
                    key={row.variant as string}
                    onClick={() => {
                      onSelect(row.family, row.variant);
                      onClose();
                    }}
                    className="cursor-pointer align-top text-white/80 transition hover:bg-neon-blue/10 hover:text-neon-blue"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-white/60">
                      <span className="inline-flex items-center" title={row.familyLabel}>
                        {row.familyIcon}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-neon-blue">{def.label}</td>
                    <td className="px-3 py-2">{def.propertyLabel}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-white/60">{def.surfaceTypeLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-8 text-center text-white/40">Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
