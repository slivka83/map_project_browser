import { useState } from 'react';
import { useAppStore, type DistortionModel, type AzimuthalLight, type CylindricalLight, type ProjectionParams } from '../store/useAppStore';
import { useProjectionParams } from '../store/selectors';
import EpsgCatalog from './EpsgCatalog';
import Dropdown from './Dropdown';
import { FamilyIcon, EpsgIcon, ResetIcon, InfoIcon } from './ui/icons';
import { labelClass, activeTab, inactiveTab, iconBtn, panelClass } from './ui/styles';
import { FAMILY_OPTIONS, DISTORTION_OPTIONS, FAMILY_LABEL, DISTORTION_LABEL, AZIMUTHAL_LIGHT_OPTIONS, CYLINDRICAL_LIGHT_OPTIONS, PROJECTION_PRESETS } from './ui/labels';
import { signedStandardParallelDeg } from '../constants/geometry';
import Hint from './ui/Hint';

const famBtn =
  'relative flex h-9 w-[54px] items-center justify-center transition';

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '°',
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <div className="flex flex-1 items-center gap-[4px]">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1 flex-1 accent-neon-blue"
        />
        <span className="w-9 shrink-0 text-right text-[12px] text-neon-blue">
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}

function LightSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>
        {label}
        {hint && <Hint text={hint} />}
      </span>
      <Dropdown<T> value={value} options={options} onChange={onChange} />
    </div>
  );
}

function DistortionSelect({
  value,
  onChange,
}: {
  value: DistortionModel;
  onChange: (v: DistortionModel) => void;
}) {
  return (
    <Dropdown<DistortionModel>
      value={value}
      options={DISTORTION_OPTIONS}
      onChange={onChange}
    />
  );
}

// Conic secant/ tangent control: a single toggle switches between a tangent cone
// (stdParallel2 = null) and a secant cone (stdParallel2 set to a magnitude in the
// same hemisphere as phiOrigin; the hemisphere itself comes from phiOrigin's sign
// in the geometry). A slider fine-tunes the second parallel's magnitude.
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
  const defaultMag = Math.min(89, Math.abs(signedStandardParallelDeg(phiOrigin)) + 20);
  return (
    <div className="flex items-center gap-[12px]">
      <span className={`${labelClass} w-40 shrink-0`}>Вторая параллель</span>
      <button
        type="button"
        aria-pressed={secant}
        aria-label="Секущий конус"
        onClick={() => onChange(secant ? null : defaultMag)}
        className={`${secant ? activeTab : inactiveTab} rounded px-2 py-1 text-[11px] uppercase`}
        title="Секущий конус касается Земли по двум параллелям вместо одной — две линии нулевых искажений"
      >
        {secant ? 'Секущий' : 'Касательный'}
      </button>
      <input
        type="range"
        min={0}
        max={90}
        step={1}
        value={value ?? defaultMag}
        disabled={!secant}
        aria-label="Вторая стандартная параллель"
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-neon-blue disabled:opacity-40"
      />
    </div>
  );
}

const latLabel = (deg: number): string => {
  if (deg === 0) return '0°';
  return `${Math.abs(deg)}° ${deg > 0 ? 'с.ш.' : 'ю.ш.'}`;
};

function describeProjection(p: ProjectionParams): string {
  const fam = FAMILY_LABEL[p.family];
  const dist = DISTORTION_LABEL[p.distortion];
  if (p.family === 'azimuthal') {
    const az: Record<AzimuthalLight, string> = {
      center: 'Гномоническая',
      antipode: 'Стереографическая',
      infinity: 'Ортографическая',
      math: dist,
    };
    return `${az[p.azLight]} (азимутальная)`;
  }
  const secant = p.family === 'conic' ? p.stdParallel2 != null : p.scaleFactor !== 1;
  return `${secant ? 'Секущая' : 'Касательная'} ${fam} ${dist}`;
}

function SummaryRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-400">{k}</span>
      <span className="text-neon-blue">{v}</span>
    </div>
  );
}

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const params = useProjectionParams();
  const { family, distortion, lambda0, phiOrigin, scaleFactor, gamma, stdParallel2, azLight, cylLight } = params;
  const setParam = useAppStore((s) => s.setParam);
  const setFamily = useAppStore((s) => s.setFamily);
  const resetParams = useAppStore((s) => s.resetParams);
  const applyPreset = useAppStore((s) => s.applyPreset);

  const applyProjectionPreset = (preset: (typeof PROJECTION_PRESETS)[number]) => {
    setFamily(preset.params.family ?? family);
    applyPreset(preset.params);
  };
  const familyPresets = PROJECTION_PRESETS.filter((p) => p.params.family === family);

  return (
    <div className="flex flex-col gap-3.5 px-3 py-3">
      <div className="flex items-center gap-1">
        <div className="flex overflow-hidden rounded-md border border-neon-blue/50 bg-panel-bg drop-shadow-[0_0_3px_var(--color-neon-blue-soft)]">
          {FAMILY_OPTIONS.map((f, i) => (
            <button
              key={f.value}
              title={f.label}
              aria-label={f.label}
              onClick={() => setFamily(f.value)}
              className={`${famBtn} rounded-none border-r border-neon-blue/30 last:border-r-0 ${
                i > 0 ? '-ml-px' : ''
              } ${family === f.value ? activeTab : inactiveTab}`}
            >
              <FamilyIcon family={f.value} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            title="Библиотека EPSG"
            aria-label="Библиотека EPSG"
            onClick={() => setCatalogOpen(true)}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <EpsgIcon />
          </button>
          <button
            title="Точные параметры проекции"
            aria-label="Точные параметры проекции"
            aria-pressed={showSummary}
            onClick={() => setShowSummary((s) => !s)}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)] ${
              showSummary ? 'bg-neon-blue/15 text-neon-blue shadow-[0_0_10px_var(--color-neon-blue-soft)]' : ''
            }`}
          >
            <InfoIcon />
          </button>
          <button
            title="Сбросить параметры"
            aria-label="Сбросить параметры"
            onClick={() => resetParams()}
            className={`${iconBtn} hover:bg-neon-blue/10 hover:shadow-[0_0_8px_var(--color-neon-blue-soft)]`}
          >
            <ResetIcon />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-[12px] mt-3">
        <span className={`${labelClass} w-40 shrink-0`}>
          Матмодель
          <Hint text="Тип сохраняемого свойства: равноугольность (углы и формы), равновеликость (площади) или равнопромежуточность (расстояния)." />
        </span>
        <DistortionSelect value={distortion} onChange={(v) => setParam('distortion', v)} />
      </div>

      <Slider label="Центральный меридиан" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} hint="Поворот вспомогательной поверхности вокруг Земли — задаёт долготу, с которой «разворачивается» карта." />
      <Slider label="Широта начала отсчета" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} hint="Точка касания (азимутальная), параллель касания (коническая) или сдвиг оси (цилиндрическая)." />
      <Slider label="Наклон (γ)" value={gamma} min={-180} max={180} step={1} onChange={(v) => setParam('gamma', v)} hint="Наклон вспомогательной поверхности — создаёт косые и трансверсальные проекции." />
      <Slider label="Масштаб" value={scaleFactor} min={0.9} max={1.1} step={0.01} onChange={(v) => setParam('scaleFactor', v)} suffix="" hint="Диаметр / погружение вспомогательной фигуры. Чем больше, тем крупнее карта и сильнее искажения." />

      {family === 'conic' && (
        <StdParallel2Control value={stdParallel2} phiOrigin={phiOrigin} onChange={(v) => setParam('stdParallel2', v)} />
      )}
      {family === 'azimuthal' && (
        <LightSelect<AzimuthalLight>
          label="Источник света"
          value={azLight}
          options={AZIMUTHAL_LIGHT_OPTIONS}
          onChange={(v) => setParam('azLight', v)}
          hint="Положение «лампочки»: из центра → гномоническая, из антипода → стереографическая, из бесконечности → ортографическая."
        />
      )}
      {family === 'cylindrical' && (
        <LightSelect<CylindricalLight>
          label="Ось источника"
          value={cylLight}
          options={CYLINDRICAL_LIGHT_OPTIONS}
          onChange={(v) => setParam('cylLight', v)}
          hint="Ось линейного источника: С–Ю → нормальная, через экватор → трансверсальная, наклон → косая."
        />
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className={`${labelClass} w-full`}>Пресеты проекций</span>
        {familyPresets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => applyProjectionPreset(p)}
            className={`rounded border border-neon-blue/40 px-2 py-1 text-[11px] text-neon-blue/80 transition hover:bg-neon-blue/10 hover:text-neon-blue`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {showSummary && (
        <div className={`${panelClass} flex flex-col gap-1 text-[12px]`}>
          <div className="mb-1 text-[11px] uppercase tracking-wider text-neon-blue">Точные параметры проекции</div>
          <SummaryRow k="Центральный меридиан (λ₀)" v={`${lambda0}°`} />
          <SummaryRow k="Широта начала отсчёта (φ₀)" v={latLabel(phiOrigin)} />
          <SummaryRow k="Стандартная параллель 1 (φ₁)" v={latLabel(signedStandardParallelDeg(phiOrigin))} />
          <SummaryRow
            k="Стандартная параллель 2 (φ₂)"
            v={family === 'conic' && stdParallel2 != null ? latLabel(stdParallel2) : '—'}
          />
          <SummaryRow k="Масштабный коэффициент" v={scaleFactor.toFixed(2)} />
          <SummaryRow k="Наклон (γ)" v={`${gamma}°`} />
          <SummaryRow k="Класс проекции" v={describeProjection(params)} />
        </div>
      )}

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
    </div>
  );
}
