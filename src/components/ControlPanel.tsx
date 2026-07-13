import { useState } from 'react';
import { useAppStore, type ProjectionFamily, type DistortionModel } from '../store/useAppStore';
import EpsgCatalog from './EpsgCatalog';

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
    <div>
      <div className={`${labelClass} flex justify-between`}>
        <span>{label}</span>
        <span className="text-neon-blue">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00e5ff]"
      />
    </div>
  );
}

const iconBtn =
  'flex-1 flex h-9 items-center justify-center rounded border transition';

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
      <div className="flex gap-1">
        {FAMILIES.map((f) => (
          <button
            key={f.value}
            title={f.label}
            aria-label={f.label}
            onClick={() => setParam('family', f.value)}
            className={`${iconBtn} ${family === f.value ? activeTab : inactiveTab}`}
          >
            <FamilyIcon family={f.value} />
          </button>
        ))}
        <button
          title="Библиотека EPSG"
          aria-label="Библиотека EPSG"
          onClick={() => setCatalogOpen(true)}
          className={`${iconBtn} border-neon-orange/50 text-neon-orange hover:bg-neon-orange/10`}
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

      <div>
        <div className={labelClass}>Математическая модель</div>
        <select
          value={distortion}
          onChange={(e) => setParam('distortion', e.target.value as DistortionModel)}
          className="mt-0.5 w-full rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[11px] text-white/80"
        >
          {DISTORTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <Slider label="Центральный меридиан" value={lambda0} min={-180} max={180} step={1} onChange={(v) => setParam('lambda0', v)} />
      <Slider label="Широта начала отсчета" value={phiOrigin} min={-90} max={90} step={1} onChange={(v) => setParam('phiOrigin', v)} />
      <Slider label="Масштабный коэффициент" value={scaleFactor} min={0.9} max={1.1} step={0.01} onChange={(v) => setParam('scaleFactor', v)} suffix="" />

      {catalogOpen && <EpsgCatalog onClose={() => setCatalogOpen(false)} applyPreset={applyPreset} />}
    </div>
  );
}
