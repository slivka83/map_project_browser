import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ProjectionParams, AzimuthalLight } from '../store/useAppStore';
import { FAMILY_LABEL, DISTORTION_LABEL } from './ui/labels';
import { signedStandardParallelDeg } from '../constants/geometry';

const latLabel = (deg: number): string => {
  if (deg === 0) return '0°';
  return `${Math.abs(deg)}° ${deg > 0 ? 'с.ш.' : 'ю.ш.'}`;
};

// Human-readable projection class (docs/specification.md §4): the developable surface
// and the distortion model, with the azimuthal family resolved via its light source.
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-[460px] flex-col overflow-hidden rounded-lg border border-white/10 bg-panel-bg p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="neon-text text-sm font-semibold">Точные параметры проекции</h3>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="text-lg leading-none text-white/60 transition hover:text-white"
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-2 text-[13px]">
          <Row k="Центральный меридиан (λ₀)" v={`${params.lambda0}°`} />
          <Row k="Широта начала отсчёта (φ₀)" v={latLabel(params.phiOrigin)} />
          <Row k="Стандартная параллель 1 (φ₁)" v={latLabel(signedStandardParallelDeg(params.phiOrigin))} />
          <Row
            k="Стандартная параллель 2 (φ₂)"
            v={params.family === 'conic' && params.stdParallel2 != null ? latLabel(params.stdParallel2) : '—'}
          />
          <Row k="Масштабный коэффициент" v={params.scaleFactor.toFixed(2)} />
          <Row k="Наклон (γ)" v={`${params.gamma}°`} />
          <Row k="Класс проекции" v={describeProjection(params)} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
