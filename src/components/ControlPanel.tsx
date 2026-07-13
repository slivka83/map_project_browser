import { useState } from 'react';
import { useAppStore, type ProjectionFamily, type DistortionModel } from '../store/useAppStore';
import EpsgCatalog from './EpsgCatalog';
import Dropdown from './Dropdown';

const FAMILIES: { value: ProjectionFamily; label: string }[] = [
  { value: 'cylindrical', label: 'Цилиндрическая' },
  { value: 'conic', label: 'Коническая' },
  { value: 'azimuthal', label: 'Азимутальная' },
];

const DISTORTIONS: { value: DistortionModel; label: string }[] = [
  { value: 'conformal', label: 'Равноугольная' },
  { value: 'equalArea', label: 'Равновеликая' },
  { value: 'equidistant', label: 'Равнопромежуточная' },
];

const panelClass = 'bg-white/5 backdrop-blur-md border border-white/10 rounded-lg p-2.5';
const labelClass = 'text-[9px] uppercase tracking-wider text-neon-blue/80';
const activeTab = 'bg-neon-blue/20 border-neon-blue text-neon-blue';
const inactiveTab = 'border-white/10 text-white/60 hover:text-white';

function FamilyIcon({ family }: { family: ProjectionFamily }) {
  if (family === 'cylindrical') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12" />
        <path d="M19 6v12" />
        <path d="M5 18a7 3 0 0 0 14 0" />
      </svg>
    );
  }
  if (family === 'conic') {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 4 18 19H6Z" />
        <path d="M6 19a6 2 0 0 0 12 0" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
    </svg>
  );
}

function EpsgIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path d="M3 12h18" />
    </svg>
  );
}

function TissotIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix = '°',
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`${labelClass} w-32 shrink-0`}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-neon-blue"
      />
      <span className="w-10 shrink-0 text-right text-[10px] text-neon-blue">
        {value}
        {suffix}
      </span>
    </div>
  );
}

const iconBtn =
  'flex h-9 w-[54px] items-center justify-center rounded border transition';

const famBtn =
  'relative flex h-9 w-[54px] items-center justify-center transition';

function DistortionSelect({
  value,
  onChange,
}: {
  value: DistortionModel;
  onChange: (v: DistortionModel) => void;
}) {
  return (
    <Dropdown
      value={value}
      options={DISTORTIONS}
      onChange={(v) => onChange(v as DistortionModel)}
    />
  );
}

export default function ControlPanel() {
  const [catalogOpen, setCatalogOpen] = useState(false);
  const family = useAppStore((s) => s.family);
  const distortion = useAppStore((s) => s.distortion);
  const lambda0 = useAppStore((s) => s.lambda0);
  const phiOrigin = useAppStore((s) => s.phiOrigin);
  const scaleFactor = useAppStore((s) => s.scaleFactor);
  const showTissot = useAppStore((s) => s.showTissot);
  const setShowTissot = useAppStore((s) => s.setShowTissot);
  const setParam = useAppStore((s) => s.setParam);
  const applyPreset = useAppStore((s) => s.applyPreset);

  return (
    <div className={`flex flex-col gap-2.5 ${panelClass}`}>
      <div className="flex items-center gap-1">
        <div className="flex overflow-hidden rounded-md border border-white/10">
          {FAMILIES.map((f, i) => (
            <button
              key={f.value}
              title={f.label}
              aria-label={f.label}
              onClick={() => setParam('family', f.value)}
              className={`${famBtn} rounded-none border-r border-white/10 last:border-r-0 ${
                i > 0 ? '-ml-px' : ''
              } ${family === f.value ? `${activeTab} z-10` : inactiveTab}`}
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
            className={`${iconBtn} border-white/10 text-white/60 hover:text-neon-orange`}
          >
            <EpsgIcon />
          </button>
          <button
            title="Индикатрисы Тиссо"
            aria-label="Индикатрисы Тиссо"
            onClick={() => setShowTissot(!showTissot)}
            className={`${iconBtn} ${
              showTissot
                ? 'border-neon-orange bg-neon-orange/15 text-neon-orange'
                : 'border-white/10 text-white/60 hover:text-neon-orange'
            }`}
          >
            <TissotIcon />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`${labelClass} w-32 shrink-0`}>Матмодель</span>
        <DistortionSelect value={distortion} onChange={(v) => setParam('distortion', v)} />
      </div>

      <Slider label="Центральный меридиан" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />
      <Slider label="Широта начала отсчета" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      <Slider label="Масштаб" value={scaleFactor} min={0.9} max={1.1} step={0.01} onChange={(v) => setParam('scaleFactor', v)} suffix="" />

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
    </div>
  );
}
