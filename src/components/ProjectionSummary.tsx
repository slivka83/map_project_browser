import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectionParams, AzimuthalLight } from '../store/useAppStore';
import { FAMILY_LABEL, DISTORTION_LABEL } from './ui/labels';
import { variantDef } from '../utils/projectionVariants';
import { signedStandardParallelDeg } from '../constants/geometry';
import { modalOverlay, modalShell } from './ui/styles';

const roundLat = (deg: number): number => Math.round(deg * 10) / 10;

const latLabel = (deg: number): string => {
  if (deg === 0) return '0°';
  return `${Math.abs(roundLat(deg))}° ${deg > 0 ? 'с.ш.' : 'ю.ш.'}`;
};

// Human-readable projection class (see AGENTS.md): the developable surface
// and the distortion model, with the azimuthal family resolved via its light source.
function describeProjection(p: ProjectionParams): string {
  const fam = FAMILY_LABEL[p.family];
  const dist = DISTORTION_LABEL[p.distortion];
  if (p.family === 'azimuthalPerspective') {
    const az: Record<AzimuthalLight, string> = {
      center: 'Гномоническая',
      antipode: 'Стереографическая',
      infinity: 'Ортографическая',
    };
    return `${az[p.azLight]} (азимутальная)`;
  }
  const secant = p.family === 'conic' ? p.stdParallel2 != null : p.family === 'cylindrical' && p.scaleFactor !== 1;
  // Russian grammar: only the leading word is capitalised («Секущая коническая
  // равновеликая»), the class nouns stay lowercase mid-phrase.
  return `${secant ? 'Секущая' : 'Касательная'} ${fam.toLowerCase()} ${dist.toLowerCase()}`;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-white/5 pb-1.5 last:border-b-0 last:pb-0">
      <span className="text-gray-400">{k}</span>
      <span className="text-neon-blue">{v}</span>
    </div>
  );
}

// Modal mirror of the EPSG catalog: a centered, dark glass panel showing the
// exact geodetic parameters of the current projection (the old inline summary
// block moved here so the control panel stays compact).
export default function ProjectionSummary({ params, onClose }: { params: ProjectionParams; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isConic = params.family === 'conic';
  // The standard parallels of the DRAWN projection, per family:
  // conic → the signed parallel derived from φ₀; cylindrical → the contact
  // parallels of the drum ±arccos(scaleFactor) (φ₀ does not move them — it
  // only rolls the Earth inside the tube); azimuthal → none.
  const cylContact = (Math.acos(Math.max(0, Math.min(1, params.scaleFactor))) * 180) / Math.PI;

  return createPortal(
    <div
      className={modalOverlay}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Точные параметры проекции"
        className={`${modalShell} w-[460px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Точные параметры проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-blue/70"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2 text-[13px]">
          <Row k="Центральный меридиан (λ₀)" v={`${params.lambda0}°`} />
          {params.family !== 'azimuthalPerspective' ? (
            <Row k="Центральная широта (φ₀)" v={latLabel(params.phiOrigin)} />
          ) : (
            <Row k="Точка касания (φ₀)" v={latLabel(params.phiOrigin)} />
          )}
          {isConic && (
            <Row k="Стандартная параллель 1 (φ₁)" v={latLabel(signedStandardParallelDeg(params.phiOrigin))} />
          )}
          {isConic && (
            <Row
              k="Стандартная параллель 2 (φ₂)"
              v={params.stdParallel2 != null ? latLabel(params.stdParallel2) : '—'}
            />
          )}
          {params.family === 'cylindrical' && (
            <Row
              k="Параллели касания цилиндра (±φ_s)"
              v={cylContact === 0 ? '0° (касательный)' : `±${roundLat(cylContact)}°`}
            />
          )}
          <Row k="Масштабный коэффициент" v={params.scaleFactor.toFixed(2)} />
          {params.family === 'azimuthalPerspective' && <Row k="Наклон (γ)" v={`${params.gamma}°`} />}
          <Row k="Класс проекции" v={describeProjection(params)} />
          <Row k="Вариант" v={variantDef(params.variant).label} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
