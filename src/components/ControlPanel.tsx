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
}: {
  value: number | null;
  phiOrigin: number;
  onChange: (v: number | null) => void;
}) {
  const secant = value != null;
  // The cone hemisphere follows φ₀'s sign, so φ₂ must carry the same sign:
  // a southern cone's second parallel is NEGATIVE (parallels([−40°, +60°])
  // would be an impossible cone spanning both hemispheres).
  const sign = signedStandardParallelDeg(phiOrigin) < 0 ? -1 : 1;
  const defaultMag = sign * Math.min(89, Math.abs(signedStandardParallelDeg(phiOrigin)) + 20);

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

// φ₀'s physical meaning differs per family, and so does its label: only the
// conic family may call it «Параллель 1» (there it genuinely IS the first
// standard parallel); for azimuthal it names the touch point; for cylindrical
// it rolls the Earth inside the static drum.
const PHI_LABEL: Record<VariantDef['family'], string> = {
  conic: 'Параллель 1 (φ₁)',
  azimuthalPerspective: 'Широта точки (φ₀)',
  cylindrical: 'Центральная параллель (φ₀)',
};

// The projection parameter controls. Context-driven by VariantDef: controls
// locked by the selected variant render disabled (never hidden).
export default function ControlPanel() {
  const params = useProjectionParams();
  const setParam = useAppStore((s) => s.setParam);
  const def = variantDef(params.variant);
  const { family, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2 } = params;

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <div className="flex flex-col gap-2.5">
        <ParamSlider label="Долгота (λ₀)" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />

        <ParamSlider label={PHI_LABEL[family]} value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />

        {def.showParallel2 && (
          <StdParallel2Control value={stdParallel2} phiOrigin={phiOrigin} onChange={(v) => setParam('stdParallel2', v)} />
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
            {/* The light source is owned by the variant (never user-editable). */}
            <span className={`${labelClass} w-36 shrink-0 opacity-40`}>🔒 Источник света</span>
            <span className="text-[12px] text-gray-400">
              {AZ_LIGHT_ICON_MAP[params.azLight]} {AZ_LIGHT_LABEL_MAP[params.azLight]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
