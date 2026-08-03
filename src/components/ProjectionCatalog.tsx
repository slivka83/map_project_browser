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

interface GroupedOptions {
  family: ProjectionFamily;
  label: string;
  icon: ReactNode;
  options: { value: ProjectionVariant; label: string }[];
}

const ALL_GROUPS: GroupedOptions[] = [
  { family: 'cylindrical', label: 'Цилиндрические', icon: <CylinderSurfaceIcon />, options: CYLINDRICAL_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
  { family: 'conic', label: 'Конические', icon: <ConeSurfaceIcon />, options: CONIC_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
  { family: 'azimuthalPerspective', label: 'Азимутальные перспективные', icon: <LightSourceIcon />, options: AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
  { family: 'azimuthalMath', label: 'Азимутальные математические', icon: <PlaneMathIcon />, options: AZIMUTHAL_MATH_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
];

interface Props {
  onClose: () => void;
  onSelect: (family: ProjectionFamily, variant: ProjectionVariant) => void;
}

// Table columns: name, what the projection preserves / its property, where it
// is used, and the developable surface (already conveyed by the family group
// header icon, so the column stays narrow).
const COLUMNS: { key: 'label' | 'propertyLabel' | 'applicationLabel' | 'surfaceTypeLabel'; header: string; width: string }[] = [
  { key: 'label', header: 'Название', width: '34%' },
  { key: 'propertyLabel', header: 'Свойства', width: '27%' },
  { key: 'applicationLabel', header: 'Применение', width: '27%' },
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
    if (!query.trim()) return ALL_GROUPS;
    const q = query.toLowerCase();
    return ALL_GROUPS
      .map((g) => ({
        ...g,
        options: g.options.filter((o) => {
          const def = variantDef(o.value);
          return (
            o.label.toLowerCase().includes(q) ||
            def.propertyLabel.toLowerCase().includes(q) ||
            (def.applicationLabel ?? '').toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.options.length > 0);
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
          {filtered.map((group) => (
            <div key={group.family} className="mb-3">
              <div className="sticky top-0 z-10 flex items-center gap-2 bg-panel-bg/95 px-1 py-1.5 text-xs uppercase tracking-wider text-neon-blue/60 backdrop-blur">
                {group.icon}
                <span>{group.label}</span>
                <span className="ml-auto text-white/25">{group.options.length}</span>
              </div>
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  {COLUMNS.map((c) => (
                    <col key={c.key} style={{ width: c.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-neon-blue/50">
                    {COLUMNS.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-1.5 font-medium">
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.options.map((opt) => {
                    const def = variantDef(opt.value);
                    return (
                      <tr
                        key={opt.value as string}
                        onClick={() => {
                          onSelect(group.family, opt.value);
                          onClose();
                        }}
                        className="cursor-pointer align-top text-white/80 transition hover:bg-neon-blue/10 hover:text-neon-blue"
                      >
                        <td className="px-3 py-2 text-neon-blue">{opt.label}</td>
                        <td className="px-3 py-2">{def.propertyLabel}</td>
                        <td className="px-3 py-2 text-white/60">{def.applicationLabel ?? '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-white/60">{def.surfaceTypeLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="py-8 text-center text-white/40">Ничего не найдено</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
