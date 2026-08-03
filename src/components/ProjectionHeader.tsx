import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import { variantDef, defaultVariant } from '../utils/projectionVariants';
import ProjectionCatalog from './ProjectionCatalog';
import { FamilyIcon, ResetIcon } from './ui/icons';
import { iconBtn } from './ui/styles';
import { FAMILY_LABEL } from './ui/labels';

// Slim top header of the left column: the projection-selection button (opens
// the full projection catalog, shows the current family — variant) plus the
// reset button. It owns the catalog modal state so the control panel below
// stays focused on parameter sliders.
export default function ProjectionHeader() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const params = useProjectionParams();
  const { variant, family } = params;
  const setVariant = useAppStore((s) => s.setVariant);

  const def = useMemo(() => variantDef(variant ?? defaultVariant(family)), [variant, family]);

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          title="Выбрать проекцию"
          aria-label="Выбрать проекцию"
          onClick={() => setCatalogOpen(true)}
          className={`${iconBtn} flex-auto justify-start gap-2 px-3`}
        >
          <FamilyIcon family={family} />
          <span className="truncate text-[12px]">
            {FAMILY_LABEL[family as keyof typeof FAMILY_LABEL]} — {def.label}
          </span>
        </button>
        <button title="Сбросить параметры" aria-label="Сбросить параметры" onClick={() => useAppStore.getState().resetParams()} className={iconBtn}>
          <ResetIcon />
        </button>
      </div>
      {catalogOpen && (
        <ProjectionCatalog
          onClose={() => setCatalogOpen(false)}
          onSelect={(_f, v) => setVariant(v)}
        />
      )}
    </>
  );
}
