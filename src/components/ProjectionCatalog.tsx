import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_VARIANT_OPTIONS,
  type ProjectionVariant,
} from '../utils/projectionVariants';
import type { ProjectionFamily } from '../store/useAppStore';
import { FamilyIcon } from './ui/icons';
import { modalOverlay, modalShell } from './ui/styles';

interface GroupedOptions {
  family: ProjectionFamily;
  label: string;
  options: { value: ProjectionVariant; label: string }[];
}

const ALL_GROUPS: GroupedOptions[] = [
  { family: 'cylindrical', label: 'Цилиндрическая', options: CYLINDRICAL_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
  { family: 'conic', label: 'Коническая', options: CONIC_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
  { family: 'azimuthal', label: 'Азимутальная', options: AZIMUTHAL_VARIANT_OPTIONS as { value: ProjectionVariant; label: string }[] },
];

interface Props {
  onClose: () => void;
  onSelect: (family: ProjectionFamily, variant: ProjectionVariant) => void;
}

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
        options: g.options.filter((o) => o.label.toLowerCase().includes(q)),
      }))
      .filter((g) => g.options.length > 0);
  }, [query]);

  return createPortal(
    <div className={modalOverlay} onClick={onClose}>
      <div
        className={`${modalShell} h-[80vh] w-[620px]`}
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
                <FamilyIcon family={group.family} />
                <span>{group.label}</span>
                <span className="ml-auto text-white/25">{group.options.length}</span>
              </div>
              <div className="flex flex-col">
                {group.options.map((opt) => (
                  <button
                    key={opt.value as string}
                    type="button"
                    onClick={() => {
                      onSelect(group.family, opt.value);
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded px-3 py-2 text-left text-sm text-white/80 transition hover:bg-neon-blue/10 hover:text-neon-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-blue/40" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
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
