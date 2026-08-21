import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore, type ProjectionFamily } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import {
  defaultVariant,
  variantDef,
  CYLINDRICAL_VARIANT_OPTIONS,
  CONIC_VARIANT_OPTIONS,
  AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS,
  type ProjectionVariant,
} from '../utils/projectionVariants';
import { FAMILY_LABEL } from './ui/labels';
import { NEON_DIVIDER, NEON_DIVIDER_GLOW } from '../constants/designTokens';
import { FamilyIcon, ResetIcon, ChevronDownIcon } from './ui/icons';

interface DropdownOption {
  value: ProjectionVariant;
  label: string;
  family: ProjectionFamily;
}

const FAMILY_ORDER: ProjectionFamily[] = ['cylindrical', 'conic', 'azimuthalPerspective'];

const FAMILY_OPTIONS: Record<ProjectionFamily, DropdownOption[]> = {
  cylindrical: CYLINDRICAL_VARIANT_OPTIONS.map((o) => ({ ...o, family: 'cylindrical' as const })),
  conic: CONIC_VARIANT_OPTIONS.map((o) => ({ ...o, family: 'conic' as const })),
  azimuthalPerspective: AZIMUTHAL_PERSPECTIVE_VARIANT_OPTIONS.map((o) => ({
    ...o,
    family: 'azimuthalPerspective' as const,
  })),
};

const ALL_OPTIONS: DropdownOption[] = [
  ...FAMILY_OPTIONS.cylindrical,
  ...FAMILY_OPTIONS.conic,
  ...FAMILY_OPTIONS.azimuthalPerspective,
];

// Slim top header of the left column (rendered by `App.tsx` above the
// scrolling `ControlPanel`): **one glass block filling the whole area**
// (`border-neon-blue/50` + `bg-panel-bg`, rounded, like other panel elements),
// split by a vertical `NEON_DIVIDER` line from top to bottom into two zones —
// the wide left one is the projection **dropdown**: a custom neon-glass
// button showing the current variant (the family is conveyed by the family
// icon) that opens a glass listbox panel listing all 7 projections grouped by
// family headers; picking an option calls `setVariant(variant)`. The narrow
// right zone resets the parameters.
export default function ProjectionHeader() {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  const current = variant ?? defaultVariant(family);
  const def = useMemo(() => variantDef(current), [current]);
  const highlightedValue = ALL_OPTIONS[highlight]?.value;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlight((h) => (h + 1) % ALL_OPTIONS.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => (h - 1 + ALL_OPTIONS.length) % ALL_OPTIONS.length);
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = ALL_OPTIONS[highlight];
        if (opt) {
          setVariant(opt.value);
          setOpen(false);
        }
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, highlight, setVariant]);

  const openMenu = () => {
    setHighlight(Math.max(0, ALL_OPTIONS.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  return (
    <div ref={rootRef} className="relative flex h-10 w-full items-stretch">
      <div className="flex h-full w-full overflow-hidden rounded-t-lg border border-neon-blue/50 bg-panel-bg">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Выбрать проекцию"
          title="Выбрать проекцию"
          onClick={() => (open ? setOpen(false) : openMenu())}
          className="flex h-full min-w-0 flex-1 items-center gap-[9px] rounded-tl-lg px-3 text-neon-blue transition hover:bg-neon-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
        >
          <FamilyIcon family={family} />
          <span className="min-w-0 flex-1 truncate text-left text-[12px]">{def.label}</span>
          <ChevronDownIcon className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <div className="w-px self-stretch" style={{ background: NEON_DIVIDER, boxShadow: NEON_DIVIDER_GLOW }} />
        <button
          type="button"
          title="Сбросить параметры"
          aria-label="Сбросить параметры"
          onClick={() => useAppStore.getState().resetParams()}
          className="flex h-full w-14 shrink-0 items-center justify-center rounded-tr-lg text-neon-blue transition hover:bg-neon-blue/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
        >
          <ResetIcon />
        </button>
      </div>
      {open && (
        <div
          role="listbox"
          aria-label="Выбрать проекцию"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-neon-blue/50 bg-panel-bg shadow-[0_8px_30px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          {FAMILY_ORDER.map((f) => (
            <div key={f}>
              <div className="px-3 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-neon-blue/50">
                {FAMILY_LABEL[f]}
              </div>
              {FAMILY_OPTIONS[f].map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={o.value === current}
                  onMouseEnter={() => setHighlight(ALL_OPTIONS.findIndex((x) => x.value === o.value))}
                  onClick={() => {
                    setVariant(o.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70 ${
                    o.value === highlightedValue ? 'bg-neon-blue/10 text-neon-blue' : 'text-gray-300'
                  } ${o.value === current ? 'text-neon-blue' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}