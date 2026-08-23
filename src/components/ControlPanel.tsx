import { useAppStore } from '../store/useAppStore';

import { useProjectionParams } from '../store/selectors';
import { variantDef, type VariantDef } from '../utils/projectionVariants';
import ParamSlider from './ui/ParamSlider';
import PresetChips from './ui/PresetChips';
import {
  labelClass,
  activeTab,
  inactiveTab,
  sliderClass,
  fieldRow,
} from './ui/styles';
import { AZ_LIGHT_LABEL_MAP, AZ_LIGHT_ICON_MAP } from './ui/labels';
import { signedStandardParallelDeg } from '../constants/geometry';

function StdParallel2Control({
  value,
  phiOrigin,
  onChange,
  disabled = false,
  tooltip,
}: {
  value: number | null;
  phiOrigin: number;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  tooltip?: string | null;
}) {
  const secant = value != null;
  // The cone hemisphere follows φ₀'s sign, so φ₂ must carry the same sign:
  // a southern cone's second parallel is NEGATIVE (parallels([−40°, +60°])
  // would be an impossible cone spanning both hemispheres).
  const sign = signedStandardParallelDeg(phiOrigin) < 0 ? -1 : 1;
  const defaultMag = sign * Math.min(89, Math.abs(signedStandardParallelDeg(phiOrigin)) + 20);

  if (disabled) {
    return (
      <div className={fieldRow} title={tooltip ?? undefined}>
        <span className={`${labelClass} w-36 shrink-0 cursor-help opacity-40`}>🔗 Параллель 2</span>
        <div className="flex min-w-0 flex-1 items-center gap-[4px]">
          <input type="range" min={0} max={90} step={1} value={value ?? defaultMag} disabled className={sliderClass} />
          <span className="w-9 shrink-0 text-right text-[12px] text-gray-500">—</span>
        </div>
      </div>
    );
  }

  return (
    <div className={fieldRow}>
      <span className={`${labelClass} w-36 shrink-0`}>Параллель 2</span>
      <button
        type="button"
        aria-pressed={secant}
        aria-label="Секущий конус"
        onClick={() => onChange(secant ? null : defaultMag)}
        className={`${secant ? activeTab : inactiveTab} rounded px-2 py-1 text-[11px] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70`}
        title="Секущий конус касается Земли по двум параллелям вместо одной"
      >
        {secant ? 'Секущий' : 'Касательный'}
      </button>
      <input
        type="range"
        min={sign > 0 ? 1 : -89}
        max={sign > 0 ? 89 : -1}
        step={1}
        value={value ?? defaultMag}
        disabled={!secant}
        aria-label="Вторая стандартная параллель"
        aria-valuetext={`${value ?? defaultMag}°`}
        onChange={(e) => onChange(Number(e.target.value))}
        className={sliderClass}
      />
    </div>
  );
}

// Top-level projection parameter controls (context-driven by VariantDef).
function ProjectionParamsSection({ def }: { def: VariantDef }) {
  const params = useProjectionParams();
  const setParam = useAppStore((s) => s.setParam);
  const { family, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2 } = params;

  // For the conic family φ₀ IS the first standard parallel; for cylindrical /
  // azimuthal it is simply the central latitude (for cylindrical it rolls the
  // Earth inside the static drum), so the label must not claim a standard
  // parallel where there is none.
  const phiLabel = family === 'conic' ? 'Параллель 1 (φ₁)' : 'Центральная параллель (φ₀)';

  return (
    <div className="flex flex-col gap-2.5">
      <ParamSlider label="Долгота (λ₀)" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />

      {def.showParallel1 && (
        <ParamSlider label={phiLabel} value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      )}

      {def.showParallel2 && (
        <StdParallel2Control
          value={stdParallel2}
          phiOrigin={phiOrigin}
          onChange={(v) => setParam('stdParallel2', v)}
          disabled={!def.parallel2Editable}
        />
      )}

      {family === 'azimuthalPerspective' && (
        <ParamSlider label="Широта точки (φ₀)" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      )}

      {def.showTouchPointPresets && def.touchPointPresets && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Пресеты точки касания</span>
          <PresetChips presets={def.touchPointPresets} active={{ phi: phiOrigin, lambda: lambda0 }} onSelect={(phi, lambda) => { setParam('phiOrigin', phi); setParam('lambda0', lambda); }} />
        </div>
      )}

      {family === 'azimuthalPerspective' && (
        <ParamSlider
          label="Наклон (γ)"
          value={gamma}
          min={-180}
          max={180}
          step={1}
          onChange={(v) => setParam('gamma', v)}
        />
      )}

      <ParamSlider
        label="Масштаб"
        value={scaleFactor}
        min={family === 'cylindrical' ? 0.5 : 0.9}
        max={family === 'cylindrical' ? 1.0 : 1.1}
        step={0.01}
        suffix=""
        disabled={def.lockedScaleFactor !== null}
        onChange={(v) => setParam('scaleFactor', v)}
      />

      {family === 'azimuthalPerspective' && (
        <div className={fieldRow}>
          <span className={`${labelClass} w-36 shrink-0 ${def.lockedLight ? 'opacity-40' : ''}`}>
            {def.lockedLight ? '🔒 Источник света' : 'Источник света'}
          </span>
          <span className="text-[12px] text-gray-400">
            {AZ_LIGHT_ICON_MAP[params.azLight]} {AZ_LIGHT_LABEL_MAP[params.azLight]}
          </span>
        </div>
      )}
    </div>
  );
}

export default function ControlPanel() {
  const params = useProjectionParams();
  const def = variantDef(params.variant);

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <ProjectionParamsSection def={def} />
    </div>
  );
}
